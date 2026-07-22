import crypto from "crypto"
import type { TheoryQuestion } from "@/lib/types"

export async function getTheoryPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  return pool
}

export const publishedQuestionWhere = `q.publication_status = 'published' AND q.is_archived = FALSE`
export const publishedHierarchyWhere = `d.is_published = TRUE AND s.is_published = TRUE`
export const id = () => crypto.randomUUID()

export function questionFromRow(row: Record<string, any>): TheoryQuestion {
  const data = row.data ?? {}
  return { id: row.id, category: row.category ?? "", module: row.module ?? "", setNumber: row.set_number ?? 1,
    prompt: row.prompt ?? data.prompt ?? "", modelAnswer: row.model_answer ?? data.modelAnswer ?? "",
    criticalFlags: data.criticalFlags ?? [], pastPapers: data.pastPapers ?? [], tags: row.tags ?? data.tags ?? [],
    collectionId: row.collection_id ?? "end_of_rotation", disciplineId: row.discipline_id ?? "", setId: row.set_id ?? null,
    markingPoints: row.marking_points ?? data.markingPoints ?? [], sourceMetadata: row.source_metadata ?? {}, pastPaperMetadata: row.past_paper_metadata ?? [],
    difficulty: row.difficulty ?? "medium", estimatedStudyMinutes: row.estimated_study_minutes ?? 0, sortOrder: row.sort_order ?? 0,
    publicationStatus: row.publication_status ?? "published", isArchived: row.is_archived ?? false }
}

/** Counts are scoped to content currently visible to learners and a verified user. */
export async function hierarchyCounts(pool: any, uid: string, level: "collection" | "discipline" | "set") {
  const key = level === "collection" ? "q.collection_id" : level === "discipline" ? "q.discipline_id" : "q.set_id"
  const result = await pool.query(`
    SELECT ${key} AS id, COUNT(*)::int AS total,
      COUNT(cp.question_id)::int AS completed, COUNT(b.question_id)::int AS bookmarked,
      COUNT(r.id) FILTER (WHERE r.completed_at IS NULL AND r.due_at <= NOW())::int AS revision_due
    FROM mednexus_theory_questions q
    JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id AND d.collection_id=q.collection_id
    LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id AND s.discipline_id=q.discipline_id AND s.collection_id=q.collection_id
    LEFT JOIN mednexus_theory_completion_progress cp ON cp.question_id=q.id AND cp.user_id=$1
    LEFT JOIN mednexus_theory_bookmarks b ON b.question_id=q.id AND b.user_id=$1
    LEFT JOIN mednexus_theory_revision_entries r ON r.question_id=q.id AND r.user_id=$1
    WHERE ${publishedQuestionWhere} AND d.is_published AND (q.set_id IS NULL OR s.is_published)
    GROUP BY ${key}`, [uid])
  return Object.fromEntries(result.rows.map((row: any) => [row.id, { total: row.total, completed: row.completed, bookmarked: row.bookmarked, revisionDue: row.revision_due }]))
}

export function text(value: unknown, field: string, required = true): string | null {
  if (typeof value !== "string" || (required && !value.trim())) return null
  return value.trim()
}
