# Runbook

## Local Development Setup

### Install Python Dependencies
```bash
pip install -r requirements.txt
```

### Environment Variables
Create `.env` file:
```
GEMINI_API_KEY=your_key_here
TWELVE_LABS_API_KEY=your_key_here
SUPABASE_URL=https://zgjdurqkcfxhsuyogosb.supabase.co
SUPABASE_SERVICE_KEY=your_service_key
SPOTIFY_CLIENT_ID=your_client_id
SPOTIFY_CLIENT_SECRET=your_client_secret
GOOGLE_DRIVE_FOLDER_ID=your_folder_id
CREATOMATE_API_KEY=your_key
CREATOMATE_TEMPLATE_ID=your_template_id
```

### Build Local Video Index
```bash
python build_video_db.py --videos-dir ./videos --index-dir ./artifacts/video_index --hybrid-bpm-prefix
```

### Launch Streamlit App
```bash
streamlit run app.py
```

## Supabase Setup

### Create Tables (DONE)
Schema deployed via MCP migration on 2026-03-14.
- Project: `zgjdurqkcfxhsuyogosb` (song-video-agent, ap-south-1)
- All 6 tables created: videos, songs, campaigns, matches, rendered_ads, processing_logs
- Functions: match_videos(), update_updated_at()
- Triggers: videos_updated_at, campaigns_updated_at

### Test Vector Search
```sql
-- Insert a test video (replace embedding with real 3072-dim vector)
INSERT INTO videos (filename, bpm, is_indexed, embedding)
VALUES ('test.mp4', 120, true, '[0.01, 0.02, ...]'::vector);

-- Test search (replace with real query vector)
SELECT * FROM match_videos('[0.01, 0.02, ...]'::vector, 0.3, 5);
```

## n8n Setup

### Required Credentials in n8n
1. **Google Sheets** - OAuth2 with Sheets API access
2. **Google Drive** - OAuth2 with Drive API access
3. **Spotify** - OAuth2 with Web API access
4. **Supabase / Postgres** - Connection string from Supabase dashboard
5. **Creatomate** - API key in Header Auth

### n8n Environment Variables
Set in n8n Settings > Environment Variables:
```
GEMINI_API_KEY
TWELVE_LABS_API_KEY
SUPABASE_URL=https://zgjdurqkcfxhsuyogosb.supabase.co
SUPABASE_SERVICE_KEY
```

### Build Order for n8n Workflows
1. Stage 1+2: Video Ingestion + Indexing (see `docs/n8n_workflow.md`)
2. Stage 5: Vibe Matching (see `docs/matching_engine.md`)
3. Stage 3+4: Campaign Trigger + AI Creative Director
4. Stage 6: Quality Control + Render
5. Wire all stages together

## Expected Folders

### Local
- `./videos/` - Source video clips for local testing
- `./artifacts/video_index/` - FAISS index output
- `./artifacts/tmp/` - Temporary chunk files

### Google Drive
- `source_videos/` - Downloaded TikTok videos
- `rendered_ads/` - Final rendered ad MP4s
- `song_previews/` - Spotify preview downloads

### Google Sheets
- "Video Sources" sheet - TikTok links + ingestion status
- "Campaigns" sheet - Campaign requests + status

## Quick Debug Path

### If local search fails
1. Check `.env` has valid `GEMINI_API_KEY`
2. Confirm `./videos/` contains MP4 files
3. Rebuild index: `python build_video_db.py --videos-dir ./videos`
4. Rerun Streamlit: `streamlit run app.py`

### If n8n workflow fails
1. Check n8n execution log for the specific failed node
2. Check API rate limits (Gemini: 1500 RPM paid, 100 RPM free)
3. Check Supabase connection (is the service key correct?)
4. Check Google OAuth tokens (may need re-authentication)
5. Check `processing_logs` table in Supabase for error details

### If vector search returns no results
1. Verify videos have `is_indexed = true` in Supabase
2. Lower the `match_threshold` in `match_videos()` call
3. Check that embeddings are not all zeros
4. Verify embedding dimensions are 3072

## Supported Media
- Songs: MP3, WAV
- Videos: MP4, MOV, M4V, WebM, AVI, MKV
