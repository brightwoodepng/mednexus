import { NextRequest, NextResponse } from "next/server"

/** A compact, learner-scoped aggregate for the Theory Vault landing page. */
export async function GET(request: NextRequest) {
  const learnerId = request.nextUrl.searchParams.get("userId") ?? "guest"
  const displayName = request.nextUrl.searchParams.get("name") ?? "Clinician"
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return NextResponse.json(emptyDashboard(displayName))
  }

  try {
    const { default: pool } = await import("@/lib/db")
    const [totals, collections, continueReading, revisions, counts, recent] = await Promise.all([
      pool.query(`SELECT COUNT(*)::int AS total, COUNT(rp.completed_at)::int AS completed
        FROM mednexus_theory_questions q LEFT JOIN mednexus_theory_reading_progress rp
        ON rp.question_id = q.id AND rp.user_id = $1 WHERE q.status = 'published'`, [learnerId]),
      pool.query(`SELECT c.id, c.title, COUNT(DISTINCT d.id)::int AS disciplines, COUNT(q.id)::int AS total,
        COUNT(rp.completed_at)::int AS completed, MAX(rp.last_read_at) AS "lastStudiedAt",
        (ARRAY_AGG(d.name ORDER BY rp.last_read_at DESC NULLS LAST))[1] AS "lastStudiedDiscipline"
        FROM mednexus_theory_collections c
        LEFT JOIN mednexus_theory_disciplines d ON d.collection_id = c.id
        LEFT JOIN mednexus_theory_questions q ON q.collection_id = c.id AND q.status = 'published'
        LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id = q.id AND rp.user_id = $1
        WHERE c.status = 'published' GROUP BY c.id, c.title ORDER BY c.title`, [learnerId]),
      pool.query(`SELECT q.id, q.prompt, c.title AS collection, d.name AS discipline, s.name AS "setTitle",
        rp.progress_percent AS "progressPercent", rp.last_read_at AS "lastReadAt",
        ROW_NUMBER() OVER (PARTITION BY q.set_id ORDER BY q.sort_order)::int AS "position",
        COUNT(*) OVER (PARTITION BY q.set_id)::int AS "setTotal"
        FROM mednexus_theory_reading_progress rp JOIN mednexus_theory_questions q ON q.id = rp.question_id
        JOIN mednexus_theory_collections c ON c.id = q.collection_id JOIN mednexus_theory_disciplines d ON d.id = q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id = q.set_id WHERE rp.user_id = $1 AND q.status = 'published'
        ORDER BY rp.last_read_at DESC LIMIT 1`, [learnerId]),
      pool.query(`SELECT COUNT(*) FILTER (WHERE due_at::date = CURRENT_DATE)::int AS due,
        COUNT(*) FILTER (WHERE due_at < CURRENT_DATE)::int AS overdue,
        COUNT(*) FILTER (WHERE due_at > CURRENT_DATE)::int AS upcoming,
        (ARRAY_AGG(json_build_object('id', q.id, 'prompt', q.prompt, 'dueAt', rs.due_at) ORDER BY rs.due_at))[1] AS next
        FROM mednexus_theory_revision_schedules rs JOIN mednexus_theory_questions q ON q.id = rs.question_id
        WHERE rs.user_id = $1 AND q.status = 'published'`, [learnerId]),
      pool.query(`SELECT (SELECT COUNT(*)::int FROM mednexus_theory_bookmarks WHERE user_id = $1) AS bookmarks,
        (SELECT COUNT(*)::int FROM mednexus_theory_notes WHERE user_id = $1 AND body <> '') AS notes`, [learnerId]),
      pool.query(`SELECT DISTINCT ON (COALESCE(q.set_id, q.discipline_id)) q.id, q.prompt, c.title AS collection,
        d.name AS discipline, COALESCE(s.name, d.name) AS "setTitle", rp.progress_percent AS "progressPercent", rp.last_read_at AS "lastReadAt"
        FROM mednexus_theory_reading_progress rp JOIN mednexus_theory_questions q ON q.id = rp.question_id
        JOIN mednexus_theory_collections c ON c.id=q.collection_id JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id WHERE rp.user_id=$1 AND q.status='published'
        ORDER BY COALESCE(q.set_id, q.discipline_id), rp.last_read_at DESC`, [learnerId]),
    ])
    return NextResponse.json({ displayName, totals: totals.rows[0], collections: collections.rows, continueReading: continueReading.rows[0] ?? null, revisions: revisions.rows[0], counts: counts.rows[0], recentSets: recent.rows.slice(0, 5) })
  } catch (error) {
    console.error("[theory dashboard GET]", error)
    return NextResponse.json({ error: "Unable to load Theory dashboard" }, { status: 500 })
  }
}

function emptyDashboard(displayName: string) {
  return { displayName, totals: { total: 0, completed: 0 }, collections: [], continueReading: null, revisions: { due: 0, overdue: 0, upcoming: 0, next: null }, counts: { bookmarks: 0, notes: 0 }, recentSets: [] }
}
