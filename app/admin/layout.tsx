import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // Route pages enforce their own capability. The layout only verifies that this
  // is an approved administrator so one capability does not lock out another.
  if (!await getVerifiedAdminFromCookie()) redirect("/")

  return <div className="min-h-screen bg-slate-950 text-slate-100"><aside className="fixed inset-y-0 w-64 border-r border-slate-800 bg-slate-900 p-6"><a href="/admin" className="text-xl font-bold">MedNexus <span className="text-cyan-400">Console</span></a><nav className="mt-10 space-y-5 text-sm"><p className="font-bold text-slate-400">DASHBOARD</p><a href="/admin" className="block">Overview</a><p className="font-bold text-slate-400">CONTENT MANAGEMENT</p><a href="/admin/mcq" className="block">MCQ Bank</a><span className="block text-slate-500">Theory Vault — Coming soon</span><span className="block text-slate-500">OSCE Simulator — Coming soon</span><p className="font-bold text-slate-400">ASSESSMENTS</p><a href="/admin/assessments" className="block">Live Assessments</a><a href="/admin/results" className="block">Assessment Results</a><p className="font-bold text-slate-400">USER MANAGEMENT</p><a href="/admin/users" className="block">Users</a><a href="/admin/roles" className="block">Roles &amp; Permissions</a><p className="font-bold text-slate-400">SYSTEM</p><a href="/admin/imports-exports" className="block">Imports &amp; Exports</a><a href="/admin/notifications" className="block">Notifications</a><a href="/admin/settings" className="block">System Settings</a></nav><a href="/" className="absolute bottom-8 text-sm font-semibold text-cyan-300">← Return to Learner Workspace</a></aside><main className="ml-64 min-h-screen p-8">{children}</main></div>
}
