---
name: Game Store Modal
description: Architecture of the 3-tab GameStoreModal, cosmetics equip system, and multiplayer cosmetics rendering
---

## Structure

`components/game-store-modal.tsx` — replaces the old `StoreModal` from `economy-panel.tsx` in `game-mode.tsx`.

Three tabs, all backed by the existing purchase flow (`/api/economy/store`):
- **Supply Closet** — `category: "lifeline"` items (consumables, stackable)
- **The Vault** — `category: "vault"` items (`maxQuantity: 1`), each with `VAULT_META` for difficulty/steps/preview display
- **Cosmetics** — `category: "cosmetic"` items, sub-grouped by `cosmeticType: "title"|"frame"|"highlight"`; owned items show Equip/Unequip button

## Cosmetics Equip System

**DB table**: `mednexus_user_cosmetics` (uid PK, equipped_title, equipped_frame, equipped_highlight, updated_at)

**API**: `GET/PATCH /api/economy/cosmetics` — PATCH verifies ownership in `mednexus_user_inventory` before updating the equipped slot.

**Context**: `EconomyProvider` exposes `equippedCosmetics: EquippedCosmetics` and `equipCosmetic(type, itemId|null)`. Fetched in `refresh()` alongside wallet/bounties/inventory.

## Multiplayer Rendering

Cosmetics are embedded in the `RoomPlayer` record at join/create time:
- `CreateRoomScreen` passes `equippedCosmetics` to `apiCreateRoom()` → `POST /api/game-rooms`
- `JoinScreen` passes them in the join PATCH action → `app/api/game-rooms/[pin]/route.ts`

Both API routes store the three fields on the player object in the JSONB `players` array.

**`PlayerRow`** and **`Leaderboard`** in `game-mode-multiplayer.tsx` render:
- `equippedTitle` → amber badge via `TITLE_LABELS` lookup
- `equippedFrame` → ring class via `FRAME_RING_CLASSES` lookup
- `equippedHighlight` → row bg/border via `HIGHLIGHT_ROW_CLASSES` lookup

## Note on cosmetic spoofing

Multiplayer cosmetics are display-only and client-embedded; the server doesn't re-validate ownership at join time because the multiplayer player ID is a session-generated string unrelated to the DB uid. This is a known low-severity limitation consistent with the existing unauthenticated multiplayer design.

**Why:** The entire economy API uses uid-from-client as an existing design pattern. Only the equip endpoint (`/api/economy/cosmetics`) actually verifies inventory ownership, so purchased items are properly gated.
