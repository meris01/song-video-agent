# n8n Workflow Reference

## Overview
The system runs as a 6-stage n8n pipeline. Each stage is a separate node group.
All stages communicate via n8n data passing and shared Supabase state.

---

## Stage 1: Video Library Builder (Ingestion)

### Purpose
Ingest new TikTok/video links into the system and store them permanently.

### Trigger
Google Sheets webhook or schedule trigger watches the "Video Sources" sheet.

### Steps
1. **Read Google Sheet** - Fetch rows where `status` is empty or `new`
2. **Download Video** - Use HTTP Request node to download MP4 (watermark-free)
3. **Upload to Google Drive** - Store permanent copy in a shared Drive folder
4. **Update Sheet** - Mark row status as `ingested`, save Drive file ID
5. **Pass to Stage 2** - Forward video binary + metadata to indexing

### n8n Nodes Used
- Google Sheets (read/update)
- HTTP Request (video download)
- Google Drive (upload)
- Set node (prepare metadata)

### Data Shape Output
```json
{
  "video_id": "uuid",
  "source_url": "https://...",
  "drive_file_id": "abc123",
  "drive_url": "https://drive.google.com/...",
  "filename": "video_001.mp4",
  "status": "ingested"
}
```

---

## Stage 2: Search Engine (Indexing with Twelve Labs + Gemini Embedding 2)

### Purpose
Analyze each video's audio and visuals, create a vector embedding, and store in Supabase for search.

### Steps
1. **Download from Drive** - Get the video MP4 binary
2. **Send to Twelve Labs** - Create a video understanding task for audio & visual analysis
3. **Extract Metadata from Twelve Labs** - Get scene descriptions, mood, energy, detected audio characteristics
4. **Embed Video with Gemini** - Send video bytes + Twelve Labs metadata to `gemini-embedding-2` model
5. **Detect BPM** - Analyze audio tempo (via Twelve Labs audio analysis or Code node)
6. **Store in Supabase** - Insert video metadata + embedding vector into `videos` table
7. **Update Sheet** - Mark source row as `indexed`

### Gemini Embedding Call (HTTP Request node)
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent
Authorization: Bearer {{ $env.GEMINI_API_KEY }}

Body:
{
  "content": {
    "parts": [
      { "text": "BPM around 120, rhythmic feel aligned to this tempo." },
      { "inline_data": { "mime_type": "video/mp4", "data": "BASE64_VIDEO_DATA" } }
    ]
  },
  "embeddingConfig": {
    "outputDimensionality": 3072
  }
}
```

### Data Shape Output
```json
{
  "video_id": "uuid",
  "filename": "video_001.mp4",
  "duration_seconds": 15.2,
  "bpm": 120,
  "embedding": [0.012, -0.034, ...],
  "drive_file_id": "abc123",
  "indexed_at": "2026-03-14T..."
}
```

### Important Notes
- Videos longer than 120 seconds must be chunked (100s chunks, 20s overlap)
- Each chunk is embedded separately, then averaged into one vector
- The averaged vector is L2-normalized before storage
- BPM text prefix is optional but improves rhythm-aware matching

---

## Stage 3: Campaign Trigger

### Purpose
Watch for new campaign requests and determine what kind of input was provided.

### Trigger
Google Sheets schedule trigger watches the "Campaigns" sheet.

### Steps
1. **Read Campaigns Sheet** - Fetch rows where `status` is empty
2. **Check Input Type** - IF node: is the input a Spotify Track URL or Playlist URL?
3. **Route** - Single track goes to Stage 4 directly. Playlist triggers a loop over all tracks.

### Data Shape Output
```json
{
  "campaign_id": "uuid",
  "spotify_url": "https://open.spotify.com/track/...",
  "input_type": "track",
  "target_countries": ["US", "JP", "DE"],
  "ads_needed": 3,
  "status": "processing"
}
```

### Campaigns Sheet Columns
| Column | Description |
|--------|-------------|
| campaign_id | Auto-generated UUID |
| spotify_url | Track or Playlist URL |
| target_countries | Comma-separated country codes |
| ads_needed | Number of ad variants to generate |
| status | empty / processing / completed / failed |
| created_at | Timestamp |

---

## Stage 4: AI Creative Director (Gemini)

### Purpose
Analyze the song deeply and generate creative direction for video matching.

### Steps
1. **Fetch Spotify Data** - Use Spotify API to get track metadata (name, artist, preview URL, audio features)
2. **Download Preview Audio** - Get the 30s preview MP3 from Spotify
3. **Analyze with Gemini 2.5 Flash** - Send audio + metadata to Gemini for creative analysis
4. **Generate Captions** - AI writes 3 viral POV captions per target country
5. **Extract Visual Keywords** - AI suggests visual search terms for video matching
6. **Store Analysis** - Save song features and creative brief in Supabase

### Gemini Creative Analysis Prompt
```
You are a viral music marketing creative director.

Listen to this song and analyze:
1. Overall mood and emotional tone
2. Energy level (1-10)
3. Genre and style
4. Lyric themes (if vocals present)
5. Visual associations - what scenes/aesthetics match this sound?
6. Pacing - is it slow/dreamy, medium/groovy, or fast/intense?

Song: {{ $json.track_name }} by {{ $json.artist_name }}
BPM: {{ $json.bpm }}
Genre hints: {{ $json.spotify_genres }}
Target countries: {{ $json.target_countries }}

Return JSON:
{
  "mood": "string",
  "energy": 1-10,
  "genre_tags": ["tag1", "tag2"],
  "lyric_themes": ["theme1", "theme2"],
  "visual_keywords": ["girl driving", "sunset cityscape", "dancing in rain"],
  "pacing": "slow|medium|fast",
  "emotional_tone": "string",
  "captions": {
    "US": ["caption1", "caption2", "caption3"],
    "JP": ["caption1", "caption2", "caption3"]
  }
}
```

### Data Shape Output
```json
{
  "song_id": "uuid",
  "track_name": "Song Title",
  "artist": "Artist Name",
  "bpm": 128,
  "mood": "euphoric",
  "energy": 8,
  "visual_keywords": ["girl driving", "neon city", "rooftop party"],
  "pacing": "fast",
  "captions": { "US": ["POV: ...", "POV: ...", "POV: ..."] },
  "song_embedding": [0.023, -0.011, ...]
}
```

---

## Stage 5: Vibe Matching Engine

### Purpose
Find the best matching videos from the database for a given song.

### Steps
1. **Embed Song Audio** - Send song audio to `gemini-embedding-2` to get song vector
2. **Vector Search in Supabase** - Use pgvector cosine similarity to find top 15 candidates
3. **Apply Weighted Scoring** - Combine vector similarity + BPM match + mood/energy signals
4. **Deduplicate** - Remove near-duplicate videos (same source, different chunks)
5. **Select Top 5** - Pick the absolute best matches
6. **Store Results** - Save match records in Supabase `matches` table

### Supabase Vector Search Query
```sql
SELECT
  v.id,
  v.filename,
  v.drive_file_id,
  v.duration_seconds,
  v.bpm,
  v.mood_tags,
  1 - (v.embedding <=> $1) AS cosine_similarity
FROM videos v
WHERE v.is_indexed = true
ORDER BY v.embedding <=> $1
LIMIT 15;
```

### Weighted Scoring Formula
```
final_score = (
  0.55 * cosine_similarity +
  0.15 * bpm_score +
  0.15 * energy_score +
  0.10 * mood_score +
  0.05 * pacing_score
)
```

**bpm_score** = 1.0 - min(abs(song_bpm - video_bpm) / 40.0, 1.0)
**energy_score** = 1.0 - abs(song_energy - video_energy) / 10.0
**mood_score** = jaccard similarity between mood tags
**pacing_score** = 1.0 if same pacing category, 0.5 if adjacent, 0.0 if opposite

### Data Shape Output
```json
{
  "song_id": "uuid",
  "matches": [
    {
      "rank": 1,
      "video_id": "uuid",
      "filename": "video_042.mp4",
      "cosine_similarity": 0.87,
      "bpm_score": 0.92,
      "final_score": 0.86,
      "match_reason": "High energy electronic beat matches fast-paced city driving visuals"
    }
  ]
}
```

---

## Stage 6: Quality Control and Production

### Purpose
Validate selected videos and render final ad clips.

### Steps
1. **Download Winner Video** - Get MP4 from Google Drive
2. **AI Quality Check** - Send video to Gemini 2.5 Flash for validation:
   - Is it vertical (9:16)?
   - Does it have burned-in text/watermark?
   - Is the quality acceptable?
3. **Reject or Accept** - If rejected, fall back to next best match
4. **Send to Creatomate** - Combine: winner video + AI caption + song audio
5. **Render Final MP4** - Creatomate produces the final ad video
6. **Upload Result** - Store rendered video in Google Drive and update campaign status
7. **Update Campaign Sheet** - Mark campaign as `completed` with output URLs

### Gemini Quality Check Prompt
```
Analyze this video for ad production quality:
1. Is the video vertical (9:16 aspect ratio)?
2. Does it contain burned-in text, watermarks, or logos?
3. Is the visual quality acceptable (not blurry, not too dark)?
4. Is there any content that would be inappropriate for advertising?

Return JSON:
{
  "is_vertical": true/false,
  "has_text_overlay": true/false,
  "quality_acceptable": true/false,
  "is_appropriate": true/false,
  "pass": true/false,
  "rejection_reason": "string or null"
}
```

### Creatomate API Call
```json
{
  "template_id": "YOUR_TEMPLATE_ID",
  "modifications": {
    "Video": { "source": "DRIVE_VIDEO_URL" },
    "Audio": { "source": "SONG_AUDIO_URL" },
    "Caption": { "text": "POV: when the beat drops and you're driving through Tokyo at 2am" }
  }
}
```

---

## Error Handling Strategy

### Per-Stage Retry
Each stage should have an Error Trigger node that:
1. Logs the error to Supabase `processing_logs` table
2. Updates the relevant sheet row status to `failed`
3. Sends notification (optional: Slack/email)

### Retry Policy
- API calls: retry 3 times with exponential backoff (1s, 3s, 9s)
- Gemini rate limits: add Wait node with 2s delay between embedding calls
- Download failures: retry once, then mark as `failed`

### Status Tracking
Every entity has a `status` field that follows this lifecycle:
```
new -> processing -> indexed/analyzed -> matched -> rendered -> completed
                  \-> failed (at any stage)
```

---

## Environment Variables Required in n8n
```
GEMINI_API_KEY          - Google AI Studio API key
TWELVE_LABS_API_KEY     - Twelve Labs video understanding API key
SUPABASE_URL            - https://zgjdurqkcfxhsuyogosb.supabase.co
SUPABASE_SERVICE_KEY    - Supabase service role key
GOOGLE_DRIVE_FOLDER_ID  - Target folder for video storage
SPOTIFY_CLIENT_ID       - Spotify API client ID
SPOTIFY_CLIENT_SECRET   - Spotify API client secret
CREATOMATE_API_KEY      - Creatomate rendering API key
```
