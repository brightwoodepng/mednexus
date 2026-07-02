---
name: Game Mode Architecture
description: 7-mode game system — 5 solo + 2 multiplayer; polling-based realtime; mednexus_game_rooms table; secure scoring RPC; host-migration trigger
---

## Solo modes (components/game-mode.tsx)
- Rapid Fire, Sudden Death, Time Attack, Streak Master: pre-existing
- **Double Jeopardy** (new): vignette shown first → user wagers 10/25/50/100% of bank → options revealed → win/lose wager

## Multiplayer modes (components/game-mode-multiplayer.tsx)
- **Multiplayer Clash**: max 5 players, polling at 1.5s, host controls pace, full leaderboard between questions
- **Cohort Review**: unlimited players, split host/player views (host = full question; players = giant A/B/C/D buzzer squares), top-5 leaderboard

## DB: mednexus_game_rooms
Columns: pin (6-digit TEXT PK), mode, host_id, host_name, question_pool (JSONB), current_qi, phase (lobby|question|reveal|done), players (JSONB), version (INT), scored_uids (JSONB, default '[]'), expires_at (4h TTL, auto-cleaned on schema init)

## API: app/api/game-rooms/
- POST /api/game-rooms → create room, returns PIN
- GET /api/game-rooms/[pin]?playerId=X → poll state (strips correctAnswer during 'question' phase)
- PATCH /api/game-rooms/[pin] → actions: join | start | answer | advance | finish | place_wager | disconnect (all wrapped in DB transaction; host-only actions verified via requesterId vs host_id)
- DELETE /api/game-rooms/[pin]?requesterId=X → host closes room (verified)

## Secure Scoring RPC: app/api/game-rooms/[pin]/score/
- POST { match_id, playerId, user_answers_array: [{qi, answer}] }
- Verifies answers server-side against question_pool in DB (client never sends a score)
- Guards: room must be 'done', playerId must be in room.players, scored_uids dedup, qi dedup in payload
- Atomically credits mednexus_wallet + updates bounty progress in one transaction
- Returns { earned, newBalance, breakdown, bountyUpdates, serverStats }

## Host Migration DB Trigger (lib/db.ts, Step 4)
- Function: mednexus_migrate_host() — PL/pgSQL BEFORE UPDATE trigger
- When disconnect action sets a player's status='disconnected' and that player is host_id:
  - Finds oldest active (non-disconnected, non-spectator) player in players array
  - Updates host_id, host_name, rewrites isHost flags, bumps version
- Fires automatically on every UPDATE to mednexus_game_rooms; no app-layer code needed

## RoomPlayer type (game-mode-multiplayer.tsx)
- Added `status?: 'active' | 'disconnected'` field
- RoomState interface includes `version: number` (required for stale-poll guard at lines 850/851/868)

## Security design
- correctAnswer stripped from GET responses during 'question' phase (only exposed in 'reveal'/'done')
- Host-only actions (start/advance/finish/delete) verified server-side via requesterId === host_id
- disconnect action requires requesterId === playerId (no impersonation)
- PATCH uses explicit BEGIN/COMMIT transaction with FOR UPDATE row lock
- Poll responses with older `version` than current are ignored client-side (stale guard)
- scored_uids: server-side ledger preventing double-payout; qi dedup in score payload prevents inflation

**Why:** Code review flagged answer leakage + missing authorization as Critical. These patterns must be maintained for any future game room mutations. Scored_uids col added after second review caught double-payout gap.

**How to apply:** Any new room action must: (1) pass requesterId, (2) check host for privileged ops, (3) run inside a transaction, (4) increment version. Any multiplayer payout must go through /score RPC, never trust client-sent scores.
