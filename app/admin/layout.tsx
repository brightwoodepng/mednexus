import { redirect } from "next/navigation"
import { AdminShell } from "@/components/admin-shell"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!await getVerifiedAdminFromCookie()) redirect("/")
  const [mcq, theory, assessments, users, system, broadcasts] = await Promise.all([
    getVerifiedAdminFromCookie("manage_mcq_content"), getVerifiedAdminFromCookie("manage_theory_content"), getVerifiedAdminFromCookie("manage_assessments"),
    getVerifiedAdminFromCookie("manage_users"), getVerifiedAdminFromCookie("manage_system"), getVerifiedAdminFromCookie("manage_broadcasts"),
  ])
  return <AdminShell capabilities={{ mcq: Boolean(mcq), theory: Boolean(theory), assessments: Boolean(assessments), users: Boolean(users), system: Boolean(system), broadcasts: Boolean(broadcasts) }}>{children}</AdminShell>
}
