# Embedding Pipeline - Gemini Embedding 2

## Model Choice
**Model:** `gemini-embedding-2` (was `gemini-embedding-2-preview`, now use stable version)
**Dimensions:** 3072 (full resolution for maximum quality)
**Modality:** Multimodal - accepts text, audio, video, and image inputs

## Why Gemini Embedding 2
- Single model handles both audio and video in the same vector space
- Song and video embeddings are directly comparable via cosine similarity
- Multimodal alignment means audio "mood" maps to visual "mood" naturally
- 3072-dim vectors capture fine-grained semantic nuance
- Text prefix support allows injecting BPM/mood hints into the embedding

---

## Song Embedding Pipeline

### Input
- MP3 or WAV audio file (uploaded by user or from Spotify preview)

### Steps
1. **Load Audio** - Convert to mono, 16kHz sample rate
2. **Detect BPM** - Use librosa beat tracking
3. **Build Text Prefix** - `"BPM around {bpm}, rhythmic feel aligned to this tempo."`
4. **Check Duration**
   - If <= 80 seconds: embed as single payload
   - If > 80 seconds: chunk into 70s segments with 20s overlap
5. **Call Gemini Embedding 2**
   - Content parts: [text_prefix, audio_bytes]
   - Output dimensionality: 3072
6. **If Chunked** - Average all chunk vectors, then L2-normalize
7. **Store** - Save normalized 3072-dim vector

### API Call Format
```python
from google import genai
from google.genai import types

client = genai.Client(api_key=API_KEY)

parts = []
parts.append(types.Part.from_text(text="BPM around 128, rhythmic feel aligned to this tempo."))
parts.append(types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav"))

content = types.Content(role="user", parts=parts)
response = client.models.embed_content(
    model="gemini-embedding-2",
    contents=[content],
    config=types.EmbedContentConfig(output_dimensionality=3072)
)

embedding = response.embeddings[0].values  # list of 3072 floats
```

### n8n HTTP Request Format
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={{ $env.GEMINI_API_KEY }}

Headers:
  Content-Type: application/json

Body:
{
  "content": {
    "parts": [
      { "text": "BPM around 128, rhythmic feel." },
      { "inline_data": { "mime_type": "audio/wav", "data": "{{ $binary.audio.toBase64() }}" } }
    ]
  },
  "embeddingConfig": {
    "outputDimensionality": 3072
  }
}

Response:
{
  "embeddings": [
    { "values": [0.012, -0.034, 0.056, ...] }
  ]
}
```

---

## Video Embedding Pipeline

### Input
- MP4 video file (from Google Drive or local storage)

### Steps
1. **Get Video** - Download from Drive or read from local path
2. **Extract Audio** - Use FFmpeg to extract audio track as WAV
3. **Detect BPM** - Analyze extracted audio with librosa
4. **Check Duration**
   - If <= 120 seconds: embed whole video as single payload
   - If > 120 seconds: chunk into 100s segments with 20s overlap
5. **Embed Video** - Send video bytes to Gemini Embedding 2
   - Content parts: [bpm_text_prefix, video_bytes]
   - This captures both visual and audio semantics together
6. **Optionally Embed Audio Separately** - For audio-only similarity boost
7. **If Chunked** - Average all chunk vectors, L2-normalize
8. **Store in Supabase** - Insert into `videos` table with embedding column

### Chunking Strategy
```
Video: 0s -------- 100s -------- 200s -------- 250s
Chunk1: [0s ----------- 100s]
Chunk2:          [80s ----------- 180s]
Chunk3:                   [160s ----------- 250s]

Each chunk embedded separately -> averaged -> normalized
```

### Why Chunk + Average?
- Gemini has a max payload size for embeddings
- Long videos have multiple "scenes" - averaging captures the overall vibe
- Overlap ensures scene transitions are not lost at chunk boundaries

---

## Text Prefix Strategy

### Purpose
Text prefixes inject human-readable context into the embedding space.
Gemini Embedding 2 processes text + media together, so the text "steers" the vector.

### Standard Prefixes

**For songs:**
```
"BPM around {bpm}, rhythmic feel aligned to this tempo."
```

**For videos (enhanced, when mood data available):**
```
"BPM around {bpm}, {mood} energy, {pacing} pacing visual content."
```

**For search queries (when AI Creative Director has analyzed the song):**
```
"Looking for {pacing} paced visuals with {mood} mood, energy level {energy}/10. Visual style: {visual_keywords}."
```

### When To Use Prefixes
| Scenario | Use Prefix? | Why |
|----------|-------------|-----|
| Initial video indexing | Yes (BPM only) | Adds rhythm context without over-specifying |
| Song upload embedding | Yes (BPM only) | Keeps embedding aligned with video index |
| Campaign search | Yes (full context) | AI Creative Director provides rich context |
| Re-indexing after mood analysis | Yes (BPM + mood) | Enriches vectors with analyzed metadata |

---

## Normalization

All embeddings MUST be L2-normalized before storage and search.

```python
import numpy as np

def normalize(vector):
    v = np.asarray(vector, dtype=np.float32)
    norm = np.linalg.norm(v)
    if norm > 0:
        v = v / norm
    return v
```

After normalization, cosine similarity = dot product (inner product).
This makes both FAISS IndexFlatIP and pgvector `<=>` operator work correctly.

---

## Embedding Storage

### Supabase (Production)
```sql
-- Vector column in videos table
embedding vector(3072)

-- Cosine similarity search
SELECT id, filename, 1 - (embedding <=> $1) AS similarity
FROM videos
ORDER BY embedding <=> $1
LIMIT 15;
```

### FAISS (Local Development)
```python
import faiss

index = faiss.IndexFlatIP(3072)  # inner product = cosine after normalization
index.add(normalized_vectors)
scores, indices = index.search(query_vector, top_k)
```

### Both paths should coexist. Local FAISS for dev speed, Supabase for production.

---

## Rate Limits and Batching

### Gemini API Limits
- Embedding calls: ~1500 RPM (requests per minute) on paid tier
- Max content size: ~20MB per request for video
- Recommended: 2-second delay between video embedding calls in batch processing

### Batching Strategy for n8n
- Process videos in batches of 10
- Add Wait node (2s) between Gemini calls
- Use SplitInBatches node for large ingestion runs
- Track progress in Supabase `processing_jobs` table

---

## Quality Checks

Before storing any embedding, verify:
1. Vector has exactly 3072 dimensions
2. Vector is not all zeros (indicates failed embedding)
3. Vector L2 norm is approximately 1.0 after normalization
4. The source media was readable (not corrupt)

```python
def validate_embedding(vector):
    v = np.asarray(vector)
    assert v.shape == (3072,), f"Wrong dimensions: {v.shape}"
    assert np.any(v != 0), "Zero vector detected"
    norm = np.linalg.norm(v)
    assert 0.99 < norm < 1.01, f"Not normalized: norm={norm}"
    return True
```
