import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { TheoryAdminManager } from "@/components/theory-admin-manager"

export default async function AdminTheorySection({ params }: { params: Promise<{ section: string }> }) {
  if (!await getVerifiedAdminFromCookie("manage_theory_content")) redirect("/admin")
  const { section } = await params
  const tab = section === "hierarchy" ? "hierarchy" : section === "settings" ? "settings" : section === "audit" ? "audit" : "questions"
  return <TheoryAdminManager initialTab={tab} />
}
