---
name: Three-Role Auth System
description: Landing page role selector (Guest/Student/Admin) with DB-backed registered users and local-only guests.
---

## Architecture

### Landing Page (`components/auth-screen.tsx`)
Three role cards → Guest | Student | Admin, each revealing its own panel below.
Footer always shows: "Created by Britechinc" + "For support contact admin" + WhatsApp icon linking to https://wa.me/233543982307 (number hidden from visible text).

### Roles

**Guest**
- Enters name only, gets a random UUID as uid
- localStorage flag `mednexus-guest = "1"`
- Progress saved to localStorage only, never synced to DB
- On logout (`signOutUser`) → `clearLocalForUser` wipes all localStorage keys for that uid

**Student (registered user)**
- Register: Name + Level + Index Number + Password → `POST /api/auth/register`
- Login: Index Number + Password → `POST /api/auth/login`
- `localStorage: mednexus-guest = "0"` — triggers cloud sync
- uid stored in DB, returned on login; used as key for mednexus_progress
- `isGuest: false` on AppUser → `scheduleSync` fires on every progress update

**Admin**
- Enters admin password → `loginAdmin()` from admin-context (existing HMAC token system)
- Then `enterApp("Admin")` to create a guest-type user session so the main app renders
- Admin reaches dashboard with all admin screens unlocked via `isAdmin` from admin-context

### DB Schema additions (mednexus_users)
```sql
ALTER TABLE mednexus_users ADD COLUMN IF NOT EXISTS level TEXT;
ALTER TABLE mednexus_users ADD COLUMN IF NOT EXISTS index_number TEXT;
ALTER TABLE mednexus_users ADD COLUMN IF NOT EXISTS password_hash TEXT;  -- bcrypt, 10 rounds
ALTER TABLE mednexus_users ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'guest';
CREATE UNIQUE INDEX IF NOT EXISTS mednexus_users_index_number_idx
  ON mednexus_users(index_number) WHERE index_number IS NOT NULL;
```

### API Routes
- `POST /api/auth/register` — { name, level, indexNumber, password } → { uid, name, level }
- `POST /api/auth/login`    — { indexNumber, password } → { uid, name, level }

### AppContext additions
- `loginUser(indexNumber, password)` → `{ ok, error? }`
- `registerUser(name, level, indexNumber, password)` → `{ ok, error? }`
- `enterApp(name)` — unchanged, creates guest session
- `AppUser.isGuest` boolean — controls whether `scheduleSync` fires

**Why:** Guest data must be self-contained (no DB writes) and fully wiped on logout. Registered users need cross-device persistence. Admin needs to reach the dashboard without being a registered student.

**How to apply:** When touching progress sync logic, always check `u.isGuest` before calling `scheduleSync`. When adding new user fields, add them to the mednexus_users table and the AppUser interface.
