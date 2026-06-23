import { MedNexusApp } from "@/components/mednexus-app"
import { ThemeProvider } from "@/contexts/theme-context"
import { AppProvider } from "@/contexts/app-context"
import { QuestionsProvider } from "@/contexts/questions-context"

/**
 * MedNexus — premium clinical Q-Bank.
 *
 * Provider order matters:
 *  - ThemeProvider sets the `data-theme` attribute that drives all CSS variables.
 *  - AppProvider owns auth state, user progress, quiz history, and Firebase/localStorage syncing.
 *  - QuestionsProvider manages the live question bank (localStorage-backed, editable at runtime).
 */
export default function Page() {
  return (
    <ThemeProvider>
      <AppProvider>
        <QuestionsProvider>
          <MedNexusApp />
        </QuestionsProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
