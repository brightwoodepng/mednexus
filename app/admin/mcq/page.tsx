import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { QuestionEditor } from "@/components/question-editor"

export default async function McqBankPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")

  return <section><div className="mb-6 rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7"><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary">Content management</p><h1 className="mt-2 text-3xl font-bold">MCQ Bank</h1><p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Create, edit, import, and publish question-bank content.</p></div><QuestionEditor /></section>
}
