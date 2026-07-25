import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { TheoryAdminManager } from "@/components/theory-admin-manager"

export default async function TheoryAdminPage() {
  if (!await getVerifiedAdminFromCookie("manage_theory_content")) redirect("/admin")
  return <TheoryAdminManager />
}
