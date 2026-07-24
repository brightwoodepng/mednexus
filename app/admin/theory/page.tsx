import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function TheoryAdminPage() {
  if (!await getVerifiedAdminFromCookie("manage_theory_content")) redirect("/admin")
  return <section className="max-w-4xl"><div className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Content management</p><h1 className="mt-2 text-3xl font-bold">Theory Vault</h1><div className="mt-6 rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">Coming soon</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Theory Vault administration remains unavailable until its content models and editorial tools are ready.</p></div></div></section>
}
