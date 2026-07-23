import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function ModulesPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")
  return <section className="max-w-3xl"><p className="text-sm font-semibold tracking-wide text-cyan-300">SYSTEM</p><h1 className="mt-2 text-3xl font-bold">Modules &amp; Disciplines</h1><p className="mt-3 text-slate-400">Module and discipline structure is managed from the MCQ Bank while question metadata remains the source of truth.</p><a href="/admin/mcq" className="mt-6 inline-flex rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950">Open MCQ Bank</a></section>
}
