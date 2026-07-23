import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { LiveAssessmentsAdmin } from "@/components/live-assessments-admin"

export default async function AssessmentsPage() {
  if (!await getVerifiedAdminFromCookie("manage_assessments")) redirect("/admin")
  return <LiveAssessmentsAdmin />
}
