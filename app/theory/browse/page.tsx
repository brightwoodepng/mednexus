/**
 * /theory/browse — Browse theory questions by category and discipline.
 *
 * Server Component: reads nothing server-side (search params are consumed
 * client-side via useSearchParams in TheoryBrowse). Renders the full
 * provider stack + TheoryVaultShell with initialSection="browse".
 */

import { ThematicCanvas }             from "@/components/thematic-canvas"
import { ThemeProvider }              from "@/contexts/theme-context"
import { AppProvider }                from "@/contexts/app-context"
import { AdminProvider }              from "@/contexts/admin-context"
import { QuestionsProvider }          from "@/contexts/questions-context"
import { StudyModeProvider }          from "@/contexts/study-mode-context"
import { EconomyProvider }            from "@/contexts/economy-context"
import { CurrentStudyModeProvider }   from "@/contexts/current-study-mode-context"
import { TheoryVaultShell }           from "@/components/theory/TheoryVaultShell"

export const metadata = {
  title: "Browse Questions — Theory Vault | MedNexus",
  description: "Browse theory question sets by discipline and category.",
}

export default function TheoryBrowsePage() {
  return (
    <ThemeProvider>
      <ThematicCanvas />
      <AppProvider>
        <AdminProvider>
          <QuestionsProvider>
            <StudyModeProvider>
              <EconomyProvider>
                <CurrentStudyModeProvider>
                  <TheoryVaultShell initialSection="browse" />
                </CurrentStudyModeProvider>
              </EconomyProvider>
            </StudyModeProvider>
          </QuestionsProvider>
        </AdminProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
