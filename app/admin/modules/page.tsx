import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { TaxonomyWorkspace } from "@/components/admin/taxonomy-workspace"

export default async function ModulesPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")
  return <TaxonomyWorkspace />
}
