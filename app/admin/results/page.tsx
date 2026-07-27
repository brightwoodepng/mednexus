import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { AssessmentResultsWorkspace } from "@/components/admin/assessment-results-workspace"

export default async function AssessmentResultsPage() {
  if (!await getVerifiedAdminFromCookie("manage_assessments")) redirect("/admin")

  return <AssessmentResultsWorkspace />
}
