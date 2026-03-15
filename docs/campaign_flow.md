# Song-to-Video Flow - End-to-End Pipeline

## What Does It Do?
You upload a song → the AI finds the best matching video from the database → strips the original audio → adds your song → generates vibe-matching quote captions → renders the final video.

---

## Complete Flow Diagram

```
[Upload Song (audio file)]
         |
         v
[Embed Song - Gemini Embedding 2]
    Convert song to 3072-dim vector
         |
         v
[Vibe Matching Engine]
    pgvector search -> top 15 candidates
    Weighted scoring (cosine + bpm + energy + mood + pacing)
    Deduplication
    AI reranking (Gemini 2.5 Flash)
    Select best match
         |
         v
[Audio Replacement]
    Strip original audio from matched video
    Overlay uploaded song (sync to video duration)
         |
         v
[Quote Caption Generation - Gemini 2.5 Flash]
    Analyze song vibe
    Generate aesthetic/motivational quote text overlays
    (NOT song lyrics — think Instagram/TikTok style quotes)
         |
         v
[Final Render]
    Combine: video + song + quote captions → MP4
         |
         v
[Output]
    Final video saved to Google Drive
    Match history logged in Supabase
```

---

## Data Flow Through Stages

### Input (Song Upload)
```json
{
  "song_file": "midnight_drive.mp3",
  "song_name": "Midnight Drive",
  "artist": "Artist Name"
}
```

### After Song Embedding
```json
{
  "song_embedding": [0.012, -0.034, ...],
  "bpm": 128,
  "energy": 8,
  "mood": "euphoric"
}
```

### After Vibe Matching
```json
{
  "best_match": {
    "video_id": "uuid-1",
    "filename": "city_drive_neon.mp4",
    "drive_url": "https://drive.google.com/...",
    "final_score": 0.91,
    "match_reason": "Night city driving visuals with neon reflections perfectly match the synthwave energy at 128 BPM"
  }
}
```

### After Audio Replacement
```json
{
  "processed_video": "city_drive_neon_replaced.mp4",
  "original_audio": "stripped",
  "new_audio": "midnight_drive.mp3",
  "duration_synced": true
}
```

### After Quote Caption Generation
```json
{
  "quotes": [
    {
      "text": "Some drives don't need a destination",
      "timestamp": "0:03",
      "style": "aesthetic"
    },
    {
      "text": "Turn up the volume, turn off the world",
      "timestamp": "0:08",
      "style": "motivational"
    }
  ]
}
```

### After Final Render
```json
{
  "output_file": "midnight_drive_final.mp4",
  "video_used": "city_drive_neon.mp4",
  "song": "midnight_drive.mp3",
  "quotes_added": 2,
  "drive_url": "https://drive.google.com/file/d/RENDERED_ID_1",
  "status": "completed"
}
```

---

## n8n Node-by-Node Implementation

### 1. Song Embedding
```
Song Upload (Webhook or Manual Trigger)
  -> Code Node: Prepare audio binary + BPM text prefix
  -> HTTP Request: Gemini Embedding 2 API call
  -> Code Node: Extract and normalize the 3072-dim vector
```

### 2. Vector Search + Matching
```
Postgres Node: Run pgvector cosine similarity query (match_videos())
  -> Code Node: Calculate weighted scores
  -> Code Node: Deduplicate and rank
  -> Output: best match with scores
```

### 3. AI Reranking (Optional)
```
Split In Batches: Process top 8 candidates
  -> Google Drive: Download candidate video
  -> Gemini 2.5 Flash: Score video-song match
  -> Merge: Combine rerank scores
  -> Code Node: Final ranking with rerank adjustment
```

### 4. Audio Replacement
```
Google Drive: Download matched video
  -> Code Node (FFmpeg): Strip original audio
  -> Code Node (FFmpeg): Overlay uploaded song, sync duration
  -> Output: video with new audio
```

### 5. Quote Caption Generation
```
Gemini 2.5 Flash (HTTP Request):
  Input: song vibe analysis + video description
  Output: JSON with quote captions, timestamps, styles
  (NOT lyrics — aesthetic/motivational quotes matching the vibe)
```

### 6. Final Render
```
Code Node (FFmpeg) or Creatomate:
  Combine: video + song + quote text overlays -> final MP4
  -> Google Drive: Upload rendered MP4
  -> Supabase: Log match and render result
```

---

## Error Recovery

### What if no video passes matching threshold?
- Lower the score threshold
- Expand search to top 20 candidates instead of top 15
- Log the failure and notify for manual review

### What if audio replacement fails?
- Check song format compatibility (convert to WAV if needed)
- Handle duration mismatch (trim or loop song to fit video)
- Retry with different FFmpeg settings

### What if Gemini API fails?
- Retry with exponential backoff (built into n8n HTTP Request node)
- After 3 failures, mark as `failed` and log error
- Store error in `processing_logs` table

---

## Timing Estimates (Per Song)

| Stage | Approximate Time |
|-------|-----------------|
| Song embedding | 3-5s |
| Vector search | 1s |
| Weighted scoring | < 1s |
| AI reranking (8 videos) | 30-60s |
| Audio replacement (FFmpeg) | 5-15s |
| Quote caption generation | 5-10s |
| Final render | 15-60s |
| Upload to Drive | 5s |
| **Total** | **~1-3 minutes** |

---

## Status Lifecycle
```
uploaded -> embedding -> matching -> audio_replacing -> captioning -> rendering -> completed
                     \-> failed (at any point, with reason logged)
```
