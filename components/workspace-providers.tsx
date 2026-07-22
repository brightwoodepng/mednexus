"use client"

import type { ReactNode } from "react"
import { ThemeProvider } from "@/contexts/theme-context"
import { AppProvider } from "@/contexts/app-context"
import { AdminProvider } from "@/contexts/admin-context"
import { QuestionsProvider } from "@/contexts/questions-context"
import { StudyModeProvider } from "@/contexts/study-mode-context"
import { EconomyProvider } from "@/contexts/economy-context"
import { CurrentStudyModeProvider } from "@/contexts/current-study-mode-context"
import { ThematicCanvas } from "@/components/thematic-canvas"
import { AuthenticatedApplicationShell } from "@/components/authenticated-application-shell"

/** Shared provider tree for every authenticated workspace route. */
export function WorkspaceProviders({ children }: { children: ReactNode }) {
  return <ThemeProvider><ThematicCanvas /><AppProvider><AdminProvider><QuestionsProvider><StudyModeProvider><EconomyProvider><CurrentStudyModeProvider><AuthenticatedApplicationShell>{children}</AuthenticatedApplicationShell></CurrentStudyModeProvider></EconomyProvider></StudyModeProvider></QuestionsProvider></AdminProvider></AppProvider></ThemeProvider>
}
