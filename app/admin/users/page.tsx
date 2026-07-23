import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { AdminUserManagement } from "@/components/admin-user-management"

export default async function UsersPage() {
  if (!await getVerifiedAdminFromCookie("manage_users")) redirect("/admin")
  return <AdminUserManagement />
}
