import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function ImportsExportsPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")

  return <section className="max-w-4xl"><div className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Content management</p><h1 className="mt-2 text-3xl font-bold">Imports &amp; Exports</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Prepare bulk question imports and controlled exports from one protected workspace.</p></div><div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="font-semibold">Bulk import workspace is being prepared</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">The existing importer will move here after it no longer reads from the learner question provider and can commit directly through the protected content API.</p></div></section>
}
