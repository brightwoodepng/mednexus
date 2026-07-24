import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { QuestionEditor } from "@/components/question-editor"

export default async function McqBankPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")

  return <section><div className="mb-6"><p className="text-sm font-semibold tracking-wide text-primary">CONTENT MANAGEMENT</p><h1 className="mt-2 text-3xl font-bold">MCQ Bank</h1><p className="mt-3 max-w-2xl text-muted-foreground">Create, edit, import, and publish question-bank content.</p></div><QuestionEditor /></section>
}
