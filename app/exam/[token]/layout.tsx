import { ThemeProvider } from "@/contexts/theme-context"
import type { ReactNode } from "react"

export default function ExamLayout({ children }: { children: ReactNode }) {
  return <ThemeProvider>{children}</ThemeProvider>
}
