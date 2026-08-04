import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { McqBankWorkspace } from "@/components/admin/mcq-bank-workspace"

export default async function McqBankPage() {
  if (!await getVerifiedAdminFromCookie("manage_mcq_content")) redirect("/admin")

  return <section><McqBankWorkspace /></section>
}

