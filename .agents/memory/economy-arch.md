---
name: Virtual Economy Architecture
description: Nexus Points wallet, daily bounties, supply closet, and cosmetics store — schema, API routes, context, and UI integration
---

# Virtual Economy Architecture

## DB Tables (added to ensureSchema in lib/db.ts)
- `mednexus_wallet` — (uid PK, balance INTEGER, updated_at)
- `mednexus_bounty_progress` — (uid, bounty_id, bounty_date YYYY-MM-DD, progress, claimed) PK=(uid,bounty_id,bounty_date)
- `mednexus_user_inventory` — (uid, item_id, quantity) PK=(uid,item_id)

## Shared Constants (lib/economy.ts)
- `BOUNTY_POOL` — 10 defined bounties; `getTodaysBounties()` picks 3 deterministically by day number (LCG seed)
- `STORE_ITEMS` — lifelines (Consult Attending 150NP, Stat Labs 100NP) + cosmetics (titles 200-500NP)
- `calculatePayout()` — server-side NP calculator (participation 50 + accuracy/streak/newbest bonuses)
- `computeBountyProgress()` — maps GameResult to progress delta per bounty type

## API Routes (app/api/economy/)
- `wallet/route.ts` — GET balance by uid
- `bounties/route.ts` — GET today's 3 bounties+progress; POST to claim a completed bounty
- `store/route.ts` — GET catalog+inventory; POST purchase (atomic balance check + deduct + add inventory)
- `payout/route.ts` — POST game result → calculates NP earned, credits wallet, updates bounty progress in one transaction

## Context (contexts/economy-context.tsx)
- `EconomyProvider` wraps app in page.tsx (after AppProvider, uses user.uid)
- Exposes: balance, bounties, inventory, submitGameResult, claimBounty, purchase, refresh
- `submitGameResult()` called from GameOver component on mount (once, guarded by ref)

## UI (components/economy-panel.tsx)
- `WalletBadge` — amber pill showing balance, click opens store
- `DailyBountiesPanel` — progress bars + claim button; shown on ModeSelectScreen
- `StoreModal` — tabs: Lifelines / Cosmetics; shown via storeOpen state in ModeSelectScreen
- `PayoutResult` — NP breakdown card shown on GameOver screen after payout resolves

## GameOver Integration
- All 5 solo modes pass `gameResult` prop to GameOver
- GameOver calls submitGameResult on mount, renders PayoutResult when data arrives

**Why server-side payout:** Prevents client-side score inflation; client only sends raw game facts (mode, correct, total, streak).
