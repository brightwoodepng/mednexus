import { NextRequest, NextResponse } from "next/server"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { THEORY_AI_CONSENT_VERSION } from "@/lib/theory-ai"
import { theoryDatabaseAvailable, theoryPool } from "@/lib/theory-server"

export async function POST(request: NextRequest) {
  if (!theoryDatabaseAvailable()) {
    return NextResponse.json({ error: "Theory Vault database is not configured." }, { status: 503 })
  }
  const auth = await requireRegisteredUser(request)
  if (!auth) return unauthorized()

  try {
    const body = await request.json().catch(() => ({})) as Record<string, unknown>
    if (body.accepted !== true || body.version !== THEORY_AI_CONSENT_VERSION) {
      return NextResponse.json({ error: "Please accept the current AI privacy notice." }, { status: 400 })
    }
    const pool = await theoryPool()
    await pool.query(
      `INSERT INTO mednexus_theory_ai_consents (user_id, consent_version)
       VALUES ($1,$2)
       ON CONFLICT (user_id) DO UPDATE
         SET consent_version=EXCLUDED.consent_version, consented_at=NOW(), updated_at=NOW()`,
      [auth.uid, THEORY_AI_CONSENT_VERSION],
    )
    return NextResponse.json({ accepted: true, version: THEORY_AI_CONSENT_VERSION })
  } catch (error) {
    console.error("[theory ai consent]", error)
    return NextResponse.json({ error: "Unable to save AI consent." }, { status: 500 })
  }
}
