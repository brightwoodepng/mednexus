/**
 * /theory — Theory Vault entry point.
 *
 * Uses the same provider stack as the root page so all contexts
 * (auth, progress, economy, etc.) are available.  CurrentStudyModeProvider
 * is set to "THEORY" on arrival via localStorage (written by the sidebar
 * popover before router.push("/theory")).
 *
 * The TheoryVaultShell is a Client Component that owns the sidebar + layout.
 */

import { ThematicCanvas } from "@/components/thematic-canvas"
import { ThemeProvider } from "@/contexts/theme-context"
import { AppProvider } from "@/contexts/app-context"
import { AdminProvider } from "@/contexts/admin-context"
import { QuestionsProvider } from "@/contexts/questions-context"
import { StudyModeProvider } from "@/contexts/study-mode-context"
import { EconomyProvider } from "@/contexts/economy-context"
import { CurrentStudyModeProvider } from "@/contexts/current-study-mode-context"
import { TheoryVaultShell } from "@/components/theory/TheoryVaultShell"

export const metadata = {
  title: "Theory Vault — MedNexus",
  description:
    "Long-form theory questions, model answers, and spaced-repetition revision for MedNexus students.",
}

export default function TheoryPage() {
  return (
    <ThemeProvider>
      <ThematicCanvas />
      <AppProvider>
        <AdminProvider>
          <QuestionsProvider>
            <StudyModeProvider>
              <EconomyProvider>
                <CurrentStudyModeProvider>
                  <TheoryVaultShell />
                </CurrentStudyModeProvider>
              </EconomyProvider>
            </StudyModeProvider>
          </QuestionsProvider>
        </AdminProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
