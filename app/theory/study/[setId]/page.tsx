/**
 * /theory/study/[setId] — Theory Vault study session.
 *
 * Server Component: decodes the setId, fetches questions directly from the DB,
 * and passes them to the interactive <TheoryStudyInterface> client component.
 *
 * setId format: "{categorySlug}--{moduleSlug}--set{num}"
 *   e.g. "module--internal-medicine--set1"
 */

import Link from "next/link"
import { TheoryStudyInterface } from "@/components/theory/TheoryStudyInterface"
import type { TheoryQuestion } from "@/lib/types"

// ── Constants ─────────────────────────────────────────────────────────────────

const SET_SIZE = 20

const CATEGORY_LABELS: Record<string, string> = {
  module: "End of Module",
  year:   "End of Year",
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
}

interface ParsedSetId {
  categorySlug: string
  moduleSlug:   string
  setIndex:     number
}

function parseSetId(raw: string): ParsedSetId {
  const decoded = decodeURIComponent(raw)
  const parts   = decoded.split("--")

  if (parts.length < 3) {
    return { categorySlug: decoded, moduleSlug: "", setIndex: 1 }
  }

  const categorySlug = parts[0]
  const setMarker    = parts[parts.length - 1]           // "set1", "set2", …
  const moduleSlug   = parts.slice(1, -1).join("--")     // handles multi-segment slugs
  const setIndex     = parseInt(setMarker.replace(/^set/i, ""), 10) || 1

  return { categorySlug, moduleSlug, setIndex }
}

// ── DB fetch (server-side, no auth token required) ────────────────────────────

interface SetData {
  questions:           TheoryQuestion[]
  setTitle:            string
  moduleDisplayName:   string
  categoryDisplayName: string
}

async function fetchSetData(
  categorySlug: string,
  moduleSlug:   string,
  setIndex:     number,
): Promise<SetData | null> {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null

  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()

    // Fetch all questions for the given category ordered consistently
    const result = await pool.query<{
      id:         string
      category:   string
      module:     string
      set_number: number
      data:       Record<string, unknown>
      collection_id?: "end_of_rotation" | "end_of_year"
      prompt?: string
      model_answer?: string
      discipline_id?: string
      set_id?: string | null
      marking_points?: string[]
      tags?: string[]
      source_metadata?: Record<string, unknown>
      past_paper_metadata?: Record<string, unknown>[]
      difficulty?: "easy" | "medium" | "hard" | "expert"
      estimated_study_minutes?: number
      sort_order?: number
      publication_status?: "draft" | "published" | "unpublished"
      is_archived?: boolean
    }>(
      `SELECT id, category, module, set_number, data, collection_id, discipline_id, set_id, prompt, model_answer, marking_points, tags, source_metadata, past_paper_metadata, difficulty, estimated_study_minutes, sort_order, publication_status, is_archived
         FROM mednexus_theory_questions
        WHERE LOWER(category) = LOWER($1)
        ORDER BY module, set_number ASC, created_at ASC`,
      [categorySlug],
    )

    // Map rows → TheoryQuestion
    const allQuestions: TheoryQuestion[] = result.rows.map((row) => ({
      id:            row.id,
      category:      row.category,
      module:        row.module,
      setNumber:     row.set_number,
      prompt:        (row.prompt as string) ?? (row.data?.prompt as string) ?? "",
      modelAnswer:   (row.model_answer as string) ?? (row.data?.modelAnswer as string) ?? "",
      criticalFlags: (row.data?.criticalFlags as string[]) ?? [],
      pastPapers:    (row.data?.pastPapers    as string[]) ?? [],
      tags:          (row.tags as string[]) ?? (row.data?.tags as string[]) ?? [],
      collectionId:  row.collection_id ?? "end_of_rotation",
      disciplineId:  row.discipline_id ?? "",
      setId:         row.set_id ?? null,
      markingPoints: row.marking_points ?? (row.data?.markingPoints as string[]) ?? (row.data?.criticalFlags as string[]) ?? [],
      sourceMetadata: row.source_metadata ?? {},
      pastPaperMetadata: row.past_paper_metadata ?? [],
      difficulty: row.difficulty ?? "medium",
      estimatedStudyMinutes: row.estimated_study_minutes ?? 0,
      sortOrder: row.sort_order ?? 0,
      publicationStatus: row.publication_status ?? "published",
      isArchived: row.is_archived ?? false,
    }))

    // Group by slugified module name
    const moduleMap = new Map<string, TheoryQuestion[]>()
    for (const q of allQuestions) {
      const key = slugify(q.module)
      if (!moduleMap.has(key)) moduleMap.set(key, [])
      moduleMap.get(key)!.push(q)
    }

    const moduleQuestions = moduleMap.get(moduleSlug) ?? []

    // Slice to the correct set of 20
    const start        = (setIndex - 1) * SET_SIZE
    const setQuestions = moduleQuestions.slice(start, start + SET_SIZE)

    const moduleDisplayName   = moduleQuestions[0]?.module
      ?? moduleSlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    const categoryDisplayName = CATEGORY_LABELS[categorySlug]
      ?? categorySlug.replace(/\b\w/g, (c) => c.toUpperCase())

    return {
      questions:           setQuestions,
      setTitle:            `Set ${setIndex}`,
      moduleDisplayName,
      categoryDisplayName,
    }
  } catch (err) {
    console.error("[theory/study fetch]", err)
    return null
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────

interface StudyPageProps {
  params: Promise<{ setId: string }>
}

export default async function StudyPage({ params }: StudyPageProps) {
  const { setId }                                = await params
  const { categorySlug, moduleSlug, setIndex }   = parseSetId(setId)

  const browseUrl = `/theory/browse?category=${encodeURIComponent(categorySlug)}`
  const data      = await fetchSetData(categorySlug, moduleSlug, setIndex)

  // ── No DB ────────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <EmptyState
        browseUrl={browseUrl}
        title="Questions unavailable"
        body="No database is connected, or an error occurred while loading this set."
      />
    )
  }

  // ── Empty set ────────────────────────────────────────────────────────────
  if (data.questions.length === 0) {
    return (
      <EmptyState
        browseUrl={browseUrl}
        title="No questions in this set"
        body="This set hasn't been uploaded yet. Check back after the next content import."
      />
    )
  }

  // ── Happy path ───────────────────────────────────────────────────────────
  return (
    <TheoryStudyInterface
      questions={data.questions}
      setTitle={data.setTitle}
      moduleDisplayName={data.moduleDisplayName}
      categoryDisplayName={data.categoryDisplayName}
      browseUrl={browseUrl}
    />
  )
}

// ── Empty / error shell ────────────────────────────────────────────────────────

function EmptyState({
  browseUrl,
  title,
  body,
}: {
  browseUrl: string
  title:     string
  body:      string
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-8 text-center">
      <div className="w-full max-w-sm space-y-4">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-100 dark:bg-amber-900/30">
          {/* Book icon */}
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            width={28}
            height={28}
            className="text-amber-600 dark:text-amber-400"
          >
            <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
            <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
          </svg>
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">{title}</h1>
          <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        </div>
        <Link
          href={browseUrl}
          className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-amber-600"
        >
          ← Back to Browse
        </Link>
      </div>
    </div>
  )
}
