import { TheoryAdminHome } from "@/components/theory-admin-home"
export default async function TheoryAdminSectionPage({ params }: { params: Promise<{ section: string }> }) { const { section } = await params; return <TheoryAdminHome section={section} /> }
