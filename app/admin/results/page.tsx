import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function AssessmentResultsPage() {
  if (!await getVerifiedAdminFromCookie("manage_assessments")) redirect("/admin")

  return <section className="max-w-4xl"><p className="text-sm font-semibold tracking-wide text-cyan-300">ASSESSMENTS</p><h1 className="mt-2 text-3xl font-bold">Assessment Results</h1><p className="mt-3 max-w-2xl text-slate-400">Review participant outcomes and exports in one protected workspace.</p><div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold">Results reporting is being prepared</h2><p className="mt-2 text-sm leading-6 text-slate-400">Assessment-level analytics remain available from Live Assessments until the consolidated results feature is ready.</p></div></section>
}
