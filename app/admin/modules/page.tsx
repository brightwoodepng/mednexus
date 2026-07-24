import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function ModulesPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")
  return <section className="max-w-3xl"><div className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">System</p><h1 className="mt-2 text-3xl font-bold">Modules &amp; Disciplines</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">Module and discipline structure is managed from the MCQ Bank while question metadata remains the source of truth.</p><a href="/admin/mcq" className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground transition-opacity hover:opacity-90">Open MCQ Bank</a></div></section>
}
