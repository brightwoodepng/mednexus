// POST /api/economy/daily-login
// Called once per app open (by EconomyProvider) for registered users.
// Idempotent within the same UTC calendar day — safe to call on every mount.

import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authError, identityMismatch } from "@/lib/request-auth"
import { processDailyLogin } from "@/lib/anti-farming"

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers)
    if (!auth) return authError()
    const { uid: suppliedUid } = await req.json()
    if (identityMismatch(suppliedUid, auth)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const uid = auth.uid

    // Guests never receive daily login NP
    if (!uid || typeof uid !== "string" || uid.startsWith("guest")) {
      return NextResponse.json({ alreadyDone: true, earned: 0, newStreak: 0, longestStreak: 0, milestoneName: null, breakdown: [] })
    }

    const result = await processDailyLogin(uid)
    return NextResponse.json(result)
  } catch (err) {
    console.error("[economy/daily-login POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
