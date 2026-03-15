# API Reference - External Integrations

## 1. Gemini Embedding 2 (Core)

### Purpose
Generate multimodal embeddings for songs and videos in the same vector space.

### Model ID
`gemini-embedding-2`

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key=API_KEY
```

### Supported Input Types
| Type | MIME | Max Size | Notes |
|------|------|----------|-------|
| Audio (WAV) | audio/wav | ~20MB | Mono 16kHz preferred |
| Audio (MP3) | audio/mpeg | ~20MB | |
| Video (MP4) | video/mp4 | ~20MB | Chunk if > 120s |
| Text | text/plain | N/A | Used for BPM/mood prefix |

### Python SDK Usage
```python
from google import genai
from google.genai import types

client = genai.Client(api_key="YOUR_KEY")

# Single audio embedding
parts = [
    types.Part.from_text(text="BPM around 128."),
    types.Part.from_bytes(data=audio_bytes, mime_type="audio/wav")
]
response = client.models.embed_content(
    model="gemini-embedding-2",
    contents=[types.Content(role="user", parts=parts)],
    config=types.EmbedContentConfig(output_dimensionality=3072)
)
vector = response.embeddings[0].values  # 3072 floats
```

### n8n HTTP Request Node
```json
{
  "method": "POST",
  "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent?key={{ $env.GEMINI_API_KEY }}",
  "headers": { "Content-Type": "application/json" },
  "body": {
    "content": {
      "parts": [
        { "text": "BPM prefix text here" },
        { "inline_data": { "mime_type": "audio/wav", "data": "BASE64" } }
      ]
    },
    "embeddingConfig": { "outputDimensionality": 3072 }
  }
}
```

### Rate Limits
- Free tier: ~100 RPM
- Paid tier: ~1500 RPM
- Recommended delay between calls: 2 seconds for batch processing

---

## 2. Twelve Labs (Video Understanding)

### Purpose
Analyze video content (audio + visuals) to extract rich metadata before embedding.
Used in Stage 2 (Video Indexing) to understand what's in each video.

### API Key
Set as `TWELVE_LABS_API_KEY` in n8n environment.

### Key Endpoints

**Create Index**
```
POST https://api.twelvelabs.io/v1.3/indexes
Body: { "index_name": "song-video-agent", "engines": [{"engine_name": "marengo2.7", "engine_options": ["visual", "audio"]}] }
```

**Create Video Task**
```
POST https://api.twelvelabs.io/v1.3/tasks
Body: { "index_id": "INDEX_ID", "video_url": "DRIVE_VIDEO_URL" }
Returns: { "task_id": "...", "status": "pending" }
```

**Get Task Status**
```
GET https://api.twelvelabs.io/v1.3/tasks/{task_id}
Returns: { "status": "ready", "video_id": "..." }
```

**Search Videos (Text-to-Video)**
```
POST https://api.twelvelabs.io/v1.3/search
Body: { "index_id": "INDEX_ID", "query": "girl driving at sunset", "search_options": ["visual", "audio"] }
```

**Generate Video Summary**
```
POST https://api.twelvelabs.io/v1.3/summarize
Body: { "video_id": "VIDEO_ID", "type": "summary" }
Returns: { "summary": "A person dancing in a dimly lit room with upbeat electronic music..." }
```

### n8n HTTP Request Node
```json
{
  "method": "POST",
  "url": "https://api.twelvelabs.io/v1.3/tasks",
  "headers": {
    "x-api-key": "{{ $env.TWELVE_LABS_API_KEY }}",
    "Content-Type": "application/json"
  },
  "body": {
    "index_id": "YOUR_INDEX_ID",
    "video_url": "{{ $json.drive_url }}"
  }
}
```

### How It Fits the Pipeline
1. Video uploaded to Drive (Stage 1)
2. Twelve Labs indexes the video (audio + visual understanding)
3. Twelve Labs metadata (mood, scenes, audio characteristics) enriches the Gemini embedding
4. Gemini Embedding 2 creates the final 3072-dim vector using video bytes + Twelve Labs metadata as text prefix

### Rate Limits
- Free tier: 10 hours of video / month, 50 API calls / minute
- Paid tier: variable

---

## 3. Gemini 2.5 Flash (AI Analysis + Reranking + QC)

### Purpose
Three roles in the pipeline:
1. **Creative Director** - Analyze song mood/energy, generate captions
2. **Reranker** - Validate video-song match quality
3. **Quality Check** - Verify video meets production standards

### Model ID
`gemini-2.5-flash`

### Endpoint
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=API_KEY
```

### Python SDK Usage
```python
response = client.models.generate_content(
    model="gemini-2.5-flash",
    contents=[
        "Your prompt here",
        types.Part.from_bytes(data=video_bytes, mime_type="video/mp4")
    ]
)
result = response.text
```

### n8n HTTP Request Node
```json
{
  "method": "POST",
  "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={{ $env.GEMINI_API_KEY }}",
  "headers": { "Content-Type": "application/json" },
  "body": {
    "contents": [
      {
        "role": "user",
        "parts": [
          { "text": "Analyze this song..." },
          { "inline_data": { "mime_type": "audio/mpeg", "data": "BASE64" } }
        ]
      }
    ],
    "generationConfig": {
      "responseMimeType": "application/json",
      "temperature": 0.3
    }
  }
}
```

### Response Parsing
Always request JSON output and parse with error handling:
```python
import json
text = response.text
# Strip markdown code fences if present
if text.startswith("```"):
    text = text.split("\n", 1)[1].rsplit("```", 1)[0]
data = json.loads(text)
```

---

## 3. Spotify Web API

### Purpose
Fetch song metadata, audio features, and preview URLs.

### Auth Flow
Client Credentials (no user login needed):
```
POST https://accounts.spotify.com/api/token
Body: grant_type=client_credentials
Headers: Authorization: Basic base64(client_id:client_secret)
```

### Key Endpoints

**Get Track**
```
GET https://api.spotify.com/v1/tracks/{track_id}
Returns: name, artist, album, preview_url, duration_ms
```

**Get Audio Features**
```
GET https://api.spotify.com/v1/audio-features/{track_id}
Returns: bpm (tempo), energy, danceability, valence, acousticness, instrumentalness
```

**Get Playlist Tracks**
```
GET https://api.spotify.com/v1/playlists/{playlist_id}/tracks
Returns: array of track objects
```

### Useful Audio Feature Mappings
| Spotify Feature | Our System Mapping |
|----------------|--------------------|
| tempo | bpm |
| energy (0-1) | energy (scale to 1-10) |
| valence (0-1) | mood positivity |
| danceability (0-1) | pacing hint |
| acousticness (0-1) | genre hint |
| instrumentalness (0-1) | vocal/instrumental flag |

### n8n Spotify Node
n8n has a built-in Spotify node. Use it for:
- Get Track (by URL or ID)
- Get Audio Features
- Get Playlist Tracks

Configure with OAuth2 credentials in n8n credential store.

---

## 4. Supabase

### Purpose
Database, vector storage, file storage, and job tracking.

### Connection
```
URL: https://zgjdurqkcfxhsuyogosb.supabase.co
Service Key: stored in n8n credentials
```

### Key Operations

**Insert Video with Embedding**
```sql
INSERT INTO videos (filename, drive_file_id, drive_url, duration_seconds, bpm, embedding, mood_tags, energy_level, pacing, is_indexed)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true);
```

**Vector Similarity Search**
```sql
SELECT id, filename, drive_url, duration_seconds, bpm, mood_tags, energy_level, pacing,
       1 - (embedding <=> $1) AS cosine_similarity
FROM videos
WHERE is_indexed = true AND quality_passed = true
ORDER BY embedding <=> $1
LIMIT 15;
```

**Insert Match Result**
```sql
INSERT INTO matches (song_id, video_id, campaign_id, cosine_similarity, bpm_score, energy_score, mood_score, pacing_score, weighted_score, rerank_score, final_score, match_reason, rank)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13);
```

### n8n Supabase Node
Use the built-in Supabase node for simple CRUD.
For vector search, use the Postgres node with raw SQL (Supabase exposes a Postgres connection).

### Postgres Connection String (for vector queries)
```
Host: db.zgjdurqkcfxhsuyogosb.supabase.co
Port: 5432
Database: postgres
User: postgres
Password: [from Supabase dashboard]
SSL: required
```

---

## 5. Google Drive

### Purpose
Permanent storage for downloaded videos and rendered ad clips.

### n8n Google Drive Node
- **Upload** - Upload binary file to specific folder
- **Download** - Get file by ID
- **List** - List files in folder

### Folder Structure
```
Song-Video-Agent/
  ├── source_videos/      (raw TikTok downloads)
  ├── rendered_ads/        (Creatomate output)
  └── song_previews/       (Spotify preview downloads)
```

### Important Settings
- Share folder with n8n service account email
- Use folder ID, not folder name, in n8n nodes

---

## 6. Google Sheets

### Purpose
Human-friendly input/output layer. Two sheets:

### Sheet 1: Video Sources
| Column | Type | Description |
|--------|------|-------------|
| source_url | URL | TikTok or video link |
| status | Text | empty / ingested / indexed / failed |
| drive_file_id | Text | Google Drive file ID after upload |
| filename | Text | Assigned filename |
| bpm | Number | Detected BPM |
| indexed_at | DateTime | When embedding was created |

### Sheet 2: Campaigns
| Column | Type | Description |
|--------|------|-------------|
| campaign_id | Text | UUID |
| spotify_url | URL | Track or Playlist URL |
| target_countries | Text | Comma-separated: US,JP,DE |
| ads_needed | Number | How many ad variants |
| status | Text | empty / processing / completed / failed |
| output_urls | Text | Comma-separated Drive URLs of rendered ads |
| created_at | DateTime | Timestamp |

---

## 7. Creatomate

### Purpose
Render final ad videos by combining selected video + song + caption.

### Endpoint
```
POST https://api.creatomate.com/v1/renders
Authorization: Bearer CREATOMATE_API_KEY
```

### Request Body
```json
{
  "template_id": "TEMPLATE_ID",
  "modifications": {
    "Video-1": {
      "source": "https://drive.google.com/uc?id=FILE_ID"
    },
    "Audio-1": {
      "source": "SONG_URL_OR_DRIVE_LINK"
    },
    "Caption-1": {
      "text": "POV: when the beat drops and you're driving through Tokyo at 2am"
    }
  }
}
```

### Response
```json
{
  "id": "render_id",
  "status": "planned",
  "url": null
}
```

Poll for completion:
```
GET https://api.creatomate.com/v1/renders/RENDER_ID
```
When `status` = `succeeded`, `url` contains the final MP4.

### Template Requirements
- 9:16 vertical format (TikTok/Reels)
- Video layer with audio muted
- Audio layer for the song
- Text overlay layer for caption
- Duration: auto-trim to song length or video length (whichever is shorter)

---

## Environment Variables Summary

| Variable | Service | Required |
|----------|---------|----------|
| GEMINI_API_KEY | Google AI Studio | Yes |
| TWELVE_LABS_API_KEY | Twelve Labs | Yes (for video indexing) |
| SUPABASE_URL | Supabase | Yes |
| SUPABASE_SERVICE_KEY | Supabase | Yes |
| SPOTIFY_CLIENT_ID | Spotify | Yes (for campaigns) |
| SPOTIFY_CLIENT_SECRET | Spotify | Yes (for campaigns) |
| GOOGLE_DRIVE_FOLDER_ID | Google Drive | Yes |
| CREATOMATE_API_KEY | Creatomate | Yes (for rendering) |
| CREATOMATE_TEMPLATE_ID | Creatomate | Yes (for rendering) |
