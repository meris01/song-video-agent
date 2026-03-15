# Current State

## Status
Database is live in Supabase. Local code is working. n8n pipeline design is complete, ready to build.

## Supabase Project
- **Name:** song-video-agent
- **Ref:** `zgjdurqkcfxhsuyogosb`
- **Region:** ap-south-1
- **Schema:** Deployed via MCP migration (2026-03-14)
- **Tables:** videos, songs, campaigns, matches, rendered_ads, processing_logs (all 0 rows)
- **Functions:** match_videos(), update_updated_at()
- **Triggers:** videos_updated_at, campaigns_updated_at

## What Exists (Code)
- `build_video_db.py` - Scans videos, chunks long files, embeds with Gemini, builds FAISS index
- `app.py` - Streamlit UI for song upload, embedding, FAISS search, previews, optional reranking
- `song_video_agent/` package:
  - `config.py` - AppConfig with env vars
  - `gemini_client.py` - Gemini Embedding 2 + Flash reranking
  - `audio_utils.py` - BPM detection, audio chunking, WAV conversion
  - `video_utils.py` - Video scanning, chunking, embedding
  - `index_utils.py` - FAISS index create/save/load/search
- `sql/supabase_schema.sql` - Full Supabase schema (deployed)

## What Exists (Documentation)
- `CLAUDE.md` - Project memory and agent instructions
- `docs/architecture.md` - Full 6-stage system architecture
- `docs/n8n_workflow.md` - Complete n8n workflow reference (all 6 stages)
- `docs/embedding_pipeline.md` - Gemini Embedding 2 pipeline for songs and videos
- `docs/matching_engine.md` - Weighted scoring, deduplication, AI reranking
- `docs/campaign_flow.md` - End-to-end campaign pipeline with data shapes
- `docs/api_reference.md` - All external API integrations
- `docs/agent_playbook.md` - AI agent working style rules
- `docs/decisions.md` - Technical decision log (D-001 to D-012)
- `docs/runbook.md` - Setup and run commands
- `docs/supabase.md` - Supabase connection and MCP setup
- `docs/session_handoff.md` - Session resume guide
- `docs/todo.md` - Implementation task list

## Confirmed Setup
- Gemini API key in local `.env`
- Supabase MCP connected via Claude Code (.mcp.json)
- Supabase schema deployed and verified
- n8n workflow structure designed (6 stages)

## What Works Locally
- Song upload and embedding via Streamlit
- Video scanning and FAISS index building
- Cosine similarity search
- Optional BPM text prefix boost
- Optional Gemini 2.5 Flash reranking

## Webapp (NEW - 2026-03-15)
Full-stack webapp built with FastAPI + React + Tailwind CSS.

### Structure
- `webapp/backend/main.py` - FastAPI backend (all API routes)
- `webapp/frontend/` - React + Vite + Tailwind frontend
  - `src/pages/Dashboard.jsx` - Overview with stats and how-it-works guide
  - `src/pages/Settings.jsx` - Supabase connection, API keys, one-click schema deploy
  - `src/pages/VideoLibrary.jsx` - Upload, embed, browse videos
  - `src/pages/SongMatcher.jsx` - Upload song, find top 5 matching videos
  - `src/pages/RenderStudio.jsx` - Generate quotes, replace audio, render final video
  - `src/components/` - Shared UI components (Layout, Sidebar, Card, Button, StatusBadge)

### Features
- Connect your own Supabase project
- One-click schema deployment
- Drag & drop video upload with Gemini embedding
- Song upload → AI-powered matching (cosine + weighted scoring)
- Quote caption generation (motivational/aesthetic/poetic styles)
- Audio replacement + quote overlay rendering
- Clean, modern light theme

### Running
```bash
# Backend
cd webapp/backend && pip install -r requirements.txt && python main.py

# Frontend
cd webapp/frontend && npm install && npm run dev
```

## What Still Needs Work
1. End-to-end testing of the full webapp flow
2. Google Drive integration (optional video storage)
3. Creatomate rendering integration (alternative to FFmpeg)
4. AI reranking step in matching flow
5. Twelve Labs video analysis integration
