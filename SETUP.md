# MedNexus — Local Setup Guide

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | 18 or higher | https://nodejs.org |
| pnpm | any | `npm install -g pnpm` |
| PostgreSQL (optional) | any | https://neon.tech (free cloud) |

---

## 1 — Install dependencies

```bash
pnpm install
```

---

## 2 — Set up environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and set your `DATABASE_URL`.

**Free option:** Create a free Postgres database at https://neon.tech, copy the
connection string, and paste it as the value of `DATABASE_URL`.

> **No database?** The app still works — progress is saved in your browser's
> localStorage only (no cloud sync). Just leave `DATABASE_URL` blank.

---

## 3 — Run the development server

```bash
pnpm dev
```

Open http://localhost:3000 in your browser.

---

## Adding & Removing Questions / Modules

**Everything is in one file: `lib/questions-database.ts`**

### Add a question

Copy this template and paste it anywhere inside the `questionsDatabase` array:

```ts
{
  id: "q13",                         // unique id — increment from the last one
  subject: "Cardiology",             // module name (case-sensitive)
  vignette:
    "A 55-year-old man presents with …",
  options: [
    { id: "A", text: "Option A" },
    { id: "B", text: "Option B" },
    { id: "C", text: "Option C" },
    { id: "D", text: "Option D" },
  ],
  correctAnswer: "B",                // must match one option id
  explanation: {
    objective:          "What concept is being tested.",
    details:            "Why the correct answer is correct.",
    incorrectReasoning: "Why the wrong answers are wrong.",
  },
},
```

### Add a new module

Use a brand-new `subject` string in your question — e.g. `"Rheumatology"`.
A dashboard card appears automatically. No other wiring needed.

### Delete a module

Delete (or comment out) every question with that `subject` string.
The dashboard card disappears automatically.

### Edit lab values

Scroll to the bottom of `lib/questions-database.ts` — the `labValues` array
controls what shows up in the Lab Values modal during quizzes.

---

## Project Structure

```
lib/
  questions-database.ts   ← ADD/REMOVE questions & modules HERE
  types.ts                ← TypeScript interfaces (Question, etc.)
  themes.ts               ← Add/rename color themes here
  modules.ts              ← Module-selection & Weak Areas logic

components/
  dashboard.tsx           ← Home screen (module cards)
  quiz-simulator.tsx      ← Quiz UI (options, explanations, timer)
  auth-screen.tsx         ← Onboarding / name-entry screen
  sidebar.tsx             ← Navigation sidebar
  theme-modal.tsx         ← Theme picker

app/
  globals.css             ← Theme CSS variables (add new themes here)
  api/sync/route.ts       ← Cloud sync API (PostgreSQL read/write)

contexts/
  app-context.tsx         ← Global state (user, progress, cloud sync)
  theme-context.tsx       ← Active theme state
```

---

## Build for production

```bash
pnpm build
pnpm start
```
