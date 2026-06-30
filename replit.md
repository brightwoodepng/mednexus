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

## Environment variables

- `DATABASE_URL` — auto-injected by Replit's built-in PostgreSQL (runtime-managed; do not set manually)
- `ADMIN_PASSWORD` — password for the admin panel login (set as a Replit Secret)
- `ADMIN_SECRET` — optional HMAC secret for admin token signing (defaults to a built-in fallback)
- Firebase and OpenAI vars are optional and commented out in `.env.example`

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
