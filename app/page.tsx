import { MedNexusApp } from "@/components/mednexus-app"
import { ThemeProvider } from "@/contexts/theme-context"
import { AppProvider } from "@/contexts/app-context"
import { QuestionsProvider } from "@/contexts/questions-context"
import { AdminProvider } from "@/contexts/admin-context"
import { StudyModeProvider } from "@/contexts/study-mode-context"
import { EconomyProvider } from "@/contexts/economy-context"

/**
 * Provider order:
 *  1. ThemeProvider      — CSS variable theming
 *  2. AppProvider        — auth + progress (user-scoped)
 *  3. AdminProvider      — admin session (token-based)
 *  4. QuestionsProvider  — shared question bank (DB-backed, polls every 30s)
 *  5. StudyModeProvider  — global trial/exam toggle (persisted to localStorage)
 *  6. EconomyProvider    — Nexus Points wallet, bounties, inventory
 */
export default function Page() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AdminProvider>
          <QuestionsProvider>
            <StudyModeProvider>
              <EconomyProvider>
                <MedNexusApp />
              </EconomyProvider>
            </StudyModeProvider>
          </QuestionsProvider>
        </AdminProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
