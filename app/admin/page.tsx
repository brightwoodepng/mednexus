import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { AdminDashboard, type DashboardData } from "@/components/admin/admin-dashboard"

async function fetchDashboardData(): Promise<DashboardData> {
  try {
    const { default: pool } = await import("@/lib/db")
    const [students, questions, liveAsmt, pending, recentAsmt, theoryQ] = await Promise.all([
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
    ])
    return {
      dbReady: true,
      students: students.rows[0]?.count ?? 0,
      mcqQuestions: questions.rows[0]?.count ?? 0,
      theoryQuestions: theoryQ.rows[0]?.count ?? 0,
      osceStations: 0,
      liveAssessments: liveAsmt.rows[0]?.count ?? 0,
      pendingApprovals: pending.rows[0]?.count ?? 0,
      recentAssessments: recentAsmt.rows,
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
    }
  }
}

export default async function AdminDashboardPage() {
  await getVerifiedAdminFromCookie()
  const data = await fetchDashboardData()
  return <AdminDashboard data={data} />
}
