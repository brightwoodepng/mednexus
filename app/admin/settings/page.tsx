import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function SystemSettingsPage() {
  if (!await getVerifiedAdminFromCookie("manage_system")) redirect("/admin")

  return <section className="max-w-4xl"><p className="text-sm font-semibold tracking-wide text-cyan-300">SYSTEM</p><h1 className="mt-2 text-3xl font-bold">System Settings</h1><p className="mt-3 max-w-2xl text-slate-400">Configure platform-wide controls from this protected workspace.</p><div className="mt-8 rounded-xl border border-slate-800 bg-slate-900 p-6"><h2 className="font-semibold">System settings are being prepared</h2><p className="mt-2 text-sm leading-6 text-slate-400">Settings will appear here as their server-verified management features are implemented.</p></div></section>
}
