# Matching Engine - Vibe Matching and Scoring

## Overview
The matching engine takes a song and finds the best 5 videos from the library.
It uses a multi-signal weighted scoring approach, not just raw vector similarity.

---

## Matching Pipeline

```
Song Upload
    |
    v
[1] Embed Song (Gemini Embedding 2)
    |
    v
[2] Vector Search (top 15 candidates from Supabase pgvector)
    |
    v
[3] Feature Extraction (BPM, mood, energy from AI analysis)
    |
    v
[4] Weighted Scoring (combine all signals)
    |
    v
[5] Deduplication (remove near-duplicate videos)
    |
    v
[6] AI Reranking (Gemini 2.5 Flash validates top candidates)
    |
    v
[7] Final Top 5 with explanations
```

---

## Step 1: Vector Search (Candidate Retrieval)

### Supabase pgvector Query
```sql
SELECT
  v.id,
  v.filename,
  v.drive_file_id,
  v.drive_url,
  v.duration_seconds,
  v.bpm,
  v.mood_tags,
  v.energy_level,
  v.pacing,
  1 - (v.embedding <=> $1) AS cosine_similarity
FROM videos v
WHERE v.is_indexed = true
  AND v.quality_passed = true
ORDER BY v.embedding <=> $1
LIMIT 15;
```

### Local FAISS Query (Development)
```python
scores, indices = index.search(query_vector.reshape(1, -1), 15)
# scores are inner product values (= cosine similarity when normalized)
```

### Why 15 candidates?
- We need 5 final results
- Some may be rejected by quality check or deduplication
- 15 gives enough buffer for filtering while keeping compute cost low

---

## Step 2: Weighted Scoring

### Formula
```
final_score = (
    W_cosine  * cosine_similarity  +
    W_bpm     * bpm_score          +
    W_energy  * energy_score       +
    W_mood    * mood_score         +
    W_pacing  * pacing_score
)
```

### Default Weights
| Signal | Weight | Rationale |
|--------|--------|-----------|
| cosine_similarity | 0.55 | Primary semantic signal from Gemini embeddings |
| bpm_score | 0.15 | Rhythm alignment is critical for music videos |
| energy_score | 0.15 | High-energy songs need high-energy visuals |
| mood_score | 0.10 | Emotional tone should match |
| pacing_score | 0.05 | Scene pacing should feel natural with the beat |

### Individual Score Calculations

**BPM Score** (0 to 1)
```python
def bpm_score(song_bpm, video_bpm):
    if song_bpm is None or video_bpm is None:
        return 0.5  # neutral when unknown
    diff = abs(song_bpm - video_bpm)
    # Perfect match = 1.0, 40+ BPM difference = 0.0
    return max(0.0, 1.0 - diff / 40.0)
```

**Energy Score** (0 to 1)
```python
def energy_score(song_energy, video_energy):
    # Both are 1-10 scale
    if song_energy is None or video_energy is None:
        return 0.5
    return 1.0 - abs(song_energy - video_energy) / 10.0
```

**Mood Score** (0 to 1)
```python
def mood_score(song_mood_tags, video_mood_tags):
    if not song_mood_tags or not video_mood_tags:
        return 0.5
    s1 = set(song_mood_tags)
    s2 = set(video_mood_tags)
    if not s1 or not s2:
        return 0.5
    # Jaccard similarity
    return len(s1 & s2) / len(s1 | s2)
```

**Pacing Score** (0, 0.5, or 1.0)
```python
PACING_MAP = {"slow": 0, "medium": 1, "fast": 2}

def pacing_score(song_pacing, video_pacing):
    if song_pacing is None or video_pacing is None:
        return 0.5
    s = PACING_MAP.get(song_pacing, 1)
    v = PACING_MAP.get(video_pacing, 1)
    diff = abs(s - v)
    if diff == 0:
        return 1.0
    if diff == 1:
        return 0.5
    return 0.0
```

---

## Step 3: Deduplication

Videos from the same source (same TikTok creator, same scene) should not appear twice.

### Strategy
```python
def deduplicate(results):
    seen_sources = set()
    unique = []
    for r in results:
        source_key = r.get("source_url") or r["filename"]
        # Also check embedding similarity between candidates
        is_duplicate = False
        for existing in unique:
            sim = np.dot(r["embedding"], existing["embedding"])
            if sim > 0.95:  # near-identical content
                is_duplicate = True
                break
        if source_key not in seen_sources and not is_duplicate:
            seen_sources.add(source_key)
            unique.append(r)
    return unique
```

---

## Step 4: AI Reranking (Optional but Recommended)

### Purpose
Use Gemini 2.5 Flash to validate that the top candidates actually look good with the song.
This catches cases where vector similarity is high but the visual fit is poor.

### Prompt
```
You are a music video editor reviewing a potential match.

Song: {track_name} by {artist} ({bpm} BPM, {mood} mood, {energy}/10 energy)
Visual keywords the creative director suggested: {visual_keywords}

Watch this video clip and rate how well it works as background visuals for this song.

Consider:
- Does the visual energy match the song energy?
- Does the pacing of scene changes match the beat?
- Does the mood/aesthetic complement the song?
- Would this look good in a TikTok/Reels ad?

Return JSON:
{
  "score": 0.0-1.0,
  "reason": "brief explanation",
  "confidence": "high/medium/low"
}
```

### Reranking Rules
- Only rerank the top 8 candidates (saves API cost)
- If rerank_score differs from vector score by more than 0.3, flag for review
- Final ranking uses: `0.6 * weighted_score + 0.4 * rerank_score`

---

## Step 5: Final Output

### Top 5 Result Format
```json
{
  "song_id": "uuid",
  "campaign_id": "uuid",
  "matches": [
    {
      "rank": 1,
      "video_id": "uuid",
      "filename": "sunset_drive_001.mp4",
      "drive_url": "https://drive.google.com/...",
      "cosine_similarity": 0.87,
      "bpm_score": 0.92,
      "energy_score": 0.85,
      "mood_score": 0.75,
      "pacing_score": 1.0,
      "weighted_score": 0.86,
      "rerank_score": 0.91,
      "final_score": 0.88,
      "match_reason": "High energy electronic beat with 128 BPM matches the fast-paced city driving visuals. Sunset lighting complements the euphoric mood."
    }
  ]
}
```

### Match Explanation Template
The AI should explain each match using this structure:
1. What makes the rhythm/tempo work
2. What makes the visual energy work
3. What makes the mood/aesthetic work
4. Any concerns or trade-offs

---

## Tuning the Weights

### When to adjust weights
- If users consistently prefer videos that don't rank #1, the weights need tuning
- Track user selections vs system rankings in the `match_feedback` table
- Periodically analyze: do users pick the #1 result or do they prefer #3-5?

### Suggested experiments
1. **Baseline:** Use default weights, measure user satisfaction
2. **BPM-heavy:** Increase BPM weight to 0.25 for dance/EDM songs
3. **Mood-heavy:** Increase mood weight to 0.20 for ambient/emotional songs
4. **Vector-only:** Set cosine to 1.0 to test pure embedding quality

### Genre-specific weight overrides
```json
{
  "edm": {"cosine": 0.45, "bpm": 0.25, "energy": 0.15, "mood": 0.10, "pacing": 0.05},
  "ambient": {"cosine": 0.50, "bpm": 0.05, "energy": 0.10, "mood": 0.25, "pacing": 0.10},
  "hiphop": {"cosine": 0.50, "bpm": 0.20, "energy": 0.15, "mood": 0.10, "pacing": 0.05},
  "pop": {"cosine": 0.55, "bpm": 0.15, "energy": 0.15, "mood": 0.10, "pacing": 0.05}
}
```
