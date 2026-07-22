/**
 * /theory/study/[setId] — Theory Vault study session.
 *
 * Placeholder shell — ready to be replaced by the full study interface
 * in Prompt 4.  Displays the decoded set title so navigation is verifiable.
 */

import Link from "next/link"

interface StudyPageProps {
  params: Promise<{ setId: string }>
}

// Decode setId into human-readable parts.
// Format: "{categorySlug}--{moduleSlug}--set{num}"
function parseSetId(setId: string): { category: string; module: string; set: string } {
  const decoded = decodeURIComponent(setId)
  const parts   = decoded.split("--")
  if (parts.length < 3) return { category: decoded, module: "", set: "" }

  const category = parts[0].replace(/-/g, " ")
  const module   = parts.slice(1, -1).join(" ").replace(/-/g, " ")
  const set      = parts[parts.length - 1].replace("set", "Set ")

  return {
    category: category.charAt(0).toUpperCase() + category.slice(1),
    module:   module.charAt(0).toUpperCase() + module.slice(1),
    set:      set.charAt(0).toUpperCase() + set.slice(1),
  }
}

export default async function StudyPage({ params }: StudyPageProps) {
  const { setId } = await params
  const { category, module, set } = parseSetId(setId)

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-8 bg-background p-8 text-center">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-xs text-muted-foreground">
        <Link href="/theory" className="hover:text-foreground transition-colors">
          Theory Vault
        </Link>
        <span>/</span>
        <Link
          href={`/theory/browse?category=${encodeURIComponent(category.toLowerCase())}`}
          className="hover:text-foreground transition-colors capitalize"
        >
          {category}
        </Link>
        {module && (
          <>
            <span>/</span>
            <span className="capitalize">{module}</span>
          </>
        )}
        {set && (
          <>
            <span>/</span>
            <span className="capitalize">{set}</span>
          </>
        )}
      </nav>

      {/* Main card */}
      <div className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-amber-200/60 bg-gradient-to-br from-amber-50 to-orange-50 p-10 shadow-lg dark:border-amber-800/30 dark:from-amber-950/30 dark:to-orange-950/20">
        {/* Decorative blob */}
        <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-amber-200/30 blur-3xl dark:bg-amber-700/20" />

        <div className="relative flex flex-col items-center gap-5">
          {/* Icon */}
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/40">
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              width={32}
              height={32}
              className="text-amber-600 dark:text-amber-400"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>

          {/* Set info */}
          <div>
            {module && (
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400">
                {category} · {module}
              </p>
            )}
            <h1 className="mt-1 text-2xl font-extrabold text-foreground capitalize">
              {set || setId}
            </h1>
          </div>

          {/* Placeholder banner */}
          <div className="w-full rounded-2xl border border-amber-300/60 bg-white/60 px-6 py-5 dark:border-amber-700/30 dark:bg-amber-900/20">
            <p className="text-sm font-semibold text-foreground">
              Study Interface Loading Point
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Ready for Prompt 4 — the full long-form study session will render here.
            </p>
          </div>

          {/* Back link */}
          <Link
            href="/theory/browse"
            className="mt-2 flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
          >
            ← Back to Browse
          </Link>
        </div>
      </div>
    </div>
  )
}
