/**
 * GET /api/theory/progress-data
 *
 * Returns the user's Theory Vault progress together with the full question
 * objects for bookmarks, revision queue, and notes in one round-trip.
 *
 * Response:
 *   {
 *     bookmarkedQuestions: TheoryQuestion[]
 *     revisionQuestions:   TheoryQuestion[]
 *     noteEntries:         Array<{ questionId: string; question: TheoryQuestion | null; note: string }>
 *     stats: { bookmarks: number; revision: number; notes: number; answered: number }
 *   }
 *
 * Auth: x-session-token or x-guest-token.
 */

import { NextRequest, NextResponse } from "next/server"
import { verifySessionToken } from "@/lib/session-auth"
import { verifyGuestToken } from "@/lib/guest-auth"
import type { TheoryQuestion } from "@/lib/types"

async function getPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch { return null }
}

function getVerifiedUid(req: NextRequest): string | null {
  const st = req.headers.get("x-session-token")
  if (st) return verifySessionToken(st)?.uid ?? null
  const gt = req.headers.get("x-guest-token")
  if (gt) return verifyGuestToken(gt)?.uid ?? null
  return null
}

function rowToQuestion(row: Record<string, unknown>): TheoryQuestion {
  const data = (row.data ?? {}) as Record<string, unknown>
  return {
    id:            row.id as string,
    category:      row.category as string,
    module:        row.module as string,
    setNumber:     row.set_number as number,
    prompt:        (row.prompt as string) ?? (data.prompt as string) ?? "",
    modelAnswer:   (row.model_answer as string) ?? (data.modelAnswer as string) ?? "",
    criticalFlags: (data.criticalFlags as string[]) ?? [],
    pastPapers:    (data.pastPapers    as string[]) ?? [],
    tags:          (row.tags           as string[]) ?? (data.tags as string[]) ?? [],
    collectionId:  (row.collection_id as "end_of_rotation" | "end_of_year") ?? "end_of_rotation",
    disciplineId:  (row.discipline_id as string) ?? "",
    setId:         (row.set_id as string | null) ?? null,
    markingPoints: (row.marking_points as string[]) ?? (data.markingPoints as string[]) ?? (data.criticalFlags as string[]) ?? [],
    sourceMetadata: (row.source_metadata as Record<string, unknown>) ?? {},
    pastPaperMetadata: (row.past_paper_metadata as Record<string, unknown>[]) ?? [],
    difficulty: (row.difficulty as "easy" | "medium" | "hard" | "expert") ?? "medium",
    estimatedStudyMinutes: (row.estimated_study_minutes as number) ?? 0,
    sortOrder: (row.sort_order as number) ?? 0,
    publicationStatus: (row.publication_status as "draft" | "published" | "unpublished") ?? "published",
    isArchived: (row.is_archived as boolean) ?? false,
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = getVerifiedUid(req)
    if (!uid) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const pool = await getPool()
    if (!pool) return NextResponse.json({ error: "No database" }, { status: 503 })

    // 1. Fetch user progress
    const progressRes = await pool.query(
      "SELECT data FROM mednexus_progress WHERE uid = $1",
      [uid],
    )
    const progress = (progressRes.rows[0]?.data ?? {}) as Record<string, unknown>

    const theoryBookmarks: string[] = Array.isArray(progress.theoryBookmarks)
      ? (progress.theoryBookmarks as string[])
      : []
    const revisionQueue: string[] = Array.isArray(progress.revisionQueue)
      ? (progress.revisionQueue as string[])
      : []
    const theoryNotes: Record<string, string> =
      progress.theoryNotes && typeof progress.theoryNotes === "object" && !Array.isArray(progress.theoryNotes)
        ? (progress.theoryNotes as Record<string, string>)
        : {}
    const theoryAnswered: string[] = Array.isArray(progress.theoryAnswered)
      ? (progress.theoryAnswered as string[])
      : []

    const noteIds = Object.keys(theoryNotes)

    // 2. Collect all unique question IDs across all three lists
    const allIds = Array.from(new Set([...theoryBookmarks, ...revisionQueue, ...noteIds]))

    // 3. Fetch corresponding theory questions in one query
    let questionMap = new Map<string, TheoryQuestion>()
    if (allIds.length > 0) {
      const qRes = await pool.query(
        `SELECT id, category, module, set_number, data, collection_id, discipline_id, set_id, prompt, model_answer, marking_points, tags, source_metadata, past_paper_metadata, difficulty, estimated_study_minutes, sort_order, publication_status, is_archived
           FROM mednexus_theory_questions
          WHERE id = ANY($1::text[])`,
        [allIds],
      )
      for (const row of qRes.rows) {
        questionMap.set(row.id as string, rowToQuestion(row))
      }
    }

    // 4. Build typed response arrays
    const bookmarkedQuestions = theoryBookmarks
      .map((id) => questionMap.get(id))
      .filter((q): q is TheoryQuestion => q !== undefined)

    const revisionQuestions = revisionQueue
      .map((id) => questionMap.get(id))
      .filter((q): q is TheoryQuestion => q !== undefined)

    const noteEntries = noteIds.map((qId) => ({
      questionId: qId,
      question:   questionMap.get(qId) ?? null,
      note:       theoryNotes[qId] ?? "",
    }))

    return NextResponse.json({
      bookmarkedQuestions,
      revisionQuestions,
      noteEntries,
      stats: {
        bookmarks: theoryBookmarks.length,
        revision:  revisionQueue.length,
        notes:     noteIds.length,
        answered:  theoryAnswered.length,
      },
    })
  } catch (err) {
    console.error("[theory/progress-data GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
