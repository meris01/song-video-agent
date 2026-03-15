# Decisions

## D-001 Local First
Reason:
Start with a simple runnable app before adding cloud persistence.

Decision:
Use local files + FAISS first, then add Supabase gradually.

## D-002 Embedding Model
Reason:
Need one shared space for audio and video.

Decision:
Use `gemini-embedding-2` as the primary semantic model (3072 dimensions).

## D-003 Similarity Search
Reason:
Need simple and fast local ranking.

Decision:
Use normalized embeddings with FAISS `IndexFlatIP` so inner product behaves like cosine similarity.

## D-004 BPM Usage
Reason:
BPM can help matching but should not dominate semantics.

Decision:
Use BPM as an optional text-prefix boost, not as the only ranking signal.

## D-005 Supabase Direction
Reason:
Need persistence, metadata storage, and future vector/sql workflows.

Decision:
Use Supabase as the production system of record while keeping the local FAISS path available.

## D-006 n8n as Orchestrator
Reason:
Need a visual workflow engine that can chain API calls, handle scheduling, and integrate with Google Sheets/Drive without custom code.

Decision:
Use n8n as the main workflow orchestrator. The 6-stage pipeline runs entirely in n8n.

## D-007 Multi-Signal Scoring
Reason:
Pure vector similarity sometimes matches visually but misses rhythm/energy alignment.

Decision:
Use weighted scoring: 55% cosine similarity + 15% BPM + 15% energy + 10% mood + 5% pacing.
Allow genre-specific weight overrides (e.g., EDM gets higher BPM weight).

## D-008 AI Reranking
Reason:
Vector similarity can produce false positives where visuals don't actually "feel right" with the song.

Decision:
Use Gemini 2.5 Flash to rerank top 8 candidates. Final score = 60% weighted_score + 40% rerank_score.

## D-009 Campaign-Based Workflow
Reason:
The system should support batch processing via Google Sheets, not just single uploads.

Decision:
Add a Campaigns sheet and campaign table. Each campaign has a Spotify URL, target countries, and ad count.

## D-010 Creatomate for Rendering
Reason:
Need to combine video + song + caption into a final ad MP4 without building a custom rendering engine.

Decision:
Use Creatomate API with pre-built 9:16 templates. Templates have video, audio, and text layers.

## D-011 Google Drive as File Storage
Reason:
Need permanent, shareable storage for source videos and rendered ads.

Decision:
Use Google Drive folders (source_videos/, rendered_ads/) instead of Supabase Storage for large video files.

## D-013 Twelve Labs for Video Understanding
Reason:
Gemini Embedding 2 creates great vectors but doesn't extract structured metadata (scene descriptions, audio mood, visual content). Need richer video understanding to improve matching.

Decision:
Use Twelve Labs (Marengo engine) in Stage 2 to analyze video audio & visuals before embedding. Twelve Labs metadata (mood, scenes, audio characteristics) is injected as text prefix into Gemini Embedding 2 calls, enriching the vector representation.

## D-014 Supabase Project Migration
Reason:
Original project ref `lnodoqhdttcnrbkzxdro` was not accessible. Needed a clean project with proper MCP access.

Decision:
Created new project `song-video-agent` (ref: `zgjdurqkcfxhsuyogosb`, region: ap-south-1). Schema deployed via MCP migration on 2026-03-14.

## D-012 Quality Control Gate
Reason:
Not all videos are suitable for ads (wrong aspect ratio, watermarks, low quality).

Decision:
Add a Gemini 2.5 Flash quality check before rendering. Check: vertical format, no text overlay, acceptable quality.
