---
name: Admin Auth System
description: How admin authentication works in MedNexus — token creation, verification, and client storage
---

## How it works
- `ADMIN_PASSWORD` is a Replit Secret set by the user.
- `ADMIN_SECRET` is a shared env var (non-sensitive) used for HMAC signing.
- `POST /api/admin/auth` validates the password and returns a base64url-encoded JSON token `{exp, sig}`.
- `GET /api/admin/auth` with `x-admin-token` header verifies the token (stateless).
- Token is valid 24 h; stored in localStorage under key `mednexus-admin-token`.
- `lib/admin-auth.ts` — `createAdminToken()` / `verifyAdminToken()` using Node crypto HMAC-SHA256.
- Admin API routes check `x-admin-token` header via `verifyAdminToken`.

**Why:** Stateless, no DB session table needed. Token expires in 24h automatically.

**How to apply:** Any new admin-only API route should call `verifyAdminToken(req.headers.get("x-admin-token") ?? "")`.
