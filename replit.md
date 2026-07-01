# MedNexus — Clinical Q-Bank

A Next.js medical quiz application for medical students and clinicians. Supports tutor and timed exam modes, live assessments, game modes, admin tools, and optional PostgreSQL cloud sync.

## Stack

- **Framework**: Next.js 16 (App Router, Turbopack)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL via `pg` (Replit's built-in database, auto-provisioned)
- **Auth**: Custom token-based admin auth (HMAC-signed); user auth via `mednexus_registered_users` table
- **Package manager**: pnpm

## Running the app

```bash
pnpm install && pnpm dev
```

Runs on port **5000** at `http://0.0.0.0:5000`.

## Environment variables / Secrets

Set these in the **Replit Secrets tab** (not as plain env vars). See `.env.example` for local development.

| Secret | Required | Description |
|--------|----------|-------------|
| `GEMINI_API_KEY` | **Yes** | Powers AI question extraction from Word (.docx) and PDF imports. Free key at https://aistudio.google.com/app/apikey |
| `ADMIN_PASSWORD` | **Yes** | Password for the admin panel login screen |
| `ADMIN_SECRET` | No | HMAC secret for signing admin tokens (falls back to a built-in default if unset) |
| `DATABASE_URL` | Auto | Injected automatically by Replit's built-in PostgreSQL — do not set manually |

> **Importing from GitHub?** Open the Secrets tab and add `GEMINI_API_KEY`, `ADMIN_PASSWORD`, and optionally `ADMIN_SECRET` before running the app.

## Database schema

Schema is auto-created on first API request via `lib/db.ts → ensureSchema()`. Tables:

- `mednexus_users` — guest/user records
- `mednexus_progress` — per-user JSONB progress
- `mednexus_questions` — single-row JSONB question bank (DB-backed, polled every 30 s)
- `mednexus_notifications` — admin broadcast notifications
- `mednexus_assessments` — live assessments
- `mednexus_assessment_attempts` — user attempt records
- `mednexus_registered_users` — registered user accounts with password hashes
- `mednexus_game_rooms` — multiplayer game rooms (expire after 4 h)

## Key files

```
lib/
  db.ts                   ← DB pool + ensureSchema()
  admin-auth.ts           ← HMAC token create/verify
  questions-database.ts   ← Static question bank fallback

components/
  mednexus-app.tsx        ← Root app shell (screen routing)
  dashboard.tsx           ← Home screen
  quiz-simulator.tsx      ← Quiz UI
  question-editor.tsx     ← Admin question editor (PDF import)
  live-assessments-*.tsx  ← Live exam management

contexts/
  app-context.tsx         ← Auth + progress state
  admin-context.tsx       ← Admin session (token verification)
  questions-context.tsx   ← DB-backed question bank (30 s poll)

app/api/                  ← Next.js API routes
```

## User preferences

- Keep existing project structure and stack; do not restructure or migrate.
