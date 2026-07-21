# MedNexus — Complete Application Brief

## Overview

**MedNexus** is a full-stack, production-grade medical quiz and study platform (Clinical Q-Bank) for medical students and clinicians, built by **Britechinc**. It runs as a single Next.js 16 web application and supports solo quiz modes, real-time multiplayer games, live admin-administered assessments, a virtual economy, a notification system, a cosmetics store, and an AI-powered question import pipeline.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 |
| Database | PostgreSQL via `pg` (auto-schema bootstrapped on cold start) |
| Fonts | Geist Sans + Geist Mono (Google Fonts) |
| AI / ML | Google Gemini (`@google/generative-ai`) — question extraction |
| PDF parsing | pdfjs-dist (client-side) |
| Word parsing | mammoth |
| Auth (admin) | Custom HMAC-signed tokens (`SESSION_SECRET`) |
| Auth (users) | JWT session tokens + bcrypt password hashes |
| Auth (guests) | HMAC-signed guest tokens (7-day TTL) |
| Real-time | Short-poll (no WebSockets) — game rooms at 1.5 s, Q-Bank at 30 s, notifications at 60 s |
| Analytics | Vercel Analytics (production only) |
| Package manager | pnpm |

---

## Environment Variables

| Variable | Required for |
|---|---|
| `DATABASE_URL` / `POSTGRES_URL` | All persistent features (accounts, progress, economy) |
| `SESSION_SECRET` | JWT signing for user sessions and HMAC guest tokens |
| `ADMIN_PASSWORD` | Admin panel login |
| `ADMIN_SECRET` | HMAC signing for admin tokens |
| `GEMINI_API_KEY` | AI question extraction from PDF / DOCX |

> Without `DATABASE_URL`, the app runs in **localStorage-only guest mode** — quiz still works but no accounts, no economy, no sync.

---

## User Roles

Three roles selectable from the landing page (`app/page.tsx`):

| Role | How they log in | Persistence |
|---|---|---|
| **Guest** | One click — no credentials | `localStorage` only, 7-day session token, progress not synced |
| **Registered Student** | Index number + password | Full cloud sync, wallet, streaks, notifications, leaderboard |
| **Admin** | `ADMIN_PASSWORD` → HMAC token | Question editor, assessment management, user management, broadcast notifications |

### Registered User Fields
`uid`, `name`, `classLevel` (e.g. "Level 400"), `indexNumber` (auto-formatted, unique), `role` (REGISTERED), `status` (pending → approved → rejected), `requiresPasswordUpdate`, `loginStreak`, `longestStreak`, `isPrivate` (opt out of leaderboard), `lastLoginDate`

Student registration requires admin approval. Admin can approve, reject, or force a password reset via OTP flag (`must_change_password`).

---

## Frontend Architecture

### Page Structure

```
app/
  layout.tsx             ← Root HTML shell (Geist fonts, viewport, Vercel Analytics)
  page.tsx               ← Entry point: wraps MedNexusApp in ALL providers
  exam/[token]/page.tsx  ← Public guest-facing live assessment URL
  notifications/page.tsx ← Secondary notifications page
  globals.css            ← Tailwind base + custom CSS variables
```

### Provider Stack (outermost → innermost)

1. `ThemeProvider` — theme token + dark/light mode
2. `AdminProvider` — admin HMAC token session
3. `QuestionsProvider` — DB-backed question bank, polls `/api/questions` every 30 s
4. `AppProvider` — auth user state, `UserProgress`, localStorage sync
5. `EconomyProvider` — NP wallet balance, bounties, inventory; fires daily login on mount

### Root Component: `components/mednexus-app.tsx`

Screen router — manages which view is active. Screens: `landing`, `dashboard`, `quiz`, `game`, `multiplayer`, `live-assessment`, `admin`, `leaderboard`, `store`, `results`, `profile`.

---

## Visual / UI Design

### 3-Layer Visual Stack

1. **`ThematicCanvas`** (`z-index: -10`, `position: fixed`) — animated gradient/particle background that reacts to the active theme color
2. **`GlassCard`** — glassmorphism card surfaces (`gc-glass` / `gc-solid` CSS classes), `light-dark()` aware
3. **Children** — always fully opaque content

### Theming

Multiple named color themes (Teal, Blue, Rose, etc.) managed by `ThemeProvider`. Dark/Light mode toggle in the top-right corner. Theme tokens flow through CSS custom properties.

### Icon System

All icons are inline SVG React components — no external icon library dependency for core UI. Icons defined locally in each component or in `components/icons.tsx`.

---

## Core Data Types (`lib/types.ts`)

### `Question`

```typescript
{
  id: string
  module?: string               // Parent module (e.g. "Level 400 Clinicals")
  moduleStatus?: "live" | "draft" | "offline"
  subject: string               // Discipline (e.g. "Internal Medicine")
  vignette: string              // Question stem
  contextId?: string | null     // FK → mednexus_question_contexts (shared vignette/image)
  contextContent?: string | null // Denormalized for rendering
  questionType?: "STANDARD_MCQ" | "ASSERTION_REASON" | "MATCHING"
  options: { id: string; text: string }[]
  correctAnswer: string | string[] | null  // string[] = SATA (Select All That Apply)
  explanation: {
    objective: string           // Learning objective
    details: string             // Why correct answer is right
    incorrectReasoning: string  // Why distractors are wrong
  } | null
  mediaBase64?: string | null   // Embedded image from DOCX/PDF import
}
```

### `QuestionContext` (shared clinical material)

```typescript
{
  id: string
  type: "TEXT" | "TABLE" | "IMAGE" | "MIXED"
  content: string    // plain text, Markdown table, or image URL/base64 URI
  createdAt: string
  updatedAt: string
}
```

One context can be shared by multiple sibling questions (e.g. one clinical vignette → 5 questions). Displayed as a split-screen panel in the quiz UI.

### `UserProgress`

```typescript
{
  totalAnswered: number
  totalCorrect: number
  flaggedQuestionIds: string[]
  streak: number                     // Consecutive study days
  lastStudyDate: string | null       // YYYY-MM-DD
  history: HistoryEntry[]
  examScores: ExamScore[]
  notificationsLastRead: number      // epoch ms
  mutedNotificationTypes: string[]
  favoriteModules: string[]
  srsData: Record<string, SrsEntry>  // questionId → SRS schedule
}
```

### `HistoryEntry`

```typescript
{
  id: string
  questionId: string
  module?: string
  subject: string
  vignetteSnippet: string
  mode: "trial" | "exam"
  selectedOption: string | string[] | null
  correctOption: string | string[] | null
  isCorrect: boolean
  timestamp: number   // epoch ms
}
```

### `SrsEntry` (Spaced Repetition)

```typescript
{
  interval: number  // days until next review
  ef: number        // ease factor (1.3–2.5)
  due: string       // YYYY-MM-DD next review date
  reps: number      // consecutive correct answers
}
```

### `BlockResult` (post-session summary)

```typescript
{
  total: number; correct: number; incorrect: number; omitted: number
  percentage: number
  rank: "Expert" | "Proficient" | "Competent" | "Novice"
  timeTakenMs?: number
  earnedNP?: number   // set after payout resolves
}
```

### `LiveAssessment`

```typescript
{
  id: string; title: string; moduleName: string
  questionIds: string[]; questionCount: number
  timeLimitMins: number; triesAllowed: number; passMark: number
  status: "live" | "offline"
  shareToken: string   // UUID — used in /exam/[token] URL
  createdAt: string
}
```

---

## Database Schema

All tables are auto-created by `lib/db.ts → ensureSchema()` on every cold start. `CREATE TABLE IF NOT EXISTS` makes this idempotent. Migrations for existing databases are applied via `ALTER TABLE … ADD COLUMN IF NOT EXISTS`.

### Enums

- `question_context_type`: `TEXT | TABLE | IMAGE | MIXED`
- `question_type`: `STANDARD_MCQ | ASSERTION_REASON | MATCHING`

### Tables

| Table | Key Columns | Purpose |
|---|---|---|
| `mednexus_question_contexts` | `id TEXT PK`, `type`, `content TEXT`, `created_at`, `updated_at` | Shared clinical vignettes/images for multi-question sets |
| `mednexus_users` | `uid TEXT PK`, `name TEXT`, `created_at` | Base user records |
| `mednexus_progress` | `uid TEXT PK`, `data JSONB`, `updated_at` | Full `UserProgress` blob per user |
| `mednexus_questions` | `id INTEGER PK DEFAULT 1`, `data JSONB`, `updated_at` | Single-row JSONB array of ALL questions — entire Q-Bank in one row |
| `mednexus_notifications` | `id TEXT PK`, `title`, `body`, `type`, `admin_only BOOL`, `is_read BOOL`, `created_at` | Admin broadcast notifications |
| `mednexus_assessments` | `id TEXT PK`, `title`, `module_name`, `question_ids JSONB`, `question_count INT`, `time_limit_mins INT`, `tries_allowed INT`, `pass_mark INT`, `status`, `share_token TEXT`, `created_at` | Live assessments |
| `mednexus_assessment_attempts` | `id TEXT PK`, `assessment_id`, `user_id`, `user_name`, `is_guest BOOL`, `answers JSONB`, `score INT`, `total INT`, `started_at`, `submitted_at` | Per-user live assessment attempts |
| `mednexus_registered_users` | `uid TEXT PK`, `name`, `level`, `class_level`, `role`, `index_number TEXT UNIQUE`, `password_hash`, `status` (pending/approved/rejected), `must_change_password BOOL`, `otp_hash`, `is_private BOOL`, `last_login_date`, `longest_streak INT`, `login_streak INT`, `created_at` | Full registered student accounts |
| `mednexus_guest_users` | `uid TEXT PK`, `name`, `class_level`, `role`, `token_hash`, `created_at`, `expires_at` (7-day TTL) | Temporary guest sessions |
| `mednexus_game_rooms` | `pin TEXT PK`, `mode`, `host_id`, `host_name`, `question_pool JSONB`, `current_qi INT`, `phase`, `players JSONB`, `version INT`, `scored_uids JSONB`, `phase_started_at`, `knockout_winner_id TEXT`, `created_at`, `expires_at` (4h TTL) | Multiplayer game rooms |
| `mednexus_wallet` | `uid TEXT PK`, `balance INT`, `rank_points INT`, `last_multiplayer_win_at`, `updated_at` | NP wallet + Clinical Ladder rank points |
| `mednexus_bounty_progress` | `(uid, bounty_id, bounty_date) PK`, `progress INT`, `claimed BOOL` | Daily bounty challenge tracking |
| `mednexus_user_inventory` | `(uid, item_id) PK`, `quantity INT` | Store item purchases |
| `mednexus_user_cosmetics` | `uid TEXT PK`, `equipped_title`, `equipped_frame`, `equipped_highlight`, `equipped_avatar`, `updated_at` | Active cosmetic loadout per user |
| `mednexus_user_question_progress` | `(user_id, question_id) PK`, `correct_count INT`, `discipline TEXT` | Anti-farming: tracks correct answer count per question (cap = 3) |
| `mednexus_discipline_np_log` | `(user_id, discipline, earned_date) PK`, `np_earned INT` | Anti-farming: daily NP per discipline (7-day rolling window, cap = 1,000 NP) |
| `mednexus_exam_sessions` | `id TEXT PK`, `user_id`, `mode`, `question_ids JSONB`, `answered_ids JSONB`, `status` (active/completed/abandoned), `started_at`, `submitted_at` | Exam abandonment tracking |
| `mednexus_user_notifications` | `id TEXT PK`, `user_id TEXT`, `type TEXT`, `message TEXT`, `is_read BOOL`, `created_at` | Personal per-user notifications |
| `mednexus_daily_activity` | `(user_id, activity_date) PK`, `questions_answered INT`, `correct_answers INT` | Weekly leaderboard statistics |
| `mednexus_guest_analytics` | `id TEXT PK`, `assessment_id`, `assessment_title`, `guest_name`, `score INT`, `total INT`, `percentage INT`, `passed BOOL`, `time_taken_secs INT`, `submitted_at` | Guest live assessment results for admin reporting |

### PostgreSQL Trigger: `mednexus_migrate_host`

Fires `BEFORE UPDATE` on `mednexus_game_rooms`. When the host player's `status` becomes `'disconnected'`, it automatically promotes the oldest remaining active non-spectator player to host — updating `host_id`, `host_name`, all `isHost` flags in the JSONB players array, and bumping `version` so pollers detect the change in the next tick.

---

## Quiz System

### Question Flow

```
Landing Page → role selection
  → Dashboard (mode / module / discipline picker)
    → QuantityModal (question count, filters)
      → QuizSimulator (live session)
        → ResultsScreen (score, NP earned, breakdown)
```

### Solo Quiz Modes

| Mode | Description | Timer | NP Earned |
|---|---|---|---|
| **Trial** | Immediate answer feedback after each question | None | 10 NP/correct + streak bonus |
| **Exam (Timed)** | Submit blocks, review after | Configurable countdown | 50 NP + accuracy bounty |
| **Tutor** | Trial variant with extended explanations | None | Same as Trial |
| **Random** | Random question pool | None | Same as Trial |
| **Missed Questions** | Pool of previously incorrect answers | None | Same as Trial |

### In-Session Features

- Question flagging (bookmark for later review)
- Option striking (cross out distractors)
- Question navigator panel (jump to any question by number)
- Lab values reference modal (normal ranges)
- Shared context panel (when `contextId` is set — split screen with clinical vignette/image)
- SATA (Select All That Apply) multi-select support
- Assertion-Reason format support
- SRS data updated after every answer

### Streak Bonus (Trial Mode)

- Streak > 3 consecutive correct: +5 NP
- Streak > 10 consecutive correct: +10 NP

---

## Multiplayer Game Modes

All modes use **polling at 1.5 s intervals**. Rooms expire after **4 hours**. Rooms identified by a **6-digit PIN**. The host leads; others join via PIN.

| Mode ID | Name | Description | Timer | Starting Balance |
|---|---|---|---|---|
| `clash` | Clash | Competitive — fastest correct answer wins each question | 45 s | N/A (score-based) |
| `cohort` | Cohort Study | Collaborative — all answer, then review together | 30 s | N/A |
| `wager` | Wager Wars | Each round: set a wager, answer, win/lose chips | Per question | 1,000 chips |
| `djmulti` | Double Jeopardy | Wager with % presets, 500-chip bank, review drawer in final results | 45 s | 500 chips |

### Player Object (stored in `players JSONB`)

```json
{
  "id": "...", "name": "...", "score": 0, "streak": 0,
  "answer": null, "answeredAt": null, "isHost": true,
  "balance": 500, "wagerAmount": null, "isSpectator": false,
  "equippedTitle": "...", "equippedFrame": "...",
  "equippedHighlight": "...", "equippedAvatar": "..."
}
```

### Game Phases

`lobby → question → reveal → final`

### Special Rules

- **Host migration:** PostgreSQL trigger auto-promotes the oldest active non-spectator if host disconnects.
- **First Win of the Day:** +250 NP bonus for rank-1 finish in multiplayer (tracked via `last_multiplayer_win_at`).
- **Knockout:** In wager modes, if all players but one go bankrupt before the final question, `knockout_winner_id` is set and the match ends early.
- **Score deduplication:** `scored_uids` JSONB array in the room prevents double NP payout on match end.

---

## Live Assessments

Admin creates a timed exam, sets question pool, time limit, tries allowed, and pass mark. A UUID `share_token` generates a public URL: `/exam/[token]`.

Students (registered or guest) access the URL, enter their name, and take the exam. The exam UI has a fixed header with a persistent countdown timer.

**Admin analytics per assessment:**
- Total submitted, average score, pass count, guest vs registered breakdown
- Per-question answer distribution
- Guest analytics stored separately in `mednexus_guest_analytics`

---

## Virtual Economy (Nexus Points / NP)

### Earning NP

| Source | Amount |
|---|---|
| Trial — correct answer | 10 NP base + streak bonus |
| Trial — streak > 3 correct in a row | +5 NP |
| Trial — streak > 10 correct in a row | +10 NP |
| Exam block — correct answers | 50 NP + accuracy bounty |
| Daily login | 25 NP base + milestone bonuses (Day 3, 7, 14, 30+) |
| Multiplayer first win of the day | +250 NP |
| Clinical Rank-Up (tier crossing) | +1,000 NP per tier gained |

### Clinical Ladder (Rank Points)

`rank_points` grow alongside `balance` at the same rate. When crossing tier thresholds, a one-time `+1,000 NP` bonus fires per tier gained. Tier names appear in the payout breakdown (e.g. "🎓 Rank-Up: Senior Resident!").

### Anti-Farming System (`lib/anti-farming.ts`)

**3-Repeat Cap:** A question answered correctly ≥ 3 times yields **0 NP** on subsequent correct answers. Tracked in `mednexus_user_question_progress`.

**Discipline Fatigue:** Once a user earns ≥ 1,000 NP in a single discipline within a **rolling 7-day window**, further correct answers in that discipline yield **0 NP** until the window resets. Tracked in `mednexus_discipline_np_log`.

**Guest bypass:** UIDs starting with `guest-` skip all anti-farming checks.

**Exam abandonment:** Sessions not submitted within the time limit + grace period are marked `abandoned`; unanswered questions are recorded as incorrect.

### Payout Transaction Flow (`POST /api/economy/payout`)

Runs inside a **PostgreSQL transaction**:

1. Calculates gross NP via `calculatePayout()` (game-mode formula)
2. Applies anti-farming via `calculateSessionNP()` (per-question: repeat cap + discipline fatigue)
3. Credits net NP to `mednexus_wallet`
4. Increments `rank_points`, detects tier crossings, awards rank-up bonuses
5. Updates bounty progress for today's daily challenges
6. Logs to `mednexus_daily_activity` for weekly leaderboard stats
7. Returns `{ earned, newBalance, breakdown[], bountyUpdates[] }`

### Daily Bounties

Rotating daily challenge system. Each bounty has a `target` (e.g. answer 20 questions correctly) and `progress` tracked in `mednexus_bounty_progress`. Completing a bounty awards bonus NP. Resets each calendar day.

### Store (`components/game-store-modal.tsx`)

Three tabs:

- **Supply Closet** — consumable items
- **Vault** — premium items
- **Cosmetics** — profile customizations (title, frame, highlight color, avatar)

Cosmetics are equipped via `POST /api/economy/cosmetics`, stored in `mednexus_user_cosmetics`, embedded in the player object on room join/create, and rendered in `PlayerRow` and the Leaderboard.

---

## Notification System (Dual-Feed)

### Two Independent Feeds Merged in Real-Time

| Feed | Source Table | API Endpoint | Audience |
|---|---|---|---|
| Admin Broadcasts | `mednexus_notifications` | `/api/notifications` | All users |
| Personal | `mednexus_user_notifications` | `/api/user-notifications` | Per-user only |

### `NotificationBell` (`components/notification-bell.tsx`)

- Polls both feeds every **60 seconds**
- Sums unread counts from both feeds for the red badge
- Badge caps display at `9+`
- On open: optimistic badge clear; overlay marks all read server-side; badge reconciled on close

### `NotificationOverlay` (`components/notification-overlay.tsx`)

- Slide-in drawer from the right edge
- Merges + sorts both feeds newest-first
- Filter tabs: All / Unread / Read
- Per-item actions: mark as read (PATCH), delete (DELETE)
- Auto-marks all unread as read on open

### Automated Personal Notification Triggers (`lib/progression-notifications.ts`)

Fired on every `POST /api/sync`. Each uses a **deterministic ID** — `ON CONFLICT DO NOTHING` ensures each fires exactly once (or once per ISO week for weekly triggers):

| Type | Trigger Condition | Icon | Color |
|---|---|---|---|
| `module_complete` | All questions in a module answered at least once | ✅ CheckCircle | Emerald |
| `discipline_mastery` | All questions in a discipline answered correctly | 🏆 Trophy | Violet |
| `qbank_milestone` | 25%, 50%, 75%, or 100% of total Q-Bank answered | 📈 TrendingUp | Sky blue |
| `streak` | `progress.streak` reaches 3, 7, or 14 days | 🔥 Fire | Orange |
| `economy` | Wallet crosses 5k / 10k / 25k / 50k / 100k NP | 💰 Coins | Green |
| `economy` | Discipline fatigue triggered (≥1,000 NP in one discipline in 7 days) | 💰 Coins | Green |
| `leaderboard` | User is in top 3 by wallet balance (checked weekly per ISO week) | 🏆 Trophy | Yellow/Gold |

---

## Leaderboard (`GET /api/leaderboard?tab=alltime|weekly`)

### All-Time Tab

Ranks all non-private, approved users by `mednexus_wallet.balance` (total lifetime NP). Tie-broken by all-time accuracy computed from the `mednexus_progress.data->'history'` JSONB. Includes `rank_points` for Clinical Ladder tier display. Top 50 shown; viewer's own row always included even if outside top 50 or private.

### Weekly Tab

Ranks by NP earned in the last 7 days (from `mednexus_discipline_np_log`). Tie-broken by weekly accuracy — **accuracy is suppressed (shown as 0%) if fewer than 50 questions answered that week** to prevent gaming the accuracy metric. Weekly question counts from `mednexus_daily_activity`.

### Entry Shape

```
{ rank, uid, name, level, classLevel, np, rankPoints?,
  accuracy, weeklyQuestions?, accuracySuppressed,
  equippedTitle, equippedFrame, equippedHighlight, equippedAvatar }
```

Cosmetics (title, frame, highlight, avatar) are rendered on every leaderboard row.

---

## Admin Panel

Accessed via "Admin Access" on the landing page. Requires `ADMIN_PASSWORD`. Sessions use HMAC-signed tokens sent as `x-admin-token` header on every admin API request.

### Question Editor (`components/question-editor.tsx`)

- Hierarchical tree: Module → Discipline → Question
- Draft staging via local React state before publishing to DB
- Add, edit, delete questions and entire modules
- Inline image support (paste or upload)
- Module status management: `live`, `draft`, `offline`

### Universal Importer (`components/universal-importer.tsx`)

Four import flows — all show a **preview staging step** before committing to the editor:

1. **JSON** — paste or upload structured question JSON
2. **DOCX** — AI-powered extraction via Gemini (chunking orchestrator handles large files)
3. **PDF** — client-side pdfjs-dist text extraction → Gemini parse
4. **Plain text** — free-text → Gemini extraction

Anti-hallucination rules: discipline is only set if an explicit `DISCIPLINE:` tag exists in the source; module inferred from tag > fallback module > "Uncategorized".

### AI Extraction (`lib/gemini.ts`)

- `generateWithFallback()` rotates through multiple Gemini model variants to bypass free-tier rate limits
- Parses unstructured medical text into the `Question` interface
- Handles STANDARD_MCQ, ASSERTION_REASON, and MATCHING formats
- Extracts embedded images as `mediaBase64` data URIs

### Live Assessment Management (`components/live-assessments-admin.tsx`)

- Create and edit assessments: title, module, question pool, time limit, tries, pass mark
- Toggle `live` / `offline` status
- Per-assessment analytics: total submitted, average score, pass rate, guest vs registered split
- Copy shareable URL (`/exam/[token]`) for distribution to students

### User Management

- Approve / reject pending student registrations
- Force password reset (sets `must_change_password` flag — OTP-based, not email-delivered)
- View all registered users with current status

### Broadcast Notifications

- Create `info`, `update`, or `alert` type messages
- Appear in all users' notification feeds immediately

---

## Complete API Reference

### Authentication

| Endpoint | Method | Body / Query | Returns |
|---|---|---|---|
| `/api/auth/login` | POST | `{ indexNumber, password }` | Session token + `RegisteredUser` |
| `/api/auth/register` | POST | `{ name, indexNumber, classLevel, password }` | New user (status: `pending`) |
| `/api/auth/guest` | POST | `{ name, classLevel }` | `GuestAuthResponse` with one-time token |
| `/api/auth/update-password` | POST | `{ currentPassword, newPassword }` + `x-session-token` | `{ success }` |

### Admin Auth & User Management

| Endpoint | Method | Description |
|---|---|---|
| `/api/admin/auth` | POST | Validate admin password → return HMAC admin token |
| `/api/admin/users` | GET | List all registered users. Requires `x-admin-token` |
| `/api/admin/users/[uid]` | PATCH | Update user `status` or `role`. Requires `x-admin-token` |
| `/api/admin/guests` | GET | List active guest sessions. Requires `x-admin-token` |
| `/api/admin/guests/[uid]` | DELETE | Purge a guest session. Requires `x-admin-token` |

### Questions

| Endpoint | Method | Description |
|---|---|---|
| `/api/questions` | GET | Fetch full question bank. Returns `{ questions: Question[] }` |
| `/api/questions` | PUT | Full overwrite of question bank. Requires `x-admin-token` |
| `/api/questions/append` | POST | Append new questions without overwriting existing ones. Requires `x-admin-token` |

### Progress Sync

| Endpoint | Method | Description |
|---|---|---|
| `/api/sync` | GET | Fetch stored progress. Returns `{ uid, name, progress: UserProgress }` |
| `/api/sync` | POST | Upsert user + progress; fires all automated notification triggers. Body: `{ name, progress }` |

### Notifications

| Endpoint | Method | Description |
|---|---|---|
| `/api/notifications` | GET | Fetch admin broadcasts |
| `/api/notifications` | POST | Create broadcast. Body: `{ id, title, body, type }`. Requires `x-admin-token` |
| `/api/notifications` | PATCH | Mark broadcast as read. Body: `{ id }` |
| `/api/notifications` | DELETE | Delete broadcast. Requires `x-admin-token` |
| `/api/user-notifications` | GET | Fetch personal notifications. Auth: `x-session-token` or `x-guest-token` |
| `/api/user-notifications` | PATCH | Mark personal notification as read. Body: `{ id }` |
| `/api/user-notifications` | DELETE | Delete personal notification. Body: `{ id }` |

### Economy

| Endpoint | Method | Description |
|---|---|---|
| `/api/economy/payout` | POST | Award NP after a session (full transaction). Body: `{ uid, mode, score, correct, total, bestStreak, sessionData[], examMeta? }`. Returns `{ earned, newBalance, breakdown[], bountyUpdates[] }` |
| `/api/economy/wallet` | GET | Fetch current `balance` and `rank_points` |
| `/api/economy/daily-login` | POST | Process daily login reward. Idempotent per calendar day |
| `/api/economy/bounties` | GET | Fetch today's bounties + user's progress on each |
| `/api/economy/store` | POST | Purchase a store item. Body: `{ uid, itemId, type: "inventory" \| "cosmetic" }` |
| `/api/economy/inventory` | GET | Fetch owned item inventory |
| `/api/economy/cosmetics` | GET | Fetch equipped cosmetic loadout |
| `/api/economy/cosmetics` | POST | Equip a cosmetic. Body: `{ uid, slot, itemId }` |
| `/api/economy/session` | POST | Open/close an exam session record (abandonment tracking) |

### Leaderboard

| Endpoint | Method | Description |
|---|---|---|
| `/api/leaderboard` | GET | Query: `?tab=alltime\|weekly&uid={viewerUid}`. Returns `{ entries[], viewerEntry, tab }`. Always includes viewer's own row |

### Live Assessments

| Endpoint | Method | Description |
|---|---|---|
| `/api/assessments` | GET | List all assessments. Requires `x-admin-token` |
| `/api/assessments` | POST | Create new assessment |
| `/api/assessments/[id]` | GET | Fetch single assessment |
| `/api/assessments/[id]` | PATCH | Update assessment settings/status. Requires `x-admin-token` |
| `/api/assessments/[id]` | DELETE | Delete assessment. Requires `x-admin-token` |
| `/api/assessments/[id]/attempt` | POST | Submit a student attempt. Body: `{ userId, userName, isGuest, answers }` |
| `/api/assessments/[id]/analytics` | GET | Registered user analytics for the assessment |
| `/api/assessments/[id]/guest-analytics` | GET | Guest analytics for the assessment |
| `/api/assessments/by-token` | GET | Look up assessment by share token. Query: `?token={uuid}` |

### Multiplayer Game Rooms

| Endpoint | Method | Description |
|---|---|---|
| `/api/game-rooms` | POST | Create a room. Body: `{ mode, hostId, hostName, questionPool[], equipped* }`. Returns `{ pin }` |
| `/api/game-rooms/[pin]` | GET | Poll room state — called by all clients every 1.5 s |
| `/api/game-rooms/[pin]` | PATCH | Mutate room (join, answer, advance phase, wager, disconnect) |
| `/api/game-rooms/[pin]` | DELETE | Close room. Host only |
| `/api/game-rooms/[pin]/score` | POST | Secure match-end score submission. Deduped by `scored_uids`. Triggers NP payout |

### AI Import

| Endpoint | Method | Description |
|---|---|---|
| `/api/parse-docx` | POST | Upload DOCX → Gemini extracts `Question[]` |
| `/api/parse-pdf` | POST | Upload PDF (base64 or URL) → Gemini extracts questions |
| `/api/parse-pdf-file` | POST | Upload PDF as file blob → pdfjs extraction → Gemini parse |
| `/api/extract-single-chunk` | POST | Parse one text chunk with Gemini. Used by chunking orchestrator for large documents |

### Privacy

| Endpoint | Method | Description |
|---|---|---|
| `/api/user/privacy` | PATCH | Toggle `is_private` (leaderboard opt-out) |

---

## Key Library Files

| File | Purpose |
|---|---|
| `lib/db.ts` | PostgreSQL pool + `ensureSchema()` — creates all tables, runs migrations, installs host-migration trigger |
| `lib/types.ts` | All shared TypeScript interfaces |
| `lib/admin-auth.ts` | HMAC token sign + verify for admin sessions |
| `lib/session-auth.ts` | JWT token sign + verify for user sessions |
| `lib/guest-auth.ts` | HMAC token sign + verify for guest sessions |
| `lib/anti-farming.ts` | `calculateSessionNP()` — 3-repeat cap + discipline fatigue per session |
| `lib/economy.ts` | `calculatePayout()`, `getTodaysBounties()`, `computeBountyProgress()`, `computeRankUpBonus()`, `CLINICAL_TIERS` |
| `lib/progression-notifications.ts` | All automated notification triggers (module complete, discipline mastery, Q-Bank milestones, streak, NP thresholds, discipline fatigue, leaderboard Top 3) |
| `lib/gemini.ts` | `generateWithFallback()` — Gemini model rotation for AI question extraction |
| `lib/pdf-extract.ts` | Client-side PDF text extraction via pdfjs-dist |

---

## Known Gaps / Feature Opportunities

- **No WebSocket / SSE real-time** — everything is polling (multiplayer 1.5 s, Q-Bank 30 s, notifications 60 s)
- **No email system** — password reset is a DB flag (`must_change_password`), not an emailed OTP
- **No admin analytics dashboard** — no charts for question performance trends, per-discipline difficulty, or student progress cohorts
- **No dedicated SRS review mode** — SRS data is computed and stored, but there is no UI screen surfacing "due today" questions as a standalone review queue
- **No mobile app** — web only; responsive but not a native app
- **No true weekly leaderboard reset** — weekly tab filters by a 7-day rolling window, not a Monday-reset cycle
- **No push notifications** — notification bell is polled; no browser push or PWA service worker
- **No question versioning** — edits overwrite in-place; no revision history or rollback for questions
- **No AI explanation generation** — AI import extracts question stems and options but does not auto-generate the structured `QuestionExplanation` object
- **No student-facing performance analytics** — no charts for accuracy over time, weak disciplines, or SRS retention curves
