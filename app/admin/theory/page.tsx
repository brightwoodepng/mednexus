import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function TheoryAdminPage() {
  if (!await getVerifiedAdminFromCookie("manage_theory_content")) redirect("/admin")
  return <section className="max-w-4xl"><p className="text-sm font-semibold tracking-wide text-cyan-300">CONTENT MANAGEMENT</p><h1 className="mt-2 text-3xl font-bold">Theory Vault</h1><div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold">Coming soon</h2><p className="mt-2 text-sm leading-6 text-slate-400">Theory Vault administration remains unavailable until its content models and editorial tools are ready.</p></div></section>
}
