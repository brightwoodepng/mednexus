import { redirect } from "next/navigation"
import { getVerifiedAdminSnapshotFromCookie } from "@/lib/admin-access"
import { TaxonomyWorkspace } from "@/components/admin/taxonomy-workspace"

export default async function ModulesPage() {
  const admin = await getVerifiedAdminSnapshotFromCookie()
  if (!admin || (!admin.capabilities.mcq && !admin.capabilities.theory)) redirect("/admin")
  return <TaxonomyWorkspace canManageMcq={admin.capabilities.mcq} canManageTheory={admin.capabilities.theory} />
}
