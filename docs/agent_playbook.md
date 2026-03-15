# Agent Playbook

## Goal
Help this project move fast with low token usage and low repeated explanation.

## What The Agent Should Assume
- This repo is for a song-to-video matching agent.
- Local-first workflow exists already.
- Gemini multimodal embeddings are the main semantic engine.
- FAISS is the current local search layer.
- Supabase MCP is connected and available for future database/storage work.

## Default Working Style
- Read only the minimum files needed.
- Prefer updating existing files instead of creating many new ones.
- Keep answers short unless the user asks for depth.
- When changing architecture, update the relevant markdown memory file.
- When a task is implementation-heavy, do the work instead of only suggesting it.

## File Reading Order
When starting a new session, prefer this order:

1. `claude.md`
2. `docs/current_state.md`
3. `docs/runbook.md`
4. `docs/supabase.md`
5. only then open code files related to the task

## When To Update Docs
- Update `docs/current_state.md` after meaningful progress
- Update `docs/decisions.md` when a technical direction changes
- Update `docs/runbook.md` when commands or setup steps change
- Update `docs/session_handoff.md` when work stops mid-task

## Token Saving Rules
- Do not paste long file contents unless needed
- Summarize code instead of quoting it
- Open only task-relevant files
- Avoid repeating project background already stored in markdown docs

