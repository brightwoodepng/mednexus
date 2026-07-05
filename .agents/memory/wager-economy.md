---
name: Wager Wars Architecture
description: Multiplayer wager mode — flow, security constraints, and balance edge cases
---

## Flow
Phases: lobby → wager (vignette only, options[] stripped by server) → question (options revealed) → reveal → [back to wager for next round or done]

- Server strips `options` during wager phase: `options: isWagerPhase ? [] : q.options`
- Client `WagerHUD` handles all three active phases in a single component
- `GameRoomController` routes `room.mode === "wager"` before the clash catch-all

## Balance clamp edge case
`Math.max(10, Math.min(wager, balance))` is wrong when `balance < 10` — it inflates the wager above the player's actual balance.
**Correct**: `const minWager = Math.min(10, balance); clampedWager = Math.max(minWager, Math.min(wager, balance))`

## Security constraints
- `place_wager` requires `requesterId === playerId` (same pattern as answer/disconnect)
- Spectators are rejected server-side in the `answer` case for wager mode via `p.isSpectator` check
- Spectators are detected by `isSpectator` field on RoomPlayer, set server-side when balance reaches 0 after a wrong answer

## Score = Balance
In wager mode, `score` and `balance` are kept identical on the server: `score: newBalance, balance: newBalance`.
This means the myLastAnswerCorrect score-delta trick works for wager mode too (newScore > prevScore = correct).

## Cohort Review split-screen (host)
CohortHostHUD question phase: 3/5 cols = vignette + colored option tiles, 2/5 cols = live Top 10 leaderboard.
Top-10 sorted client-side from `room.players` — NOT from `room.leaderboard` which the server caps at 5.

**Why:** Changing the server-side leaderboard slice would affect all modes. Client-side sort is isolated.
