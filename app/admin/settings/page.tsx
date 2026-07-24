import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function SystemSettingsPage() {
  if (!await getVerifiedAdminFromCookie("manage_system")) redirect("/admin")

  return <section className="max-w-4xl"><div className="rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">System</p><h1 className="mt-2 text-3xl font-bold">System Settings</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Configure platform-wide controls from this protected workspace.</p></div><div className="mt-6 rounded-2xl border border-border bg-card p-6 shadow-sm"><h2 className="font-semibold">System settings are being prepared</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">Settings will appear here as their server-verified management features are implemented.</p></div></section>
}
