# Session Handoff

## How To Resume Fast
1. Read `CLAUDE.md`
2. Read `docs/current_state.md`
3. Read `docs/runbook.md`
4. If task is DB-related, read `docs/supabase.md` and `sql/supabase_schema.sql`
5. If task is n8n-related, read `docs/n8n_workflow.md`
6. If task is matching-related, read `docs/matching_engine.md`
7. If task is API-related, read `docs/api_reference.md`
8. If task is campaign-related, read `docs/campaign_flow.md`

## Documentation Map
| Doc | When to read |
|-----|-------------|
| `CLAUDE.md` | Always (system overview) |
| `docs/current_state.md` | Always (what exists, what's next) |
| `docs/runbook.md` | Setup, running, debugging |
| `docs/n8n_workflow.md` | Building/modifying n8n nodes |
| `docs/embedding_pipeline.md` | Gemini Embedding 2 calls |
| `docs/matching_engine.md` | Scoring, ranking, reranking |
| `docs/campaign_flow.md` | End-to-end campaign pipeline |
| `docs/api_reference.md` | API calls, endpoints, auth |
| `docs/architecture.md` | System design overview |
| `docs/decisions.md` | Why things were decided |
| `docs/supabase.md` | Database connection |
| `docs/todo.md` | Implementation checklist |

## Good Next Tasks (By Priority)
1. ~~Run SQL schema in Supabase~~ DONE (2026-03-14, project: zgjdurqkcfxhsuyogosb)
2. Build n8n Stage 1+2 (Video Ingestion + Indexing with Twelve Labs + Gemini)
3. Build n8n Stage 5 (Vibe Matching) - test with manual input
4. Build n8n Stage 3+4 (Campaign Trigger + AI Creative Director)
5. Build n8n Stage 6 (QC + Render)

## If A Session Stops Mid-Task
Record here:
- What was being changed
- Which file was last edited
- What still needs verification
- Which n8n stage was being built
