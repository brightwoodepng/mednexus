import { NextRequest, NextResponse } from "next/server"
import { getRequestAuth } from "@/lib/request-auth"
import { theoryDatabaseAvailable, theoryPool, theorySetDisplayProjection } from "@/lib/theory-server"

export async function GET(request: NextRequest) {
  if (!theoryDatabaseAvailable()) {
    return NextResponse.json({ error: "Theory Vault database is not configured." }, { status: 503 })
  }
  try {
    const pool = await theoryPool()
    const auth = await getRequestAuth(request)
    const userId = auth?.uid ?? null
    const profile = userId
      ? await pool.query("SELECT name FROM mednexus_registered_users WHERE uid=$1", [userId])
      : { rows: [] }
    const [totals, collections, resume, revision, counts, recent] = await Promise.all([
      pool.query(`SELECT COUNT(q.id)::int AS total,
        COUNT(CASE WHEN rp.completed_at IS NOT NULL THEN 1 END)::int AS completed
        FROM mednexus_theory_questions q
        LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
        WHERE q.status='published'`, [userId]),
      pool.query(`SELECT c.id,c.slug,c.title,c.kind,
        COUNT(DISTINCT COALESCE(m.id,d.id))::int AS groups,
        COUNT(DISTINCT q.set_id)::int AS sets,
        COUNT(DISTINCT q.id)::int AS total,
        COUNT(DISTINCT CASE WHEN rp.completed_at IS NOT NULL THEN q.id END)::int AS completed
        FROM mednexus_theory_collections c
        LEFT JOIN mednexus_theory_modules m ON m.collection_id=c.id
        LEFT JOIN mednexus_theory_disciplines d ON d.collection_id=c.id
        LEFT JOIN mednexus_theory_questions q ON q.collection_id=c.id AND q.status='published'
          AND (q.module_id=m.id OR q.discipline_id=d.id OR (q.module_id IS NULL AND q.discipline_id IS NULL))
        LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
        WHERE c.status='published' GROUP BY c.id ORDER BY c.sort_order,c.title`, [userId]),
      pool.query(`SELECT q.id,q.prompt,s.id AS "setId",s.name AS "setTitle",
        ${theorySetDisplayProjection("s")},
        c.title AS collection,COALESCE(m.name,d.name,'Unassigned') AS "groupName",
        rp.last_read_at AS "lastStudiedAt",
        (SELECT COUNT(*)::int FROM mednexus_theory_questions sq WHERE sq.set_id=q.set_id AND sq.status='published') AS "setTotal",
        (SELECT COUNT(*)::int FROM mednexus_theory_questions sq
          JOIN mednexus_theory_reading_progress srp ON srp.question_id=sq.id AND srp.user_id=$1
          WHERE sq.set_id=q.set_id AND sq.status='published' AND srp.completed_at IS NOT NULL) AS "setCompleted"
        FROM mednexus_theory_reading_progress rp
        JOIN mednexus_theory_questions q ON q.id=rp.question_id AND q.status='published'
        JOIN mednexus_theory_collections c ON c.id=q.collection_id
        LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
        LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
        WHERE rp.user_id=$1 ORDER BY rp.last_read_at DESC LIMIT 1`, [userId]),
      pool.query(`SELECT COUNT(*)::int AS count
        FROM mednexus_theory_revision_queue r
        JOIN mednexus_theory_questions q ON q.id=r.question_id AND q.status='published'
        WHERE r.user_id=$1 AND r.active`, [userId]),
      pool.query(`SELECT
        (SELECT COUNT(*)::int FROM mednexus_theory_bookmarks WHERE user_id=$1) AS bookmarks,
        (SELECT COUNT(*)::int FROM mednexus_theory_notes WHERE user_id=$1 AND body<>'') AS notes,
        (SELECT COUNT(*)::int FROM mednexus_theory_attempts WHERE user_id=$1 AND status='draft') AS drafts`, [userId]),
      pool.query(`SELECT DISTINCT ON (q.set_id) q.id,q.set_id AS "setId",s.name AS "setTitle",
        ${theorySetDisplayProjection("s")},
        c.title AS collection,COALESCE(m.name,d.name,'Unassigned') AS "groupName",
        rp.last_read_at AS "lastStudiedAt",
        (SELECT COUNT(*)::int FROM mednexus_theory_questions sq WHERE sq.set_id=q.set_id AND sq.status='published') AS total,
        (SELECT COUNT(*)::int FROM mednexus_theory_questions sq
          JOIN mednexus_theory_reading_progress srp ON srp.question_id=sq.id AND srp.user_id=$1
          WHERE sq.set_id=q.set_id AND sq.status='published' AND srp.completed_at IS NOT NULL) AS completed
        FROM mednexus_theory_reading_progress rp
        JOIN mednexus_theory_questions q ON q.id=rp.question_id AND q.status='published'
        JOIN mednexus_theory_collections c ON c.id=q.collection_id
        LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
        LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
        WHERE rp.user_id=$1 AND q.set_id IS NOT NULL
        ORDER BY q.set_id,rp.last_read_at DESC LIMIT 5`, [userId]),
    ])
    const recentSets = recent.rows.map(row => ({
      ...row,
      progressPercent: row.total ? Math.round(Number(row.completed) / Number(row.total) * 100) : 0,
    }))
    return NextResponse.json({
      authenticated: Boolean(auth),
      displayName: profile.rows[0]?.name ?? "Clinician",
      totals: totals.rows[0],
      collections: collections.rows,
      continueStudying: resume.rows[0] ?? null,
      counts: { ...counts.rows[0], revision: revision.rows[0]?.count ?? 0 },
      recentSets,
    })
  } catch (error) {
    console.error("[theory dashboard GET]", error)
    return NextResponse.json({ error: "Unable to load Theory dashboard." }, { status: 500 })
  }
}
