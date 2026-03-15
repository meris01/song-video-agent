# Architecture

## System Overview

The system is an AI pipeline that matches uploaded songs to stored video clips, replaces the original audio with the song, adds AI-generated quote captions, and renders a final video.
It runs on n8n as the orchestrator, with Gemini Embedding 2 as the core AI engine.

```
[Video Library]                [Google Drive]
     |                              |
     v                              v
[n8n Workflow Engine] ---------> [Supabase]
     |                              |
     |--- Gemini Embedding 2        |--- pgvector (embeddings)
     |--- Gemini 2.5 Flash          |--- Postgres (metadata)
     |--- Twelve Labs               |--- Storage (files)
     |--- FFmpeg/Creatomate         |
     v                              v
[Final Videos]               [Match History]
```

## Core Flow (5 Stages)

| Stage | Name | Purpose | Key Tech |
|-------|------|---------|----------|
| 1 | Video Ingestion + Embedding | Download videos, analyze, embed, store | Twelve Labs, Gemini Embedding 2, Supabase pgvector |
| 2 | Song Upload + Matching | Upload song, embed, find best video match | Gemini Embedding 2, pgvector search, weighted scoring |
| 3 | Audio Replacement | Strip original audio, overlay uploaded song | FFmpeg / moviepy |
| 4 | Quote Caption Generation | AI generates vibe-matching quote text overlays (not lyrics) | Gemini 2.5 Flash |
| 5 | Final Render | Combine video + song + quote captions → MP4 | Creatomate / FFmpeg |

## Embedding Strategy

**Model:** Gemini Embedding 2 (multimodal)
**Dimensions:** 3072
**Key insight:** Songs and videos are embedded in the same vector space.
Cosine similarity between a song vector and a video vector directly measures "vibe match."

### Song Embedding
```
Audio bytes -> [BPM text prefix] + [audio data] -> Gemini Embedding 2 -> 3072-dim vector
```

### Video Embedding
```
Video bytes -> [BPM text prefix] + [video data] -> Gemini Embedding 2 -> 3072-dim vector
```

Both go through L2 normalization so cosine similarity = dot product.

## Matching Logic

Not just vector similarity. Multi-signal weighted scoring:

```
final_score = 0.55 * cosine + 0.15 * bpm + 0.15 * energy + 0.10 * mood + 0.05 * pacing
```

Then AI reranking with Gemini 2.5 Flash validates top candidates.

## Storage Architecture

### Supabase (Production)
- `videos` table with `embedding vector(3072)` column
- `songs` table with analysis metadata
- `matches` table with scores and explanations
- `campaigns` table for campaign tracking
- pgvector IVFFlat index for fast similarity search

### FAISS (Local Development)
- Local IndexFlatIP for fast iteration
- Pickle metadata alongside FAISS index
- Kept as a parallel path for dev/testing

### Google Drive
- Permanent video file storage
- Rendered ad output storage

### Google Sheets
- Human input layer (video sources, campaign requests)
- Status tracking visible to non-technical users

## Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Orchestration | n8n | Workflow automation |
| Embedding | Gemini Embedding 2 | Multimodal vector generation (songs + videos) |
| Video Understanding | Twelve Labs | Video audio & visual analysis for indexing |
| AI Analysis | Gemini 2.5 Flash | Song analysis, reranking, QC |
| Vector DB | Supabase pgvector | Similarity search at scale |
| Local Search | FAISS | Development and testing |
| Song Data | Spotify API | Track metadata and audio features |
| File Storage | Google Drive | Video and rendered ad storage |
| Input/Output | Google Sheets | Campaign management |
| Rendering | Creatomate | Final ad video production |
| App Layer | Streamlit | Local testing UI |
| Audio Analysis | librosa | BPM detection, audio processing |
| Video Processing | moviepy + FFmpeg | Video chunking, audio extraction |

## Data Flow Summary

```
Video sources -> Download -> Analyze (Twelve Labs) -> Embed (Gemini) -> Supabase pgvector
                                                                              |
Song upload -> Embed song (Gemini) -> pgvector search ----> Match best video -+
                                                                              |
                                                              Weighted scoring + AI reranking
                                                                              |
                                                              Strip original audio from video
                                                                              |
                                                              Overlay uploaded song
                                                                              |
                                                              Generate quote captions (AI)
                                                                              |
                                                              Render final MP4
```

## Important Design Choices
- Gemini multimodal embeddings are the primary semantic signal
- BPM is a secondary hybrid boost, not the main ranking engine
- Multi-signal scoring prevents over-reliance on any single metric
- AI reranking catches false positives from pure vector similarity
- FAISS local path is preserved for development speed
- Supabase pgvector is the production search engine
- Google Sheets as input layer makes the system accessible to non-developers

## Future Upgrade Path
- Add user feedback loop to tune matching weights per genre
- Add A/B testing for different weight configurations
- Add batch campaign processing for playlists
- Add thumbnail/preview generation for faster browsing
- Add Pinecone as alternative to pgvector if scale demands it
- Add webhook callbacks for real-time campaign status updates
