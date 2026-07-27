import "server-only"
import type { Pool } from "pg"

type Attempt = {
  id: string
  assessmentId: string
  participantId: string
  participantName: string
  isGuest: boolean
  score: number
  total: number
  answers: Record<string, string | null>
  submittedAt: string
}

export function percentage(attempt: Pick<Attempt, "score" | "total">) {
  return attempt.total > 0 ? Math.round(attempt.score / attempt.total * 100) : 0
}

export function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2)
}

export function bestAttempts(attempts: Attempt[]) {
  const best = new Map<string, Attempt>()
  for (const attempt of attempts) {
    const key = `${attempt.assessmentId}:${attempt.isGuest ? "guest" : "user"}:${attempt.participantId}`
    const previous = best.get(key)
    if (!previous || percentage(attempt) > percentage(previous) || (percentage(attempt) === percentage(previous) && attempt.submittedAt > previous.submittedAt)) best.set(key, attempt)
  }
  return [...best.values()]
}

export async function loadAttempts(pool: Pool, assessmentId?: string): Promise<Attempt[]> {
  const values = assessmentId ? [assessmentId] : []
  const filter = assessmentId ? "WHERE assessment_id=$1 AND submitted_at IS NOT NULL" : "WHERE submitted_at IS NOT NULL"
  const current = await pool.query(`
    SELECT id,assessment_id,user_id,user_name,is_guest,score,total,answers,submitted_at
    FROM mednexus_assessment_attempts ${filter}
    ORDER BY submitted_at DESC`, values)
  const attempts: Attempt[] = current.rows.map((row) => ({
    id: row.id, assessmentId: row.assessment_id, participantId: row.user_id,
    participantName: row.user_name, isGuest: row.is_guest === true,
    score: Number(row.score), total: Number(row.total), answers: row.answers ?? {},
    submittedAt: new Date(row.submitted_at).toISOString(),
  }))

  // Older guest submissions predate authenticated guest attempts. Include them
  // only when no matching modern guest submission exists.
  const legacyFilter = assessmentId ? "WHERE assessment_id=$1" : ""
  const legacy = await pool.query(`SELECT * FROM mednexus_guest_analytics ${legacyFilter} ORDER BY submitted_at DESC`, values)
  for (const row of legacy.rows) {
    const submittedAt = new Date(row.submitted_at).toISOString()
    const duplicate = attempts.some((attempt) => attempt.assessmentId === row.assessment_id
      && attempt.isGuest && attempt.participantName === row.guest_name
      && attempt.score === Number(row.score) && attempt.total === Number(row.total)
      && Math.abs(Date.parse(attempt.submittedAt) - Date.parse(submittedAt)) < 60_000)
    if (!duplicate) attempts.push({
      id: row.id, assessmentId: row.assessment_id,
      participantId: `legacy:${row.guest_name}`, participantName: row.guest_name,
      isGuest: true, score: Number(row.score), total: Number(row.total),
      answers: {}, submittedAt,
    })
  }
  return attempts
}

export type { Attempt }
