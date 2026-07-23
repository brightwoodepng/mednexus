import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import RoleManagement from "@/components/role-management"

export default async function RoleManagementPage() {
  // Keep the page protection on the same server-verified access path as its API.
  if (!await getVerifiedAdminFromCookie("manage_system")) redirect("/admin")
  return <RoleManagement />
}
