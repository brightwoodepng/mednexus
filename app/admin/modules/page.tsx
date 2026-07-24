import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function ModulesPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")
  return <section className="max-w-3xl"><p className="text-sm font-semibold tracking-wide text-primary">SYSTEM</p><h1 className="mt-2 text-3xl font-bold">Modules &amp; Disciplines</h1><p className="mt-3 text-muted-foreground">Module and discipline structure is managed from the MCQ Bank while question metadata remains the source of truth.</p><a href="/admin/mcq" className="mt-6 inline-flex rounded-lg bg-primary px-4 py-2 text-sm font-bold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">Open MCQ Bank</a></section>
}
