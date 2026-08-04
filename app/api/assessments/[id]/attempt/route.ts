import { NextRequest, NextResponse } from "next/server"
import { randomUUID } from "crypto"
import type { Pool, PoolClient } from "pg"
import { getRequestAuth, unauthorized } from "@/lib/request-auth"
import { boundedPagination } from "@/lib/api-efficiency"
import { loadAssessmentQuestions } from "@/lib/assessment-questions"
import { gradeAssessment, isAssessmentGradingMode } from "@/lib/assessment-grading"
import { optionalRuntimePool } from "@/lib/runtime-db"
import { assessmentErrorResponse } from "@/lib/assessment-api-errors"

async function getPool() {
  return optionalRuntimePool()
}

type AuthenticatedAccount = { uid: string; name: string; role: string; isGuest: boolean }

/** Resolve display identity from the account record, never from a client payload. */
async function getAuthenticatedAccount(pool: Pool, req: NextRequest): Promise<AuthenticatedAccount | null> {
  const auth = await getRequestAuth(req, { allowGuest: true })
  if (!auth) return null

  if (auth.isGuest) {
    const result = await pool.query(
      `SELECT uid, name, role FROM mednexus_guest_users
       WHERE uid = $1 AND expires_at > NOW()`,
      [auth.uid],
    )
    const guest = result.rows[0]
    return guest ? { uid: guest.uid, name: guest.name, role: guest.role, isGuest: true } : null
  }

  const result = await pool.query(
    "SELECT uid, name, role FROM mednexus_registered_users WHERE uid = $1",
    [auth.uid],
  )
  const user = result.rows[0]
  return user ? { uid: user.uid, name: user.name, role: user.role, isGuest: false } : null
}

function suppliedIdentityConflicts(body: Record<string, unknown>, account: AuthenticatedAccount) {
  return false // Identity fields are ignored; the account is always resolved server-side.
}

// GET /api/assessments/[id]/attempt
// Returns attempts owned by the authenticated registered user or guest.
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params
    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })
    const account = await getAuthenticatedAccount(pool, req)
    if (!account) return unauthorized()
    const { page, pageSize, offset } = boundedPagination(req.nextUrl.searchParams)

    const res = await pool.query(
      `SELECT id, assessment_id, score, total, started_at, submitted_at,
              COUNT(*) OVER()::int AS total_count
       FROM mednexus_assessment_attempts
       WHERE assessment_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL
       ORDER BY started_at DESC
       LIMIT $3 OFFSET $4`,
      [id, account.uid, pageSize, offset],
    )
    const attempts = res.rows.map((row) => ({
      id: row.id, assessmentId: row.assessment_id, userId: row.user_id,
      score: row.score, total: row.total, startedAt: row.started_at, submittedAt: row.submitted_at,
    }))
    return NextResponse.json({
      count: Number(res.rows[0]?.total_count ?? 0),
      attempts,
      page,
      pageSize,
      userName: account.name,
      role: account.role,
      isGuest: account.isGuest,
    })
  } catch (err) {
    console.error("[attempt GET]", err)
    return assessmentErrorResponse(err)
  }
}

// POST /api/assessments/[id]/attempt
// body: { answers }. Identity and scores are always derived server-side.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const pool = await getPool()
  if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

  let client: PoolClient | undefined
  try {
    const { id } = await params
    const body = await req.json() as Record<string, unknown>
    const account = await getAuthenticatedAccount(pool, req)
    if (!account) return unauthorized()
    if (suppliedIdentityConflicts(body, account)) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    const answers = body.answers && typeof body.answers === "object" && !Array.isArray(body.answers)
      ? body.answers as Record<string, string | null> : {}

    client = await pool.connect()
    await client.query("BEGIN")
    // Serialize attempt consumption for one assessment/user pair. This prevents
    // concurrent POSTs from both observing the same remaining attempt count.
    await client.query("SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))", [id, account.uid])

    const asmtRes = await client.query(
      `SELECT id,question_ids,tries_allowed,pass_mark,grading_mode,status
       FROM mednexus_assessments WHERE id = $1 FOR UPDATE`,
      [id],
    )
    const asmt = asmtRes.rows[0]
    if (!asmt) { await client.query("ROLLBACK"); return NextResponse.json({ error: "Assessment not found" }, { status: 404 }) }
    if (asmt.status !== "live") { await client.query("ROLLBACK"); return NextResponse.json({ error: "Assessment is not live" }, { status: 403 }) }

    const triesRes = await client.query(
      "SELECT COUNT(*) FROM mednexus_assessment_attempts WHERE assessment_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL",
      [id, account.uid],
    )
    const tries = Number(triesRes.rows[0]?.count ?? 0)
    if (tries >= asmt.tries_allowed) { await client.query("ROLLBACK"); return NextResponse.json({ error: "No tries remaining" }, { status: 403 }) }

    const gradingQuestions = await loadAssessmentQuestions(client, id, "grading") as Array<{ id: string; correctAnswer: string }>
    const correctAnswers = new Map(gradingQuestions.map((q) => [q.id, q.correctAnswer]))
    const questionIds = asmt.question_ids as string[]
    const gradingMode = isAssessmentGradingMode(asmt.grading_mode) ? asmt.grading_mode : "standard"
    const grade = gradeAssessment(questionIds, correctAnswers, answers, gradingMode, Number(asmt.pass_mark))
    const { score, total } = grade

    const bestRes = await client.query(
      "SELECT MAX(score) AS best_score FROM mednexus_assessment_attempts WHERE assessment_id = $1 AND user_id = $2 AND submitted_at IS NOT NULL",
      [id, account.uid],
    )
    const previousBest = bestRes.rows[0]?.best_score == null ? null : Number(bestRes.rows[0].best_score)
    const attemptId = `att-${randomUUID()}`
    await client.query(
      `INSERT INTO mednexus_assessment_attempts
         (id, assessment_id, user_id, user_name, is_guest, answers, score, total, submitted_at)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,NOW())`,
      [attemptId, id, account.uid, account.name, account.isGuest, JSON.stringify(answers), score, total],
    )
    await client.query("COMMIT")
    const attemptsUsed = tries + 1
    const reviewQuestions = attemptsUsed >= Number(asmt.tries_allowed)
      ? await loadAssessmentQuestions(pool, id, "full")
      : undefined
    return NextResponse.json({
      success: true,
      attemptId,
      score,
      total,
      percentage: grade.percentage,
      passed: grade.passed,
      breakdown: { correct: grade.correct, wrong: grade.wrong, unanswered: grade.unanswered },
      gradingMode,
      isNewHighScore: previousBest === null || score > previousBest,
      attemptsUsed,
      ...(reviewQuestions ? { reviewQuestions } : {}),
    })
  } catch (err) {
    if (client) await client.query("ROLLBACK").catch(() => undefined)
    console.error("[attempt POST]", err)
    return assessmentErrorResponse(err)
  } finally {
    client?.release()
  }
}
