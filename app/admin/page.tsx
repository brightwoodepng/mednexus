import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { AdminDashboard, type DashboardData } from "@/components/admin/admin-dashboard"

async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const { default: pool } = await import("@/lib/db")
    const [students, questions, liveAsmt, pending, recentAsmt, theoryQ, osceStations, activity] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE status = 'approved'"),
      pool.query("SELECT COALESCE(jsonb_array_length(data), 0)::int AS count FROM mednexus_questions WHERE id = 1"),
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_assessments WHERE status = 'live'"),
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE status = 'pending'"),
      pool.query(`
        SELECT id, title, module_name, question_count, status, created_at::text
        FROM mednexus_assessments
        ORDER BY created_at DESC
        LIMIT 6
      `),
      pool.query(`
        SELECT COUNT(*)::int AS count FROM mednexus_theory_questions
      `).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`
        SELECT COUNT(*)::int AS count FROM mednexus_osce_stations
      `).catch(() => ({ rows: [{ count: 0 }] })),
      pool.query(`
        WITH days AS (
          SELECT generate_series(
            CURRENT_DATE - INTERVAL '6 days', CURRENT_DATE, INTERVAL '1 day'
          )::date AS day
        ), assessment_attempts AS (
          SELECT submitted_at::date AS day, COUNT(*)::int AS count
          FROM mednexus_assessment_attempts
          WHERE submitted_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY submitted_at::date
        ), theory_activity AS (
          SELECT occurred_at::date AS day, COUNT(*)::int AS count
          FROM mednexus_theory_recent_activity
          WHERE occurred_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY occurred_at::date
        ), osce_attempts AS (
          SELECT started_at::date AS day, COUNT(*)::int AS count
          FROM mednexus_osce_station_attempts
          WHERE started_at >= CURRENT_DATE - INTERVAL '6 days'
          GROUP BY started_at::date
        )
        SELECT
          to_char(days.day, 'Dy') AS label,
          COALESCE(assessment_attempts.count, 0)::int AS assessment_attempts,
          COALESCE(theory_activity.count, 0)::int AS theory_activity,
          COALESCE(osce_attempts.count, 0)::int AS osce_attempts
        FROM days
        LEFT JOIN assessment_attempts ON assessment_attempts.day = days.day
        LEFT JOIN theory_activity ON theory_activity.day = days.day
        LEFT JOIN osce_attempts ON osce_attempts.day = days.day
        ORDER BY days.day
      `).catch(() => ({ rows: [] })),
    ])
    return {
      dbReady: true,
      students: students.rows[0]?.count ?? 0,
      mcqQuestions: questions.rows[0]?.count ?? 0,
      theoryQuestions: theoryQ.rows[0]?.count ?? 0,
      osceStations: osceStations.rows[0]?.count ?? 0,
      liveAssessments: liveAsmt.rows[0]?.count ?? 0,
      pendingApprovals: pending.rows[0]?.count ?? 0,
      recentAssessments: recentAsmt.rows,
      activity: activity.rows,
    }
  } catch (err) {
    console.error("[admin/dashboard]", err)
    return {
      dbReady: false,
      students: 0,
      mcqQuestions: 0,
      theoryQuestions: 0,
      osceStations: 0,
      liveAssessments: 0,
      pendingApprovals: 0,
      recentAssessments: [],
      activity: [],
    }
  }
}

export default async function AdminDashboardPage() {
  await getVerifiedAdminFromCookie()
  const data = await fetchDashboardData()
  return <AdminDashboard data={data} />
}
