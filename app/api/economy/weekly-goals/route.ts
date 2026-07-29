import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { economyWeekId } from "@/lib/economy"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { weeklyGoalView, type WeeklyGoalProgress } from "@/lib/weekly-goals"
import { getActiveSeason } from "@/lib/economy-seasons"

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const weekId = economyWeekId()
    const season = await getActiveSeason(pool)
    const { rows } = await pool.query(
      `SELECT eligible_answered,eligible_correct,qualifying_exams,
              distinct_exam_dates,credited_goal_ids
       FROM mednexus_weekly_goal_progress
       WHERE season_id = $1 AND uid = $2 AND week_id = $3`,
      [season.id, auth.uid, weekId],
    )
    const row = rows[0]
    const progress: WeeklyGoalProgress = {
      weekId,
      eligibleAnswered: Number(row?.eligible_answered ?? 0),
      eligibleCorrect: Number(row?.eligible_correct ?? 0),
      qualifyingExams: Number(row?.qualifying_exams ?? 0),
      distinctExamDates: row?.distinct_exam_dates ?? [],
      creditedGoalIds: row?.credited_goal_ids ?? [],
    }
    return NextResponse.json({ weekId, progress, goals: weeklyGoalView(progress) })
  } catch (error) {
    console.error("weekly goals GET", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
