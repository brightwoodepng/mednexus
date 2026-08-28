import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { TheoryAdminSimplified } from "@/components/theory-admin-simplified"

export default async function TheoryAdminPage() {
  if (!await getVerifiedAdminFromCookie("manage_theory_content")) redirect("/admin")
  return <TheoryAdminSimplified />
}
