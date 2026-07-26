import { NextRequest, NextResponse } from "next/server"
import { geminiAvailable } from "@/lib/gemini"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import {
  hasCurrentTheoryAiConsent,
  THEORY_AI_CONSENT_VERSION,
  THEORY_AI_DAILY_LIMIT,
  theoryAiRemaining,
} from "@/lib/theory-ai"
import { theoryDatabaseAvailable, theoryPool } from "@/lib/theory-server"

export async function GET(request: NextRequest) {
  if (!theoryDatabaseAvailable()) {
    return NextResponse.json({ error: "Theory Vault database is not configured." }, { status: 503 })
  }
  const auth = await requireRegisteredUser(request)
  if (!auth) return unauthorized()

  try {
    const pool = await theoryPool()
    const [consented, remaining] = await Promise.all([
      hasCurrentTheoryAiConsent(pool, auth.uid),
      theoryAiRemaining(pool, auth.uid),
    ])
    return NextResponse.json({
      available: geminiAvailable(),
      consent: { required: !consented, version: THEORY_AI_CONSENT_VERSION },
      actions: { refineNote: true, transcribeNote: true, transcribeAnswer: true },
      dailyLimit: THEORY_AI_DAILY_LIMIT,
      remaining,
    })
  } catch (error) {
    console.error("[theory ai status]", error)
    return NextResponse.json({ error: "Unable to load AI study tools." }, { status: 500 })
  }
}
