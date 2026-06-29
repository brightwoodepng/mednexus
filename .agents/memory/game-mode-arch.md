---
name: Game Mode Architecture
description: 7-mode game system — 5 solo + 2 multiplayer; polling-based realtime; mednexus_game_rooms table
---

## Solo modes (components/game-mode.tsx)
- Rapid Fire, Sudden Death, Time Attack, Streak Master: pre-existing
- **Double Jeopardy** (new): vignette shown first → user wagers 10/25/50/100% of bank → options revealed → win/lose wager

## Multiplayer modes (components/game-mode-multiplayer.tsx)
- **Multiplayer Clash**: max 5 players, polling at 1.5s, host controls pace, full leaderboard between questions
- **Cohort Review**: unlimited players, split host/player views (host = full question; players = giant A/B/C/D buzzer squares), top-5 leaderboard

## DB: mednexus_game_rooms
Columns: pin (6-digit TEXT PK), mode, host_id, host_name, question_pool (JSONB), current_qi, phase (lobby|question|reveal|done), players (JSONB), version (INT), expires_at (4h TTL, auto-cleaned on schema init)

## API: app/api/game-rooms/
- POST /api/game-rooms → create room, returns PIN
- GET /api/game-rooms/[pin]?playerId=X → poll state (strips correctAnswer during 'question' phase)
- PATCH /api/game-rooms/[pin] → actions: join | start | answer | advance | finish (all wrapped in DB transaction; host-only actions verified via requesterId vs host_id)
- DELETE /api/game-rooms/[pin]?requesterId=X → host closes room (verified)

## Security design
- correctAnswer stripped from GET responses during 'question' phase (only exposed in 'reveal'/'done')
- Host-only actions (start/advance/finish/delete) verified server-side via requesterId === host_id
- PATCH uses explicit BEGIN/COMMIT transaction with FOR UPDATE row lock
- Poll responses with older `version` than current are ignored client-side (stale guard)

**Why:** Code review flagged answer leakage + missing authorization as Critical. These patterns must be maintained for any future game room mutations.

**How to apply:** Any new room action must: (1) pass requesterId, (2) check host for privileged ops, (3) run inside a transaction, (4) increment version.
