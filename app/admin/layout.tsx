import { redirect } from "next/navigation"
import { AdminShell } from "@/components/admin-shell"
import { getVerifiedAdminSnapshotFromCookie } from "@/lib/admin-access"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const admin = await getVerifiedAdminSnapshotFromCookie()
  if (!admin) redirect("/")
  return <AdminShell capabilities={admin.capabilities} identity={{ uid: admin.uid, name: admin.name, role: admin.role }}>{children}</AdminShell>
}
