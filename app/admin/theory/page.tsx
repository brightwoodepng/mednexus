import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { TheoryAdminSimplified } from "@/components/theory-admin-simplified"

export default async function TheoryAdminPage({ searchParams }: { searchParams: Promise<{ kind?: string; status?: string }> }) {
  if (!await getVerifiedAdminFromCookie("manage_theory_content")) redirect("/admin")
  const params = await searchParams
  const initialKind = params.kind === "end_of_year" ? "end_of_year" : "end_of_module"
  const initialStatus = (["draft", "review", "published", "archived"] as const).find(status => status === params.status) ?? ""
  return <TheoryAdminSimplified initialKind={initialKind} initialStatus={initialStatus} />
}
