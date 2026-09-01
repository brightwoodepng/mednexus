import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { TheoryAdminSimplified } from "@/components/theory-admin-simplified"

export default async function AdminTheorySection({ params }: { params: Promise<{ section: string }> }) {
  if (!await getVerifiedAdminFromCookie("manage_theory_content")) redirect("/admin")
  const { section } = await params
  const initialTab = section === "import" ? "import" : section === "imports" ? "imports" : section === "trash" ? "trash" : "editor"
  return <TheoryAdminSimplified initialTab={initialTab} />
}
