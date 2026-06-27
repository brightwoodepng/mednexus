---
name: User Auth Architecture
description: How registered user auth works — DB schema, index number validation, OTP password reset, role-based landing page
---

## DB Table: mednexus_registered_users
- uid, name, level, index_number (formatted), password_hash (bcrypt), status ('approved'|'pending'|'rejected'), must_change_password BOOLEAN, otp_hash, created_at
- Separate from mednexus_users (which holds uid+name for all users including guests)

## Index Number Auto-Validation
- Strip all non-alphanumeric chars, match `/^sm(sms|gem)(\d{2})(\d{4})$/i`
- If match → format as `sm/sms/YY/NNNN` or `sm/gem/YY/NNNN`, status = 'approved'
- Otherwise → store raw trimmed lowercase, status = 'pending'
- Logic lives in both `/api/auth/register` and `/api/auth/login` (formatIndexNumber helper)

## OTP Reset Flow (Admin → User)
1. Admin hits PATCH `/api/admin/users/[uid]` with `{action: "reset-password"}`
2. Server generates 6-digit OTP, stores bcrypt hash in `otp_hash`, sets `must_change_password = TRUE`
3. Returns plaintext OTP to admin UI (OtpModal shows it with copy button)
4. User logs in with OTP as password → server detects otp_hash match → clears otp_hash, sets must_change_password = TRUE, returns `requiresPasswordUpdate: true`
5. App context stores flag in localStorage (`mednexus-requires-pw-update`)
6. ForcePasswordUpdate screen shown before full app access
7. User submits new password → PATCH `/api/auth/update-password` → clears must_change_password

## Role-Based Landing Page (auth-screen.tsx)
- Three cards: Create Account, Log In, Continue as Guest
- Guest: name only, generates UUID, same as old flow
- User: index number + password login via `/api/auth/login`
- Pending users → PendingApprovalScreen (not full app access)
- AppUser now has `role: 'guest' | 'user'`, `status`, `level`, `indexNumber` fields
- LS keys: mednexus-uid, mednexus-name, mednexus-role, mednexus-requires-pw-update

## Admin User Management
- GET `/api/admin/users` — search, filter by status, sort (name/created_at/status)
- PATCH `/api/admin/users/[uid]` — actions: approve, reject, reset-password
- DELETE `/api/admin/users/[uid]` — deletes from mednexus_registered_users + mednexus_users + mednexus_progress
- All routes protected by x-admin-token header (verifyAdminToken)
- UI: AdminUserManagement component, accessible via "Users" nav in admin sidebar section

**Why:** Required a full registered-user system on top of the existing anonymous UUID flow without breaking guests.
**How to apply:** Any future auth changes must handle both guest (role='guest') and user (role='user') branches in app-context.tsx. The mednexus_registered_users table is the source of truth for registered users; mednexus_users holds display names for all UIDs.
