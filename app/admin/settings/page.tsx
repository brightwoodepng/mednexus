import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { SystemSettingsWorkspace } from "@/components/admin/system-settings-workspace"

export default async function SystemSettingsPage() {
  if (!await getVerifiedAdminFromCookie("manage_system")) redirect("/admin")

  return <SystemSettingsWorkspace />
}
