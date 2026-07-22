/**
 * /theory/notes — Server Component page.
 * Renders the NotesView client component which fetches and displays
 * all theory questions where the user has saved a personal note.
 */

import Link from "next/link"
import { NotesView } from "@/components/theory/NotesView"

export default function NotesPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="mx-auto flex max-w-3xl items-center gap-3 px-4 py-3">
          <Link
            href="/theory"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
            title="Back to Theory Vault"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-teal-600 dark:text-teal-400">
              Theory Vault
            </p>
            <h1 className="text-sm font-bold text-foreground">My Notes</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <NotesView />
      </main>
    </div>
  )
}
