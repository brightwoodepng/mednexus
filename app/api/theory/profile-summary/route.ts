import { NextRequest, NextResponse } from "next/server"
import { requireTheoryCaller } from "@/lib/theory-auth"
import { getTheoryPool } from "@/lib/theory-api"
import type { TheoryProfileSummary } from "@/lib/profile-models"

/**
 * A profile-specific aggregate, not a browse endpoint. Every learner-owned
 * table is aggregated independently to avoid join fan-out and no question
 * collection is sent to the browser merely to render profile counters.
 */
export async function GET(request: NextRequest) {
  const caller = requireTheoryCaller(request)
  if (caller instanceof NextResponse) return caller

  const pool = await getTheoryPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  const visible = "publication_status = 'published' AND is_archived = FALSE"
  const [metricsResult, disciplinesResult, setsResult, activityResult] = await Promise.all([
    pool.query(`WITH visible_questions AS (SELECT id, collection_id, discipline_id, set_id FROM mednexus_theory_questions WHERE ${visible})
      SELECT
        (SELECT COUNT(*)::int FROM visible_questions) AS total_questions,
        (SELECT COUNT(*)::int FROM mednexus_theory_reading_progress rp JOIN visible_questions q ON q.id = rp.question_id WHERE rp.user_id = $1) AS read_questions,
        (SELECT COUNT(*)::int FROM mednexus_theory_completion_progress cp JOIN visible_questions q ON q.id = cp.question_id WHERE cp.user_id = $1) AS completed_questions,
        (SELECT COUNT(*)::int FROM mednexus_theory_reading_progress rp JOIN visible_questions q ON q.id = rp.question_id WHERE rp.user_id = $1 AND rp.last_read_at IS NOT NULL) AS model_answer_reviews,
        (SELECT COUNT(*)::int FROM mednexus_theory_bookmarks b JOIN visible_questions q ON q.id = b.question_id WHERE b.user_id = $1) AS bookmarks,
        (SELECT COUNT(*)::int FROM mednexus_theory_notes n JOIN visible_questions q ON q.id = n.question_id WHERE n.user_id = $1) AS notes,
        (SELECT COUNT(*)::int FROM mednexus_theory_revision_entries re JOIN visible_questions q ON q.id = re.question_id WHERE re.user_id = $1 AND re.completed_at IS NULL AND re.due_at <= NOW()) AS revisions_due,
        (SELECT COUNT(*)::int FROM mednexus_theory_revision_entries re JOIN visible_questions q ON q.id = re.question_id WHERE re.user_id = $1 AND re.completed_at IS NOT NULL) AS completed_revisions`, [caller.uid]),
    pool.query(`SELECT d.id,d.title,d.collection_id,COUNT(q.id)::int AS total,COUNT(cp.question_id)::int AS completed
      FROM mednexus_theory_disciplines d
      LEFT JOIN mednexus_theory_questions q ON q.discipline_id=d.id AND q.collection_id=d.collection_id AND ${visible}
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1
      GROUP BY d.id,d.title,d.collection_id ORDER BY d.collection_id,d.sort_order`, [caller.uid]),
    pool.query(`SELECT s.id,s.title,s.collection_id,s.discipline_id,COUNT(q.id)::int AS total,COUNT(cp.question_id)::int AS completed
      FROM mednexus_theory_sets s
      LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id AND q.collection_id=s.collection_id AND q.discipline_id=s.discipline_id AND ${visible}
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1
      GROUP BY s.id,s.title,s.collection_id,s.discipline_id ORDER BY s.collection_id,s.discipline_id,s.sort_order`, [caller.uid]),
    pool.query(`SELECT a.question_id,a.set_id,a.activity_type,a.occurred_at,q.prompt
      FROM mednexus_theory_recent_activity a JOIN mednexus_theory_questions q ON q.id=a.question_id
      WHERE a.user_id=$1 AND q.${visible} ORDER BY a.occurred_at DESC LIMIT 8`, [caller.uid]),
  ])

  const m = metricsResult.rows[0]
  const collectionProgress = (collectionId: "end_of_rotation" | "end_of_year") => {
    const rows = [...disciplinesResult.rows.filter((row) => row.collection_id === collectionId)]
    return { completed: rows.reduce((sum, row) => sum + Number(row.completed), 0), total: rows.reduce((sum, row) => sum + Number(row.total), 0) }
  }
  const body: TheoryProfileSummary = {
    activeMode: "THEORY",
    metrics: {
      mode: "THEORY", collections: { end_of_rotation: collectionProgress("end_of_rotation"), end_of_year: collectionProgress("end_of_year") },
      readQuestions: Number(m.read_questions), completedQuestions: Number(m.completed_questions), modelAnswerReviews: Number(m.model_answer_reviews), bookmarks: Number(m.bookmarks), notes: Number(m.notes), revisionsDue: Number(m.revisions_due), completedRevisions: Number(m.completed_revisions),
    },
    disciplines: disciplinesResult.rows.map((row) => ({ id: row.id, title: row.title, collectionId: row.collection_id, completed: Number(row.completed), total: Number(row.total) })),
    sets: setsResult.rows.map((row) => ({ id: row.id, title: row.title, collectionId: row.collection_id, disciplineId: row.discipline_id, completed: Number(row.completed), total: Number(row.total) })),
    recentActivity: activityResult.rows.map((row) => ({ questionId: row.question_id, setId: row.set_id, activityType: row.activity_type, occurredAt: row.occurred_at, prompt: row.prompt })),
  }
  return NextResponse.json(body)
}
