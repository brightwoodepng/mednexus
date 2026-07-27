import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { McqQuestionWorkspace } from "@/components/admin/mcq-question-workspace"

export default async function McqQuestionPage({ params }: { params: Promise<{ id: string }> }) {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")
  return <McqQuestionWorkspace id={(await params).id}/>
}
