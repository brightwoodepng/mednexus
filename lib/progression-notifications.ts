// ── Progression Notifications ──────────────────────────────────────────────────
// Computes academic progress from a user's history and inserts one-shot
// notification records for module completion, discipline mastery, Q-Bank
// milestones, streak rewards, NP thresholds, discipline fatigue, and
// leaderboard rank changes.  Every notification uses a deterministic ID, so
// ON CONFLICT DO NOTHING makes each event fire exactly once.

import type { Pool } from "pg"
import type { UserProgress, HistoryEntry } from "@/lib/types"
import { getActiveSeason } from "@/lib/economy-seasons"

interface QuestionSummary {
  id: string
  module?: string
  subject: string
}

// Milestones in percentage of total Q-Bank answered (at least once)
const QBANK_MILESTONES = [25, 50, 75, 100]

// Streak day milestones that earn a notification
const STREAK_MILESTONES = [3, 7, 14]

// Total NP thresholds (lifetime wallet balance)
const NP_MILESTONES = [5_000, 10_000, 25_000, 50_000, 100_000]

// Minimum weekly NP in a single discipline before fatigue notification fires
const DISCIPLINE_FATIGUE_THRESHOLD = 1_000

/** Returns an ISO week key "YYYY-Www" to scope weekly notifications. */
function isoWeekKey(date: Date): string {
  const tmp = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  // ISO week: Thursday of the current week determines the year
  tmp.setUTCDate(tmp.getUTCDate() + 4 - (tmp.getUTCDay() || 7))
  const year = tmp.getUTCFullYear()
  const week = Math.ceil(
    ((tmp.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7,
  )
  return `${year}-W${String(week).padStart(2, "0")}`
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80)
}

let questionSummaryCache: { expiresAt: number; questions: QuestionSummary[] } | null = null

/** Fetch compact taxonomy fields only; never transfer answer or media payloads. */
async function getQuestions(pool: Pool): Promise<QuestionSummary[]> {
  if (questionSummaryCache && questionSummaryCache.expiresAt > Date.now()) {
    return questionSummaryCache.questions
  }
  try {
    const res = await pool.query(
      `SELECT jsonb_build_object(
         'id', question.value->'id',
         'module', question.value->'module',
         'subject', question.value->'subject'
       ) AS question
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data, '[]'::jsonb)) question(value)
       WHERE source.id=1`,
    )
    const questions = res.rows.map(row => row.question as QuestionSummary)
    questionSummaryCache = { questions, expiresAt: Date.now() + 5 * 60_000 }
    return questions
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

    // ── 4. Streak Milestones ───────────────────────────────────────────────
    const currentStreak = (progress as { streak?: number }).streak ?? 0
    for (const milestone of STREAK_MILESTONES) {
      if (currentStreak >= milestone) {
        toInsert.push({
          id: `streak-milestone-${uid}-${milestone}`,
          type: "streak",
          message: `🔥 You are on a ${milestone}-day streak! Keep it up to earn NP multipliers.`,
        })
      }
    }

    const activeSeason = await getActiveSeason(pool)

    // ── 5. NP Thresholds (wallet balance) ─────────────────────────────────
    try {
      const walletRes = await pool.query(
        "SELECT balance FROM mednexus_season_wallets WHERE season_id = $1 AND user_id = $2",
        [activeSeason.id, uid],
      )
      const balance: number = Number(walletRes.rows[0]?.balance ?? 0)
      for (const threshold of NP_MILESTONES) {
        if (balance >= threshold) {
          toInsert.push({
            id: `np-threshold-${uid}-${threshold}`,
            type: "economy",
            message: `💰 You just crossed ${threshold.toLocaleString()} Nexus Points! Head to the store to see what you can unlock.`,
          })
        }
      }
    } catch {
      // wallet table may not exist yet — skip silently
    }

    // ── 6. Discipline Fatigue ─────────────────────────────────────────────
    // Fire once per ISO week per discipline to avoid repeat spam
    const weekKey = isoWeekKey(new Date())
    try {
      const fatigueRes = await pool.query(
        `SELECT discipline, SUM(np_earned) AS total_np
         FROM mednexus_discipline_np_log
         WHERE season_id = $1 AND user_id = $2
           AND earned_date >= NOW() - INTERVAL '7 days'
         GROUP BY discipline
         HAVING SUM(np_earned) >= $3`,
        [activeSeason.id, uid, DISCIPLINE_FATIGUE_THRESHOLD],
      )
      for (const row of fatigueRes.rows) {
        const disc = String(row.discipline)
        toInsert.push({
          id: `discipline-fatigue-${uid}-${slugify(disc)}-${weekKey}`,
          type: "economy",
          message: `⚠️ You've mastered ${disc} for the week! Switch topics to keep earning NP.`,
        })
      }
    } catch {
      // table may not exist yet — skip silently
    }

    // ── 7. Weekly Leaderboard Top 3 ───────────────────────────────────────
    try {
      const lbRes = await pool.query(
        `SELECT user_id
           FROM mednexus_np_transactions
          WHERE season_id = $1 AND amount > 0
            AND created_at >= NOW() - INTERVAL '7 days'
          GROUP BY user_id
          ORDER BY SUM(amount) DESC, user_id
          LIMIT 3`,
        [activeSeason.id],
      )
      const isTop3 = lbRes.rows.some(
        (r: { user_id: string }) => r.user_id === uid,
      )
      if (isTop3) {
        toInsert.push({
          id: `leaderboard-top3-${uid}-${weekKey}`,
          type: "leaderboard",
          message: `🏆 You just broke into the Top 3 Weekly Scholars! Defend your rank!`,
        })
      }
    } catch {
      // wallet table may not exist yet — skip silently
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
