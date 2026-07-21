// ── Progression Notifications ──────────────────────────────────────────────────
// Computes academic progress from a user's history and inserts one-shot
// notification records for module completion, discipline mastery, and Q-Bank
// milestones.  Every notification uses a deterministic ID, so
// ON CONFLICT DO NOTHING makes each event fire exactly once.

import type { Pool } from "pg"
import type { UserProgress, HistoryEntry } from "@/lib/types"

interface QuestionSummary {
  id: string
  module?: string
  subject: string
}

// Milestones in percentage of total Q-Bank answered (at least once)
const QBANK_MILESTONES = [25, 50, 75, 100]

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

/** Fetch all questions from the DB.  Returns [] if the table is empty. */
async function getQuestions(pool: Pool): Promise<QuestionSummary[]> {
  try {
    const res = await pool.query(
      "SELECT data FROM mednexus_questions WHERE id = 1",
    )
    const all = res.rows[0]?.data as QuestionSummary[] | undefined
    if (Array.isArray(all) && all.length > 0) return all
  } catch {
    // fall through
  }
  return []
}

/**
 * Called after every progress sync for registered users.
 * Examines the user's full history and inserts any newly-earned progression
 * notifications.  Never throws — all errors are swallowed so callers are
 * never affected.
 *
 * @param uid      The user's UID (guests are skipped automatically)
 * @param progress The full UserProgress object from the sync body
 * @param pool     A pg Pool (already validated by the caller)
 */
export async function triggerProgressionNotifications(
  uid: string,
  progress: UserProgress,
  pool: Pool,
): Promise<void> {
  // Only registered users — guest UIDs are ephemeral and have no inbox
  if (!uid || uid.startsWith("guest_")) return

  try {
    const questions = await getQuestions(pool)
    if (questions.length === 0) return

    const history: HistoryEntry[] = progress.history ?? []
    if (history.length === 0) return

    // ── Build lookup sets from history ─────────────────────────────────────
    // A question is "answered" if it appears at least once in history
    const answeredIds = new Set(history.map((h) => h.questionId))
    // A question is "mastered" if it has at least one correct answer
    const correctIds = new Set(
      history.filter((h) => h.isCorrect).map((h) => h.questionId),
    )

    const toInsert: Array<{ id: string; type: string; message: string }> = []

    // ── 1. Module Completion ───────────────────────────────────────────────
    // Group questions by their parent module
    const byModule = new Map<string, string[]>()
    for (const q of questions) {
      const mod = q.module?.trim() || "Uncategorized"
      if (!byModule.has(mod)) byModule.set(mod, [])
      byModule.get(mod)!.push(q.id)
    }

    for (const [moduleName, qIds] of byModule) {
      if (qIds.length === 0) continue
      const allAnswered = qIds.every((id) => answeredIds.has(id))
      if (!allAnswered) continue
      toInsert.push({
        id: `modcomplete-${uid}-${slugify(moduleName)}`,
        type: "module_complete",
        message: `✅ Module Complete: You just finished ${moduleName}. Great work!`,
      })
    }

    // ── 2. Discipline Mastery ──────────────────────────────────────────────
    // Group questions by subject (discipline tag)
    const byDiscipline = new Map<string, string[]>()
    for (const q of questions) {
      const disc = q.subject?.trim() || "General"
      if (!byDiscipline.has(disc)) byDiscipline.set(disc, [])
      byDiscipline.get(disc)!.push(q.id)
    }

    for (const [disciplineName, qIds] of byDiscipline) {
      if (qIds.length === 0) continue
      // Mastery requires every question answered correctly at least once
      const allMastered = qIds.every((id) => correctIds.has(id))
      if (!allMastered) continue
      toInsert.push({
        id: `discmaster-${uid}-${slugify(disciplineName)}`,
        type: "discipline_mastery",
        message: `🎓 Discipline Conquered! You have successfully completed all available questions for ${disciplineName}.`,
      })
    }

    // ── 3. Q-Bank Milestones ───────────────────────────────────────────────
    const totalQuestions = questions.length
    if (totalQuestions > 0) {
      const uniqueAnswered = answeredIds.size
      // Use Math.floor so a milestone is only hit when fully reached
      const pct = Math.floor((uniqueAnswered / totalQuestions) * 100)

      for (const milestone of QBANK_MILESTONES) {
        if (pct >= milestone) {
          toInsert.push({
            id: `qbank-${uid}-${milestone}`,
            type: "qbank_milestone",
            message: `📈 Milestone Reached! You have completed ${milestone}% of the entire Q-Bank.`,
          })
        }
      }
    }

    if (toInsert.length === 0) return

    // ── Bulk upsert — one round-trip, idempotent ───────────────────────────
    const values: unknown[] = []
    const placeholders: string[] = []
    let idx = 1
    for (const n of toInsert) {
      placeholders.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, FALSE)`)
      values.push(n.id, uid, n.type, n.message)
    }

    await pool.query(
      `INSERT INTO mednexus_user_notifications (id, user_id, type, message, is_read)
       VALUES ${placeholders.join(", ")}
       ON CONFLICT (id) DO NOTHING`,
      values,
    )
  } catch (err) {
    // Never let notification errors surface to the caller
    console.error("[progression-notifications]", err)
  }
}
