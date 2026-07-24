import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function ImportsExportsPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")

  return <section className="max-w-4xl"><p className="text-sm font-semibold tracking-wide text-cyan-300">CONTENT MANAGEMENT</p><h1 className="mt-2 text-3xl font-bold">Imports &amp; Exports</h1><p className="mt-3 max-w-2xl text-slate-400">Prepare bulk question imports and controlled exports from one protected workspace.</p><div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold">Bulk import workspace is being prepared</h2><p className="mt-2 text-sm leading-6 text-slate-400">The existing importer will move here after it no longer reads from the learner question provider and can commit directly through the protected content API.</p></div></section>
}
