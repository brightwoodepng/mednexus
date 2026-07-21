---
name: Quiz Mode NP Payouts
description: How anti-farming NP is calculated and triggered for Trial and Exam quiz modes
---

## Architecture

### Anti-farming (`lib/anti-farming.ts`)
- `SessionQuestionInput`: `{ questionId, discipline, isCorrect, currentStreak? }`
- `ExamMeta`: `{ accuracy, correct, total, primaryDiscipline? }`
- `calculateSessionNP(userId, mode, questions, client, examMeta?)`:
  - **Trial mode**: 10 NP + streak bonus (streak>10→+10, streak>3→+5) per correct question, subject to 3-repeat cap and 1000 NP/7-day discipline fatigue
  - **Exam mode**: 50 base + accuracy bonus (>90%→+500, >75%→+250, >50%→+100), discipline fatigue applies to whole bounty; correct_count still updated for both modes

### `quiz-simulator.tsx` (client)
- `sessionDataRef`: accumulates `{questionId, discipline, isCorrect, currentStreak}` per answered question (trial mode, in `selectOption`/`lockInSata`)
- `payoutCalledRef`: guards against double-payout across Grand Finale + submitBlock paths
- `currentStreakRef`: local streak counter for NP bonus calc (separate from streakEngine React state)
- `bestStreakRef`: synced from `streakEngine.bestStreak` via useEffect for use in closures
- **NPFloatToast**: floating "+X NP" or "+0 NP · Cap Reached" animation (gamificationEnabled only); repeat-cap estimate uses `progress.history`
- Payout call sites:
  - **Trial + gamification**: Grand Finale `useEffect` (fire-and-forget)
  - **Trial without gamification**: `submitBlock` (fire-and-forget)
  - **Exam mode**: `submitBlock` (awaited; `earnedNP` passed to `onComplete`)

### Data flow for exam bounty
`submitBlock` → await `submitGameResult` → `data.earned` → `onComplete(result, history, earnedNP)` → `handleQuizComplete(result, history, earnedNP)` → `setLastResult({ ..., earnedNP })` → `ResultsScreen` prop `earnedNP`

### `results-screen.tsx`
- `BountyCountup` component: counts from 0 to target over 1.8s
- Bounty card shown only when `mode === "exam" && earnedNP > 0`

### `economy-context.tsx` / `EconomyContextValue`
- `submitGameResult` accepts `sessionData?` and `examMeta?` in both the implementation and the context interface type

**Why:** Repeat cap prevents farming mastered questions; discipline fatigue prevents grinding one subject all day; exam bounty rewards completion not speed-clicking.
