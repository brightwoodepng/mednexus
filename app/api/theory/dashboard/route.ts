import { NextRequest, NextResponse } from "next/server"
import { requireTheoryCaller } from "@/lib/theory-auth"
import { getTheoryPool } from "@/lib/theory-api"

/** A learner-only overview. Every query is scoped to the verified Theory caller. */
export async function GET(req: NextRequest) {
  const caller = requireTheoryCaller(req)
  if (caller instanceof NextResponse) return caller
  const pool = await getTheoryPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  const visible = "q.publication_status='published' AND q.is_archived=FALSE"
  const [summary, hierarchy, recent, continueItem] = await Promise.all([
    pool.query(`SELECT
      COUNT(q.id)::int AS total,
      COUNT(rp.question_id)::int AS read,
      COUNT(cp.question_id)::int AS completed,
      COUNT(rp.question_id) FILTER (WHERE rp.last_read_at IS NOT NULL)::int AS model_answer_reviews,
      COUNT(DISTINCT b.question_id)::int AS saved,
      COUNT(DISTINCT n.question_id)::int AS notes,
      COUNT(DISTINCT re.id) FILTER (WHERE re.completed_at IS NULL AND re.due_at::date = CURRENT_DATE)::int AS due_today
      FROM mednexus_theory_questions q
      LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1
      LEFT JOIN mednexus_theory_bookmarks b ON b.question_id=q.id AND b.user_id=$1
      LEFT JOIN mednexus_theory_notes n ON n.question_id=q.id AND n.user_id=$1
      LEFT JOIN mednexus_theory_revision_entries re ON re.question_id=q.id AND re.user_id=$1
      WHERE ${visible}`, [caller.uid]),
    pool.query(`SELECT q.collection_id, c.title AS collection_title, q.discipline_id, d.title AS discipline_title,
      q.set_id, s.title AS set_title, COUNT(*)::int AS total, COUNT(rp.question_id)::int AS read,
      COUNT(cp.question_id)::int AS completed, COUNT(rp.question_id) FILTER (WHERE rp.last_read_at IS NOT NULL)::int AS model_answer_reviews,
      COUNT(DISTINCT re.id) FILTER (WHERE re.completed_at IS NOT NULL)::int AS revision_completed,
      COUNT(DISTINCT b.question_id)::int AS saved, COUNT(DISTINCT n.question_id)::int AS notes,
      MAX(a.occurred_at) AS recent_activity
      FROM mednexus_theory_questions q
      JOIN mednexus_theory_collections c ON c.id=q.collection_id
      JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id AND d.collection_id=q.collection_id
      LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id AND s.discipline_id=q.discipline_id AND s.collection_id=q.collection_id
      LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1
      LEFT JOIN mednexus_theory_bookmarks b ON b.question_id=q.id AND b.user_id=$1
      LEFT JOIN mednexus_theory_notes n ON n.question_id=q.id AND n.user_id=$1
      LEFT JOIN mednexus_theory_revision_entries re ON re.question_id=q.id AND re.user_id=$1
      LEFT JOIN mednexus_theory_recent_activity a ON a.question_id=q.id AND a.user_id=$1
      WHERE ${visible} GROUP BY q.collection_id,c.title,q.discipline_id,d.title,q.set_id,s.title
      ORDER BY recent_activity DESC NULLS LAST, collection_title, discipline_title, set_title` , [caller.uid]),
    pool.query(`SELECT a.occurred_at,a.activity_type,q.id,q.prompt,q.collection_id,c.title AS collection_title,
      q.discipline_id,d.title AS discipline_title,q.set_id,s.title AS set_title
      FROM mednexus_theory_recent_activity a JOIN mednexus_theory_questions q ON q.id=a.question_id
      JOIN mednexus_theory_collections c ON c.id=q.collection_id JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id AND d.collection_id=q.collection_id
      LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id WHERE a.user_id=$1 AND ${visible} ORDER BY a.occurred_at DESC LIMIT 8`, [caller.uid]),
    pool.query(`SELECT a.occurred_at,q.id,q.prompt,q.collection_id,q.discipline_id,q.set_id,c.title AS collection_title,d.title AS discipline_title,s.title AS set_title FROM mednexus_theory_recent_activity a
      JOIN mednexus_theory_questions q ON q.id=a.question_id JOIN mednexus_theory_collections c ON c.id=q.collection_id JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id AND d.collection_id=q.collection_id LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id WHERE a.user_id=$1 AND ${visible}
      ORDER BY a.occurred_at DESC LIMIT 1`, [caller.uid]),
  ])
  return NextResponse.json({ summary: summary.rows[0], hierarchy: hierarchy.rows, recent: recent.rows, continue: continueItem.rows[0] ?? null })
}
