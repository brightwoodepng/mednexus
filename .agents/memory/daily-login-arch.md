---
name: Daily Login Reward System
description: Architecture for daily NP login rewards, streak tracking, and UI banner
---

## What it does
Awards Nexus Points (NP) once per UTC calendar day when a registered user opens the app. Idempotent — safe to call on every app mount.

## Key files
- `lib/anti-farming.ts` — `processDailyLogin(userId)` exported function
- `app/api/economy/daily-login/route.ts` — POST endpoint, rejects guests
- `contexts/economy-context.tsx` — fires call once per user.uid mount, sets `dailyLoginReward` state
- `components/dashboard.tsx` — renders dismissible amber banner when `dailyLoginReward.earned > 0`

## DB columns used
- `mednexus_registered_users.login_streak` — current consecutive-day streak
- `mednexus_registered_users.longest_streak` — all-time best
- `mednexus_registered_users.last_login_date` — TIMESTAMPTZ, compared as YYYY-MM-DD UTC

## Streak rules
- Same UTC calendar day → `alreadyDone: true`, no-op
- Last login = yesterday UTC → `login_streak + 1`
- Last login ≥ 2 days ago OR null → reset to 1

## NP payouts
Base: 25 NP always. Milestones: Day 3 +50, Day 7 +150, Day 14 +300, Day 30n (30/60/90…) +1000.

## Race condition safety
Uses `SELECT … FOR UPDATE` on the user row inside a transaction so concurrent calls don't double-award.

## Notification
Deterministic ID `login-{userId}-{YYYY-MM-DD}` in `mednexus_user_notifications` type='streak'. `ON CONFLICT DO NOTHING` makes it idempotent.

**Why:** Never call `processDailyLogin` from inside a payout transaction — it manages its own transaction.
