---
name: DB-backed Questions
description: How the centralized question bank is stored and synced in PostgreSQL
---

## Schema
```sql
mednexus_questions (id INTEGER PRIMARY KEY DEFAULT 1, data JSONB, updated_at TIMESTAMPTZ)
```
Single row (id=1) stores all questions as a JSONB array.

## API
- `GET /api/questions` — public, returns `{questions, updatedAt}`. Returns `{questions: null}` if no custom bank saved.
- `PUT /api/questions` — admin only (x-admin-token header), upserts the row.

## Client sync
- `QuestionsProvider` fetches on mount; if DB has questions they override the static `questionsDatabase`.
- Polls every 30s (`POLL_INTERVAL`) — only re-renders if `updatedAt` is newer than local.
- `saveToDb(questions, token)` is called by `QuestionEditor` auto-save (debounced 800ms) on every mutation.
- LocalStorage cache (`lib/custom-questions.ts`) used as in-memory bridge for `lib/modules.ts`.

**Why:** All users see the same question bank in near-real-time without WebSockets.

**How to apply:** When adding new mutation methods to QuestionsContext, update local state only — the Question Editor auto-save picks them up via the `questions` useEffect.
