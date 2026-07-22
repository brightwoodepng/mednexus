import { NextRequest, NextResponse } from "next/server"
import { requireTheoryCaller } from "@/lib/theory-auth"
import { getTheoryPool } from "@/lib/theory-api"

/**
 * Profile-sized Theory aggregates. Keep this deliberately separate from the
 * browse APIs: a profile must never need to download every Theory record just
 * to calculate a handful of counters.
 */
export async function GET(req: NextRequest) {
  const caller = requireTheoryCaller(req)
  if (caller instanceof NextResponse) return caller
  const pool = await getTheoryPool()
  if (!pool) return NextResponse.json({ error: "No database configured" }, { status: 503 })

  const visible = "q.publication_status='published' AND q.is_archived=FALSE"
  const [totals, collections, disciplines, sets, recent] = await Promise.all([
    pool.query(`SELECT COUNT(q.id)::int AS total, COUNT(rp.question_id)::int AS read,
      COUNT(cp.question_id)::int AS completed,
      COUNT(rp.question_id) FILTER (WHERE rp.last_read_at IS NOT NULL)::int AS model_answer_reviews,
      COUNT(DISTINCT b.question_id)::int AS bookmarks, COUNT(DISTINCT n.question_id)::int AS notes,
      COUNT(DISTINCT re.id) FILTER (WHERE re.completed_at IS NULL AND re.due_at <= NOW())::int AS revisions_due,
      COUNT(DISTINCT re.id) FILTER (WHERE re.completed_at IS NOT NULL)::int AS revisions_completed
      FROM mednexus_theory_questions q
      LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1
      LEFT JOIN mednexus_theory_bookmarks b ON b.question_id=q.id AND b.user_id=$1
      LEFT JOIN mednexus_theory_notes n ON n.question_id=q.id AND n.user_id=$1
      LEFT JOIN mednexus_theory_revision_entries re ON re.question_id=q.id AND re.user_id=$1 WHERE ${visible}`, [caller.uid]),
    pool.query(`SELECT c.id,c.title,COUNT(q.id)::int AS total,COUNT(cp.question_id)::int AS completed
      FROM mednexus_theory_collections c LEFT JOIN mednexus_theory_questions q ON q.collection_id=c.id AND ${visible}
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1 GROUP BY c.id,c.title ORDER BY c.title`, [caller.uid]),
    pool.query(`SELECT d.id,d.title,d.collection_id,COUNT(q.id)::int AS total,COUNT(cp.question_id)::int AS completed
      FROM mednexus_theory_disciplines d LEFT JOIN mednexus_theory_questions q ON q.discipline_id=d.id AND ${visible}
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1 GROUP BY d.id,d.title,d.collection_id ORDER BY d.title`, [caller.uid]),
    pool.query(`SELECT s.id,s.title,s.discipline_id,s.collection_id,COUNT(q.id)::int AS total,COUNT(cp.question_id)::int AS completed
      FROM mednexus_theory_sets s LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id AND ${visible}
      LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1 GROUP BY s.id,s.title,s.discipline_id,s.collection_id ORDER BY s.title`, [caller.uid]),
    pool.query(`SELECT a.activity_type,a.occurred_at,q.id AS question_id,q.prompt,q.collection_id,q.discipline_id,q.set_id
      FROM mednexus_theory_recent_activity a JOIN mednexus_theory_questions q ON q.id=a.question_id
      WHERE a.user_id=$1 AND ${visible} ORDER BY a.occurred_at DESC LIMIT 6`, [caller.uid]),
  ])
  return NextResponse.json({ totals: totals.rows[0], collections: collections.rows, disciplines: disciplines.rows, sets: sets.rows, recent: recent.rows })
}
