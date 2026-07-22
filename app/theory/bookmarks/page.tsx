/**
 * /theory/bookmarks — Server Component page.
 * Renders the BookmarksView client component which fetches and displays
 * the user's bookmarked theory questions from /api/theory/progress-data.
 */

import Link from "next/link"
import { BookmarksView } from "@/components/theory/BookmarksView"

export default function BookmarksPage() {
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
            <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
              Theory Vault
            </p>
            <h1 className="text-sm font-bold text-foreground">Bookmarks</h1>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <BookmarksView />
      </main>
    </div>
  )
}
