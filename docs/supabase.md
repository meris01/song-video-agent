# Supabase Notes

## Connection
- **Project Ref:** `zgjdurqkcfxhsuyogosb`
- **Project Name:** song-video-agent
- **Project URL:** `https://zgjdurqkcfxhsuyogosb.supabase.co`
- **Postgres Host:** `db.zgjdurqkcfxhsuyogosb.supabase.co`
- **Region:** ap-south-1
- **Port:** 5432
- **Database:** postgres
- **SSL:** required

## MCP Setup (Claude Code)
```json
// .mcp.json
{
  "mcpServers": {
    "supabase": {
      "type": "http",
      "url": "https://mcp.supabase.com/mcp?project_ref=zgjdurqkcfxhsuyogosb"
    }
  }
}
```
MCP connected via Claude Code. Agent can run SQL, list tables, apply migrations, and manage the project.

## Schema Status
- **Migration applied:** `initial_schema` (2026-03-14)
- **All 6 tables created** with pgvector extension enabled
- **match_videos() function** deployed
- **Triggers** for auto-updating timestamps active

## Tables (6 total)
| Table | Purpose |
|-------|---------|
| `videos` | Ingested video clips with embeddings (3072-dim pgvector) |
| `songs` | Uploaded/analyzed songs with embeddings and metadata |
| `campaigns` | Campaign requests with Spotify URLs and status |
| `matches` | Song-to-video match results with detailed scores |
| `rendered_ads` | Final rendered ad video records |
| `processing_logs` | Error and event logging for debugging |

## Key Function
```sql
-- Search videos by embedding similarity
SELECT * FROM match_videos(
  query_embedding := '[0.01, 0.02, ...]'::vector,
  match_threshold := 0.5,
  match_count := 15
);
```

## Schema File
Full schema is in `sql/supabase_schema.sql`. Already deployed via MCP migration.

## Storage Buckets (Future)
- `songs` - Uploaded song files
- `videos` - Video clips (currently using Google Drive instead)
- `thumbnails` - Video preview images

## Important Notes
- pgvector extension must be enabled (`create extension if not exists vector`)
- IVFFlat index needs at least ~100 rows for optimal performance
- After bulk inserts, rebuild index: `REINDEX INDEX videos_embedding_cosine_idx`
- Embedding dimension is 3072 (Gemini Embedding 2 full resolution)
- All embeddings must be L2-normalized before insert
