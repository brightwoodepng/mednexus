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

The configured Replit workflow is **"Start application"** and runs this command automatically.

## localStorage-only mode (no database required)

The app works out of the box with no secrets configured. In this mode:
- Quiz progress and user state are saved to the browser's **localStorage** only
- Progress is device-specific and will be lost if the browser cache is cleared
- Student account registration and the Admin panel are unavailable
- Use **"Continue as Guest"** on the landing screen

To unlock full functionality (accounts, role-gated administration, cloud sync), see the secrets table below.

## Environment variables / Secrets

Set these in the **Replit Secrets tab** (not as plain env vars). See `.env.example` for local development.

| Secret | Required | Description |
|--------|----------|-------------|
| `POSTGRES_URL` | Yes (set) | Neon PostgreSQL connection string — picked up by `lib/db.ts` when `DATABASE_URL` is absent |
| `SESSION_SECRET` | Yes (set) | Signs user session tokens |
| `ADMIN_PASSWORD` | For admin panel | Password typed on the Admin login screen |
| `ADMIN_SECRET` | For admin panel | Random string that signs admin session tokens (generate: `openssl rand -hex 32`) |
| `GEMINI_API_KEY` | For AI import | Powers AI question extraction from Word (.docx) and PDF imports. Free key at https://aistudio.google.com/app/apikey |

> Database migrations run automatically on first API request via `ensureSchema()` in `lib/db.ts`.
> SSL is enabled automatically when `POSTGRES_URL` contains `sslmode=require` (Neon default).

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
  admin-access.ts         ← Server-side admin permission checks
  questions-database.ts   ← Static question bank fallback

components/
  mednexus-app.tsx        ← Root app shell (screen routing)
  dashboard.tsx           ← Home screen
  quiz-simulator.tsx      ← Quiz UI
  question-editor.tsx     ← Admin question editor (PDF import)
  live-assessments-*.tsx  ← Live exam management

contexts/
  app-context.tsx         ← Auth + progress state
  admin console layout    ← Cookie-authenticated server gate
  questions-context.tsx   ← DB-backed question bank (30 s poll)

app/api/                  ← Next.js API routes
```

## User preferences

- Keep existing project structure and stack; do not restructure or migrate.
