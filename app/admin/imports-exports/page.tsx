import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { ContentWorkspace } from "@/components/admin/content-workspace"

export default async function ImportsExportsPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")

  return <ContentWorkspace />
}
