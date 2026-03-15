# TODO

## Phase 1: Database Setup
- [x] Run `sql/supabase_schema.sql` in Supabase (deployed via MCP migration 2026-03-14)
- [x] Verify all 6 tables created (videos, songs, campaigns, matches, rendered_ads, processing_logs)
- [x] Verify pgvector indexes created
- [x] Verify `match_videos()` function deployed
- [ ] Test inserting a dummy video with embedding

## Phase 2: Video Ingestion + Embedding
- [ ] Create Google Drive folders (source_videos/, rendered_output/)
- [ ] Build video download pipeline (TikTok/other sources)
- [ ] Integrate Twelve Labs for video audio & visual analysis
- [ ] Embed videos with Gemini Embedding 2 (3072-dim)
- [ ] Store video embeddings + metadata in Supabase pgvector
- [ ] Add BPM detection for stored videos
- [ ] Test: ingest a video and verify embedding stored in Supabase

## Phase 3: Song Upload + Matching
- [ ] Build song upload flow (accept audio file)
- [ ] Embed uploaded song with Gemini Embedding 2
- [ ] Build pgvector search (match_videos() function)
- [ ] Build weighted scoring (cosine + bpm + energy + mood + pacing)
- [ ] Build deduplication logic
- [ ] Add AI reranking with Gemini 2.5 Flash
- [ ] Test: upload a song, verify best matching video(s) returned

## Phase 4: Audio Replacement
- [ ] Build audio stripping from matched video (FFmpeg/moviepy)
- [ ] Build song overlay onto video (sync audio to video duration)
- [ ] Handle duration mismatch (trim/loop song to fit video length)
- [ ] Test: matched video plays with uploaded song, no original audio

## Phase 5: Quote Caption Generation
- [ ] Build AI quote generator (Gemini 2.5 Flash)
- [ ] Generate vibe-matching quote captions (NOT lyrics — aesthetic/motivational text overlays)
- [ ] Style captions for TikTok/Instagram aesthetic (font, position, timing)
- [ ] Test: captions match the song vibe and look good on video

## Phase 6: Final Render
- [ ] Combine: matched video + uploaded song + quote captions → final MP4
- [ ] Set up Creatomate template (or FFmpeg pipeline) for rendering
- [ ] Upload rendered output to Google Drive
- [ ] Test: full end-to-end flow produces a polished video

## Phase 7: Polish
- [ ] Add error handling and processing_logs inserts
- [ ] Add retry logic for API failures
- [ ] Test with 50+ videos in library
- [ ] Add genre-specific weight overrides
- [ ] Performance tuning (batch sizes, delays)

## Ongoing
- [ ] Keep local Streamlit app working alongside n8n pipeline
- [ ] Update docs when implementation details change
- [ ] Track user feedback on match quality
