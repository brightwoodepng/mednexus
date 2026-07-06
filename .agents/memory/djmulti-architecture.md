---
name: Double Jeopardy Multiplayer (djmulti) Architecture
description: New multiplayer mode "djmulti" added to the room system; per-mode timers; Review Vignettes drawer in FinalResults; stale-room session bug fix.
---

## djmulti mode

- Internal mode identifier: `"djmulti"` (avoids collision with solo `"double"` GameModeId)
- Wager-like mode: reuses server wager/question/reveal phase cycle
- Starting bank: 500 pts (vs wager=1000). Set in both create POST and join PATCH.
- Max players: 5 (same as Clash)
- Percentage-based wager presets: Safe 10%, Moderate 25%, Bold 50%, All In 100% (client computes amount from bank, sends number to server)
- Client component: `DoubleJeopardyMultiHUD` in `components/game-mode-multiplayer.tsx`
- Entry point export: `DoubleJeopardyMulti`
- Routed from `game-mode.tsx` via `if (activeMode === "djmulti")`
- Mode card added to `MULTI_MODES` array with id `"djmulti"`

**Why separate from wager:**
DJ is percentage-based wagering (confidence), wager is fixed-chip betting (chip economy). Different starting balance, different preset labels, different color scheme (indigo/purple vs amber/orange).

## Per-mode strict timers

- `CLASH_TIME_LIMIT_MS = 45_000` (was shared 20s before)
- `COHORT_TIME_LIMIT_MS = 30_000`
- Helper: `getTimeLimitMs(mode: string): number` in `[pin]/route.ts`
- wager/djmulti: no time limit (auto-advance when all players answer)
- Used in: autoTick, buildResponse phaseDeadlineMs, pressure timer, reactionTimeMs clamp

## Review Vignettes drawer in FinalResults

- `FinalResults` now accepts optional `answerHistory?: MultiAnswerEntry[]`
- `MultiAnswerEntry = { question: SlimQuestion; selected: string }`
- `SlimQuestion` extended to include `explanation` field (mirroring the slimQuestion() function in the POST route)
- History tracked in `GameRoomController` via `answerHistory` useState, recorded in `handleAnswer` after successful API call
- Drawer renders: vignette, options with correct/wrong styling, explanation block (same UI as solo GameOver)

## Stale-room session bug fix

- Error state "Back to Game Mode" button was calling `onExit` directly, bypassing `clearActiveRoomSession()`
- Fixed to call `handleExit` instead, which already runs `clearActiveRoomSession()` before `onExit()`
- `handleExit` is defined before the error return in GameRoomController, so reference is valid

## Body type for PATCH /api/game-rooms/[pin]

- Added `equippedTitle?`, `equippedFrame?`, `equippedHighlight?` as optional string|null to the PATCH body type to satisfy TypeScript (these were used in `join` action but not declared).
