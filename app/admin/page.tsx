import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

async function dashboardData() {
  try {
    const { default: pool } = await import("@/lib/db")
    const [learners, questions, live, pending] = await Promise.all([
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE status = 'approved'"),
      pool.query("SELECT COALESCE(jsonb_array_length(data), 0)::int AS count FROM mednexus_questions WHERE id = 1"),
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_assessments WHERE status = 'live'"),
      pool.query("SELECT COUNT(*)::int AS count FROM mednexus_registered_users WHERE status = 'pending'"),
    ])
    return { ready: true, learners: learners.rows[0]?.count ?? 0, questions: questions.rows[0]?.count ?? 0, live: live.rows[0]?.count ?? 0, pending: pending.rows[0]?.count ?? 0 }
  } catch (error) {
    console.error("[admin/dashboard]", error)
    return { ready: false, learners: null, questions: null, live: null, pending: null }
  }
}

export default async function AdminDashboard() {
  await getVerifiedAdminFromCookie()
  const data = await dashboardData()
  const cards = [["Registered learners", data.learners], ["MCQ questions", data.questions], ["Live assessments", data.live], ["Pending account approvals", data.pending]]
  return <>
    <header><p className="text-xs font-bold tracking-[0.16em] text-cyan-300">ADMINISTRATION</p><h1 className="mt-2 text-3xl font-bold tracking-tight">Dashboard</h1><p className="mt-2 max-w-2xl text-sm text-slate-400">Server-aggregated account, assessment, and question-bank data.</p></header>
    <section aria-label="Current platform counts" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{cards.map(([label, value]) => <div key={String(label)} className="rounded-xl border border-slate-800 bg-slate-900 p-5"><p className="text-sm text-slate-400">{label}</p><p className="mt-3 font-mono text-3xl font-bold text-white">{value === null ? "Unavailable" : value}</p></div>)}</section>
    <section className="mt-6 grid gap-5 lg:grid-cols-2"><div className="rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold">Recent administrative activity</h2><p className="mt-3 text-sm leading-6 text-slate-400">No administrative audit log is available yet. Activity will appear here when server-side audit events are implemented.</p></div><div className="rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold">System/database readiness</h2><p className={`mt-3 text-sm ${data.ready ? "text-emerald-300" : "text-amber-300"}`}>{data.ready ? "Database connection verified for this dashboard request." : "Database readiness could not be verified for this request."}</p><p className="mt-2 text-xs leading-5 text-slate-500">This status reflects only the current dashboard database query; it does not claim that all systems are operational.</p></div></section>
  </>
}
