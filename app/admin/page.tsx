import { getVerifiedAdminSnapshotFromCookie } from "@/lib/admin-access"
import { AdminDashboard, type DashboardData } from "@/components/admin/admin-dashboard"
import { getQuestionBankDiagnostics } from "@/lib/question-bank-server"

async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const { default: pool } = await import("@/lib/db")
    const [students, questions, liveAsmt, pending, recentAsmt, theoryQ, mcqStatuses, theoryStatuses, activity, recentActivities, bankStatus, topTopics] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE status = 'approved'"),
      pool.query("SELECT COALESCE(jsonb_array_length(data), 0)::int AS count FROM mednexus_questions WHERE id = 1"),
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_assessments WHERE status = 'live'"),
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE status = 'pending'"),
      pool.query(`
        SELECT id, title, module_name, question_count, status, share_token, created_at::text
        FROM mednexus_assessments
        ORDER BY created_at DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count FROM mednexus_theory_questions
      `).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`
        SELECT LOWER(COALESCE(NULLIF(question.value->>'status',''),
          CASE WHEN question.value->>'moduleStatus'='live' THEN 'live' ELSE 'draft' END)) AS status,
          COUNT(*)::int AS count
        FROM mednexus_questions source
        CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) question(value)
        WHERE source.id=1 GROUP BY 1
      `).catch(() => ({ rows: [] })),
      pool.query(`SELECT status,COUNT(*)::int AS count FROM mednexus_theory_questions GROUP BY status`).catch(() => ({ rows: [] })),
      pool.query(`
        WITH days AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '13 days', CURRENT_DATE, INTERVAL '1 day'
          )::date AS day
        ), assessment_submissions AS (
          SELECT submitted_at::date AS day, COUNT(*)::int AS count
          FROM mednexus_assessment_attempts
          WHERE submitted_at >= CURRENT_DATE - INTERVAL '13 days'
          GROUP BY submitted_at::date
        ), theory_activity AS (
          SELECT occurred_at::date AS day, COUNT(*)::int AS count
          FROM mednexus_theory_recent_activity
          WHERE occurred_at >= CURRENT_DATE - INTERVAL '13 days'
          GROUP BY occurred_at::date
        ), registrations AS (
          SELECT created_at::date AS day, COUNT(*)::int AS count
          FROM mednexus_registered_users
          WHERE created_at >= CURRENT_DATE - INTERVAL '13 days'
          GROUP BY created_at::date
        )
        SELECT
          to_char(days.day, 'DD Mon') AS label,
          COALESCE(assessment_submissions.count, 0)::int AS assessment_submissions,
          COALESCE(theory_activity.count, 0)::int AS theory_activity,
          COALESCE(registrations.count, 0)::int AS registrations
        FROM days
        LEFT JOIN assessment_submissions ON assessment_submissions.day = days.day
        LEFT JOIN theory_activity ON theory_activity.day = days.day
        LEFT JOIN registrations ON registrations.day = days.day
        ORDER BY days.day
      `).catch(() => ({ rows: [] })),
      pool.query(`SELECT id,actor_id,action,resource_type,resource_id,details,created_at::text FROM mednexus_admin_audit_log ORDER BY created_at DESC LIMIT 8`).catch(() => ({ rows: [] })),
      getQuestionBankDiagnostics(),
      pool.query(`
        WITH ranked AS (
          SELECT assessment_id,user_id,is_guest,score,total,
            ROW_NUMBER() OVER (
              PARTITION BY assessment_id,user_id,is_guest
              ORDER BY score::numeric/NULLIF(total,0) DESC,submitted_at DESC
            ) AS attempt_rank
          FROM mednexus_assessment_attempts
          WHERE submitted_at IS NOT NULL
        )
        SELECT a.module_name AS topic,
          COUNT(*)::int AS attempts,
          COALESCE(ROUND(100.0*SUM(r.score)/NULLIF(SUM(r.total),0)),0)::int AS accuracy
        FROM ranked r
        JOIN mednexus_assessments a ON a.id=r.assessment_id
        WHERE r.attempt_rank=1
        GROUP BY a.module_name
        ORDER BY accuracy DESC,attempts DESC
        LIMIT 5
      `).catch(() => ({ rows: [] })),
    ])
    const mcqStatus = Object.fromEntries(mcqStatuses.rows.map(row => [String(row.status), Number(row.count)]))
    const theoryStatus = Object.fromEntries(theoryStatuses.rows.map(row => [String(row.status), Number(row.count)]))
    return {
      dbReady: true,
      students: students.rows[0]?.count ?? 0,
      mcqQuestions: questions.rows[0]?.count ?? 0,
      theoryQuestions: theoryQ.rows[0]?.count ?? 0,
      liveAssessments: liveAsmt.rows[0]?.count ?? 0,
      pendingApprovals: pending.rows[0]?.count ?? 0,
      workQueue: {
        mcqReview: mcqStatus.review ?? 0,
        theoryDrafts: theoryStatus.draft ?? 0,
        theoryReview: theoryStatus.review ?? 0,
        pendingUsers: pending.rows[0]?.count ?? 0,
        liveAssessments: liveAsmt.rows[0]?.count ?? 0,
      },
      contentStatus: { mcq: mcqStatus, theory: theoryStatus },
      recentAssessments: recentAsmt.rows,
      activity: activity.rows,
      recentActivities: recentActivities.rows,
      topTopics: topTopics.rows.map(row => ({ topic: row.topic || "Uncategorised", attempts: Number(row.attempts), accuracy: Number(row.accuracy) })),
      health: {
        database: true,
        questionBankSource: bankStatus.source,
        questionBankCount: bankStatus.count,
        gemini: Boolean(process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY),
        firestoreConfigured: bankStatus.firestore.configured,
        firestoreAvailable: bankStatus.firestore.available,
      },
    }
  } catch (err) {
    console.error("[admin/dashboard]", err)
    return {
      dbReady: false,
      students: 0,
      mcqQuestions: 0,
      theoryQuestions: 0,
      liveAssessments: 0,
      pendingApprovals: 0,
      workQueue: { mcqReview: 0, theoryDrafts: 0, theoryReview: 0, pendingUsers: 0, liveAssessments: 0 },
      contentStatus: { mcq: {}, theory: {} },
      recentAssessments: [],
      activity: [],
      recentActivities: [],
      topTopics: [],
      health: { database: false, questionBankSource: "unavailable", questionBankCount: 0, gemini: false, firestoreConfigured: false, firestoreAvailable: false },
    }
  }
}

export default async function AdminDashboardPage() {
  const admin = await getVerifiedAdminSnapshotFromCookie()
  if (!admin) return null
  const data = await fetchDashboardData()
  return <AdminDashboard data={data} capabilities={admin.capabilities} />
}
