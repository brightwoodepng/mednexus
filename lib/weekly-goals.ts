import type { PoolClient } from "pg"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { economyDate, economyWeekId } from "@/lib/economy"
import { applyNPCredits, type NPCredit } from "@/lib/np-ledger"

export type WeeklyGoalProgress = {
  weekId: string
  eligibleAnswered: number
  eligibleCorrect: number
  qualifyingExams: number
  distinctExamDates: string[]
  creditedGoalIds: string[]
}

function completedGoalIds(progress: WeeklyGoalProgress): string[] {
  return ECONOMY_CONFIG.weeklyGoals.filter(goal => {
    if (goal.type === "answers") return progress.eligibleAnswered >= (goal.minimumAnswers ?? 0)
    if (goal.type === "accuracy") {
      return progress.eligibleAnswered >= (goal.minimumAnswers ?? 0)
        && progress.eligibleCorrect * 100 >= (goal.minimumAccuracy ?? 0) * progress.eligibleAnswered
    }
    return progress.qualifyingExams >= (goal.qualifyingExams ?? 0)
      && progress.distinctExamDates.length >= (goal.distinctExamDates ?? 0)
  }).map(goal => goal.id)
}

/** Update verified activity and automatically credit newly completed goals in the caller's transaction. */
export async function recordWeeklyGoalActivity(
  client: PoolClient,
  uid: string,
  activity: { answered: number; correct: number; qualifyingExam?: boolean; occurredAt?: Date },
) {
  const weekId = economyWeekId(activity.occurredAt)
  const examDate = economyDate(activity.occurredAt)
  const result = await client.query(
    `INSERT INTO mednexus_weekly_goal_progress
       (uid, week_id, eligible_answered, eligible_correct, qualifying_exams, distinct_exam_dates)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (uid, week_id) DO UPDATE SET
       eligible_answered = mednexus_weekly_goal_progress.eligible_answered + EXCLUDED.eligible_answered,
       eligible_correct = mednexus_weekly_goal_progress.eligible_correct + EXCLUDED.eligible_correct,
       qualifying_exams = mednexus_weekly_goal_progress.qualifying_exams + EXCLUDED.qualifying_exams,
       distinct_exam_dates = CASE WHEN $5::integer > 0 THEN
         (SELECT jsonb_agg(value ORDER BY value) FROM (
           SELECT DISTINCT value FROM jsonb_array_elements_text(
             mednexus_weekly_goal_progress.distinct_exam_dates || EXCLUDED.distinct_exam_dates
           ) AS dates(value)
         ) unique_dates)
       ELSE mednexus_weekly_goal_progress.distinct_exam_dates END,
       updated_at = NOW()
     RETURNING *`,
    [uid, weekId, activity.answered, activity.correct, activity.qualifyingExam ? 1 : 0, JSON.stringify(activity.qualifyingExam ? [examDate] : [])],
  )
  const row = result.rows[0]
  const progress: WeeklyGoalProgress = {
    weekId,
    eligibleAnswered: Number(row.eligible_answered),
    eligibleCorrect: Number(row.eligible_correct),
    qualifyingExams: Number(row.qualifying_exams),
    distinctExamDates: row.distinct_exam_dates ?? [],
    creditedGoalIds: row.credited_goal_ids ?? [],
  }
  const newlyCompleted = completedGoalIds(progress).filter(id => !progress.creditedGoalIds.includes(id))
  const credits: NPCredit[] = newlyCompleted.map(id => ({
    source: "weekly_goal",
    sourceId: `${weekId}:${id}`,
    amount: ECONOMY_CONFIG.weeklyGoals.find(goal => goal.id === id)?.reward ?? 0,
    metadata: { weekId, goalId: id, automatic: true },
  }))
  const credited = await applyNPCredits(client, uid, credits)
  if (newlyCompleted.length) {
    progress.creditedGoalIds = [...new Set([...progress.creditedGoalIds, ...newlyCompleted])]
    await client.query(
      `UPDATE mednexus_weekly_goal_progress SET credited_goal_ids = $3::jsonb, updated_at = NOW()
       WHERE uid = $1 AND week_id = $2`,
      [uid, weekId, JSON.stringify(progress.creditedGoalIds)],
    )
  }
  return { progress, newlyCompleted, credited }
}

export function weeklyGoalView(progress: WeeklyGoalProgress) {
  return ECONOMY_CONFIG.weeklyGoals.map(goal => ({
    ...goal,
    progress: goal.type === "answers" ? progress.eligibleAnswered
      : goal.type === "accuracy" ? (progress.eligibleAnswered ? Math.round(progress.eligibleCorrect * 100 / progress.eligibleAnswered) : 0)
      : progress.distinctExamDates.length,
    target: goal.type === "answers" ? goal.minimumAnswers
      : goal.type === "accuracy" ? goal.minimumAccuracy
      : goal.distinctExamDates,
    completed: completedGoalIds(progress).includes(goal.id),
    credited: progress.creditedGoalIds.includes(goal.id),
  }))
}
