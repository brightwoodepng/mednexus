import { MedNexusApp } from "@/components/mednexus-app"
import { ThemeProvider } from "@/contexts/theme-context"
import { AppProvider } from "@/contexts/app-context"
import { QuestionsProvider } from "@/contexts/questions-context"
import { AdminProvider } from "@/contexts/admin-context"

/**
 * Provider order:
 *  1. ThemeProvider   — CSS variable theming
 *  2. AppProvider     — auth + progress (user-scoped)
 *  3. AdminProvider   — admin session (token-based)
 *  4. QuestionsProvider — shared question bank (DB-backed, polls every 30s)
 */
export default function Page() {
  return (
    <ThemeProvider>
      <AppProvider>
        <AdminProvider>
          <QuestionsProvider>
            <MedNexusApp />
          </QuestionsProvider>
        </AdminProvider>
      </AppProvider>
    </ThemeProvider>
  )
}
