import { redirect } from "next/navigation"
import { QuestionBankSourceManager } from "@/components/question-bank-source-manager"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"

export default async function QuestionBankSourcePage() {
  const admin = await getVerifiedAdminFromCookie("manage_system")
  if (admin?.role !== "SUPER_ADMIN") redirect("/admin")
  return <QuestionBankSourceManager />
}
