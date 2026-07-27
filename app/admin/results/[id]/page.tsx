import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { AssessmentResultDetail } from "@/components/admin/assessment-result-detail"

export default async function AssessmentResultPage({ params }: { params: Promise<{ id: string }> }) {
  if (!await getVerifiedAdminFromCookie("manage_assessments")) redirect("/admin")
  return <AssessmentResultDetail id={(await params).id} />
}
