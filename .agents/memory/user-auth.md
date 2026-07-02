---
name: User Auth Architecture
description: Full user model — registered users, guest users, roles, session tokens, and DB schema
---

## Roles (UserRole type)
Three roles across the platform:
- `REGISTERED` — student with index number + password in `mednexus_registered_users`
- `GUEST` — password-free temporary session in `mednexus_guest_users` (7-day TTL)
- `ADMIN` — stateless HMAC admin token via `lib/admin-auth.ts`; no DB row required

## Master level list
`lib/levels.ts` is the single source of truth:
- Public levels: `CLASS_LEVELS` const array (Level 100–600, GEM 250, GEM 300)
- Hidden level: `ENTRANCE_LEVEL = "Entrance Level"` (kept separate from CLASS_LEVELS)
- Validator: `isValidLevel(value)` — use in all API routes that accept classLevel

## DB schema — mednexus_registered_users
Columns: uid (PK), name, level (legacy), class_level (canonical), role (DEFAULT 'REGISTERED'),
index_number (UNIQUE), password_hash, status, must_change_password, otp_hash, created_at

**Why two level columns**: `level` is the legacy column (used by pre-migration clients);
`class_level` is the canonical name going forward. Registration writes BOTH; login falls back to `level` if `class_level` is empty.

## DB schema — mednexus_guest_users
Columns: uid (PK, prefix `guest_`), name, class_level, role (DEFAULT 'GUEST'),
token_hash (SHA-256 of session token, for future revocation), created_at, expires_at (NOW() + 7 days)

Sweep: `DELETE FROM mednexus_guest_users WHERE expires_at < NOW()` runs every cold start.

## ensureSchema() migration order (CRITICAL)
Three sequential pool.query calls:
1. Enum creation (question_context_type, question_type) with `DO $$ ... $$` blocks
2. CREATE TABLE IF NOT EXISTS for all tables — new tables include role/class_level from the start
3. ALTER TABLE … ADD COLUMN IF NOT EXISTS for existing DBs + back-fill UPDATE + sweep DELETEs

**Why**: ALTER TABLE on mednexus_registered_users MUST come after its CREATE TABLE. Running ALTER before CREATE causes "relation does not exist" on fresh deployments.

## Guest session tokens — lib/guest-auth.ts
Format: `base64url(payload) + "." + base64url(HMAC-SHA256)`
Payload: `{ uid, role: "GUEST", exp: unix_epoch_seconds }`
Key: SESSION_SECRET env var — throws hard in production if unset; warns in development
Functions: `createGuestToken(uid, ttlHours=168)` / `verifyGuestToken(token) → payload | null`

Token is returned ONCE at creation (POST /api/auth/guest → GuestAuthResponse.sessionToken).
Server stores only SHA-256 hash (token_hash column) for optional future revocation.
Client sends token as `x-guest-token` header.

## API contracts

### POST /api/auth/guest
Body: `{ name: string, classLevel: AnyClassLevel }`
201 Response: `{ uid, name, classLevel, role:"GUEST", sessionToken, expiresAt, createdAt }`
422 Response: `{ error, validLevels[] }` — when classLevel fails isValidLevel()

### POST /api/auth/login
Returns: `{ uid, name, classLevel, level (legacy alias), role:"REGISTERED", status, indexNumber, requiresPasswordUpdate }`

### POST /api/auth/register
Accepts: `classLevel` (new) OR `level` (legacy) — resolves classLevel = classLevel ?? level ?? ""
Validates against isValidLevel() when non-empty
Returns: `{ uid, name, classLevel, level (legacy alias), role:"REGISTERED", status, indexNumber }`

## TypeScript types (lib/types.ts)
- `UserRole` = "ADMIN" | "REGISTERED" | "GUEST"
- `RegisteredUser` — includes `level` legacy alias alongside `classLevel`
- `GuestUser` — DB record shape (no sessionToken)
- `GuestAuthResponse extends GuestUser` — adds `sessionToken` for the creation response
- `AuthUser` = `RegisteredUser | GuestUser` (discriminated by `role`)
