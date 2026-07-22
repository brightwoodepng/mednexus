import { TheoryVaultEditor } from "@/components/theory/TheoryVaultEditor"

export const metadata = { title: "Theory Vault Editor — MedNexus" }

/** Mode-specific authoring workspace; shared admin controls remain in the app shell. */
export default function TheoryAdminPage() {
  return <TheoryVaultEditor />
}
