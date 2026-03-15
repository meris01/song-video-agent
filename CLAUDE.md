# Song Video Agent

## Purpose
AI agent that matches uploaded songs to stored video clips, replaces the original audio with the song, adds AI-generated quote captions, and renders a final video.
Runs as a 5-stage n8n pipeline with Gemini Embedding 2 as the core AI engine.

## System Overview
1. **Video Ingestion + Embedding** - Download videos, analyze with Twelve Labs, embed with Gemini Embedding 2, store in Supabase pgvector
2. **Song Upload + Matching** - Upload a song, embed it, find best matching video via pgvector + weighted scoring + AI reranking
3. **Audio Replacement** - Strip original audio from matched video, overlay the uploaded song
4. **Quote Caption Generation** - Gemini 2.5 Flash generates vibe-matching quote text overlays (NOT song lyrics — aesthetic/motivational quotes)
5. **Final Render** - Combine matched video + uploaded song + quote captions → output MP4

## Core Tech Stack
- **Orchestration:** n8n
- **Embedding:** Gemini Embedding 2 (3072-dim, multimodal)
- **Video Understanding:** Twelve Labs (audio & visual analysis for indexing)
- **AI Analysis:** Gemini 2.5 Flash
- **Vector DB:** Supabase pgvector (production) / FAISS (local dev)
- **File Storage:** Google Drive
- **Audio/Video Processing:** FFmpeg / moviepy (audio replacement, rendering)
- **Rendering:** Creatomate (optional) / FFmpeg
- **Web UI:** React + Vite + Tailwind CSS (webapp)
- **Backend:** FastAPI
- **Legacy UI:** Streamlit

## Matching Formula
```
final_score = 0.55 * cosine + 0.15 * bpm + 0.15 * energy + 0.10 * mood + 0.05 * pacing
```
Then AI reranking: `0.6 * weighted_score + 0.4 * rerank_score`

## Current Project Files

### Webapp (Primary)
- `webapp/backend/main.py` - FastAPI backend with all API routes
- `webapp/frontend/` - React + Vite + Tailwind frontend
  - Pages: Dashboard, Settings, VideoLibrary, SongMatcher, RenderStudio
  - Components: Layout, Sidebar, Card, Button, StatusBadge

### Legacy Code
- `app.py` - Streamlit song-to-video matcher UI
- `build_video_db.py` - Local FAISS video index builder
- `song_video_agent/` - Python package (config, gemini_client, audio_utils, video_utils, index_utils)

### Documentation
- `docs/architecture.md` - Full 6-stage system architecture
- `docs/n8n_workflow.md` - Complete n8n workflow reference (all 6 stages with node details)
- `docs/embedding_pipeline.md` - Gemini Embedding 2 pipeline (songs + videos)
- `docs/matching_engine.md` - Weighted scoring, deduplication, AI reranking
- `docs/campaign_flow.md` - End-to-end campaign pipeline with data shapes
- `docs/api_reference.md` - All API integrations (Gemini, Spotify, Supabase, Drive, Creatomate)
- `docs/agent_playbook.md` - AI agent working style rules
- `docs/decisions.md` - Technical decision log (D-001 through D-012)
- `docs/current_state.md` - What exists, what needs building, priorities
- `docs/runbook.md` - Setup and run commands
- `docs/supabase.md` - Supabase connection and MCP setup
- `docs/session_handoff.md` - Session resume guide
- `docs/todo.md` - Implementation task list

### Database
- `sql/supabase_schema.sql` - Full schema: videos, songs, campaigns, matches, rendered_ads, processing_logs + pgvector indexes + match_videos() function

## Session Startup Rule
At the start of future sessions, read only:
1. `CLAUDE.md` (this file)
2. `docs/current_state.md`
3. `docs/runbook.md`
4. Then open task-specific docs as needed

## Agent Behavior Rules
- Prefer small, testable steps
- Document important decisions in `docs/decisions.md`
- Update `docs/current_state.md` after meaningful progress
- Keep the local Streamlit app runnable while building n8n pipeline
- When modifying matching logic, update `docs/matching_engine.md`
- When modifying n8n workflow, update `docs/n8n_workflow.md`
- When adding/changing APIs, update `docs/api_reference.md`
- Prefer practical working solutions over complex architecture

## Key Design Decisions
- Gemini Embedding 2 for both song AND video embeddings (same vector space)
- Multi-signal weighted scoring (not just cosine similarity)
- AI reranking with Gemini 2.5 Flash catches false positives
- Audio replacement: strip original video audio, overlay uploaded song perfectly
- Quote captions: AI-generated aesthetic/motivational quotes matching the song vibe (NOT lyrics)
- Quality control gate before rendering (vertical check, watermark check)

## Supabase Project
- **Ref:** `zgjdurqkcfxhsuyogosb`
- **Region:** ap-south-1
- **URL:** `https://zgjdurqkcfxhsuyogosb.supabase.co`
- **Schema:** Deployed (2026-03-14) - 6 tables, pgvector, match_videos()
- **MCP:** Connected via `.mcp.json`

## Environment Variables
```
GEMINI_API_KEY           - Google AI Studio
TWELVE_LABS_API_KEY      - Twelve Labs video understanding
SUPABASE_URL             - https://zgjdurqkcfxhsuyogosb.supabase.co
SUPABASE_SERVICE_KEY     - Supabase service role key
SPOTIFY_CLIENT_ID        - Spotify API
SPOTIFY_CLIENT_SECRET    - Spotify API
GOOGLE_DRIVE_FOLDER_ID   - Target Drive folder
CREATOMATE_API_KEY       - Creatomate rendering
CREATOMATE_TEMPLATE_ID   - Creatomate template
```

## Implementation Priority
1. ~~Run SQL schema in Supabase~~ DONE (2026-03-14)
2. Build Video Ingestion + Embedding pipeline (store videos in Supabase)
3. Build Song Upload + Matching (upload song → find best match)
4. Build Audio Replacement (strip original audio, add uploaded song)
5. Build Quote Caption Generation (AI-generated vibe quotes, not lyrics)
6. Build Final Render (video + song + quotes → MP4)
7. End-to-end testing

## Things To Avoid
- Building everything in one file
- Hidden prompt logic with no documentation
- Overly complex ranking before baseline works
- Storing embeddings without metadata
- Making recommendations without explaining scores
- Skipping quality control before rendering
