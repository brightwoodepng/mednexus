import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { authenticateRequest, authError } from "@/lib/request-auth"
import { getActiveSeason, type EconomySeason } from "@/lib/economy-seasons"

type RankingTab = "weekly" | "monthly" | "alltime"

type LeaderboardDiagnostic = "ECONOMY_SEASON_MISSING" | "ECONOMY_SCHEMA_NOT_READY" | "LEADERBOARD_DATA_INVALID"

function databaseErrorCode(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error
    ? String((error as { code?: unknown }).code ?? "UNKNOWN")
    : "UNKNOWN"
}

function diagnosticFor(error: unknown): LeaderboardDiagnostic {
  const code = databaseErrorCode(error)
  const message = error instanceof Error ? error.message : ""
  if (message.includes("No active economy season")) return "ECONOMY_SEASON_MISSING"
  if (code === "42P01" || code === "42703" || code === "42883") return "ECONOMY_SCHEMA_NOT_READY"
  return "LEADERBOARD_DATA_INVALID"
}

function timedEntry(row: Record<string, unknown>) {
  const questions = Number(row.period_questions ?? 0)
  const correct = Number(row.period_correct ?? 0)
  return {
    rank: Number(row.public_rank),
    uid: String(row.uid),
    name: String(row.name),
    level: row.level,
    classLevel: row.class_level,
    np: Number(row.period_np ?? 0),
    accuracy: questions >= 50 ? Math.round((correct / questions) * 100) : 0,
    weeklyQuestions: questions,
    accuracySuppressed: questions > 0 && questions < 50,
    equippedTitle: row.equipped_title ?? null,
    equippedFrame: row.equipped_frame ?? null,
    equippedHighlight: row.equipped_highlight ?? null,
    equippedAvatar: row.equipped_avatar ?? null,
  }
}

function allTimeEntry(row: Record<string, unknown>) {
  return {
    rank: Number(row.public_rank),
    uid: String(row.uid),
    name: String(row.name),
    level: row.level,
    classLevel: row.class_level,
    np: Number(row.total_np ?? 0),
    rankPoints: Number(row.rank_points ?? 0),
    accuracy: Number(row.accuracy ?? 0),
    weeklyQuestions: null,
    accuracySuppressed: false,
    equippedTitle: row.equipped_title ?? null,
    equippedFrame: row.equipped_frame ?? null,
    equippedHighlight: row.equipped_highlight ?? null,
    equippedAvatar: row.equipped_avatar ?? null,
  }
}

async function timedLeaderboard(tab: "weekly" | "monthly", viewerUid: string | null, season: EconomySeason) {
  const periodDays = tab === "weekly" ? 7 : 30
  const cutoff = new Date(Date.now() - periodDays * 86_400_000).toISOString()
  const commonCtes = `
    WITH np AS (
      SELECT user_id, SUM(amount) AS period_np
      FROM mednexus_np_transactions
      WHERE amount > 0 AND season_id = $2
        AND created_at >= $1::timestamptz
      GROUP BY user_id
    ), da AS (
      SELECT user_id,
             SUM(questions_answered) AS period_questions,
             SUM(correct_answers) AS period_correct
      FROM mednexus_daily_activity
      WHERE activity_date >= LEFT($1::text, 10) AND season_id = $2
      GROUP BY user_id
    )
  `

  const publicResult = await pool.query(`${commonCtes},
    ranked AS (
      SELECT r.uid, r.name, r.level, r.class_level,
             COALESCE(np.period_np, 0) AS period_np,
             COALESCE(da.period_questions, 0) AS period_questions,
             COALESCE(da.period_correct, 0) AS period_correct,
             c.equipped_title, c.equipped_frame, c.equipped_highlight, c.equipped_avatar,
             ROW_NUMBER() OVER (
               ORDER BY COALESCE(np.period_np, 0) DESC,
                 CASE WHEN COALESCE(da.period_questions, 0) >= 50
                   THEN COALESCE(da.period_correct, 0)::numeric / NULLIF(da.period_questions, 0)
                   ELSE 0 END DESC,
                 r.uid ASC
             ) AS public_rank
      FROM mednexus_registered_users r
      LEFT JOIN np ON np.user_id = r.uid
      LEFT JOIN da ON da.user_id = r.uid
      LEFT JOIN mednexus_user_cosmetics c ON c.uid = r.uid
      WHERE r.is_private = FALSE
        AND r.status = 'approved'
        AND COALESCE(np.period_np, 0) > 0
    )
    SELECT * FROM ranked WHERE public_rank <= 50 ORDER BY public_rank`, [cutoff, season.id])

  const entries = publicResult.rows.map(timedEntry)
  let viewerEntry = viewerUid ? entries.find((entry) => entry.uid === viewerUid) ?? null : null

  if (viewerUid && !viewerEntry) {
    const viewerResult = await pool.query(`${commonCtes}
      SELECT r.uid, r.name, r.level, r.class_level,
             COALESCE(np.period_np, 0) AS period_np,
             COALESCE(da.period_questions, 0) AS period_questions,
             COALESCE(da.period_correct, 0) AS period_correct,
             c.equipped_title, c.equipped_frame, c.equipped_highlight, c.equipped_avatar
      FROM mednexus_registered_users r
      LEFT JOIN np ON np.user_id = r.uid
      LEFT JOIN da ON da.user_id = r.uid
      LEFT JOIN mednexus_user_cosmetics c ON c.uid = r.uid
      WHERE r.uid = $3`, [cutoff, season.id, viewerUid])

    const viewer = viewerResult.rows[0]
    if (viewer) {
      const viewerQuestions = Number(viewer.period_questions ?? 0)
      const viewerCorrect = Number(viewer.period_correct ?? 0)
      const viewerAccuracy = viewerQuestions >= 50 && viewerQuestions > 0 ? viewerCorrect / viewerQuestions : 0
      const rankResult = await pool.query(`${commonCtes}
        SELECT 1 + COUNT(*)::int AS exact_rank
        FROM mednexus_registered_users r
        LEFT JOIN np ON np.user_id = r.uid
        LEFT JOIN da ON da.user_id = r.uid
        WHERE r.is_private = FALSE
          AND r.status = 'approved'
          AND COALESCE(np.period_np, 0) > 0
          AND (
            COALESCE(np.period_np, 0) > $3 OR
            (COALESCE(np.period_np, 0) = $3 AND
              CASE WHEN COALESCE(da.period_questions, 0) >= 50
                THEN COALESCE(da.period_correct, 0)::numeric / NULLIF(da.period_questions, 0)
                ELSE 0 END > $4) OR
            (COALESCE(np.period_np, 0) = $3 AND
              CASE WHEN COALESCE(da.period_questions, 0) >= 50
                THEN COALESCE(da.period_correct, 0)::numeric / NULLIF(da.period_questions, 0)
                ELSE 0 END = $4 AND r.uid < $5)
          )`, [cutoff, season.id, Number(viewer.period_np ?? 0), viewerAccuracy, viewerUid])
      viewer.public_rank = Number(rankResult.rows[0]?.exact_rank ?? 1)
      viewerEntry = timedEntry(viewer)
    }
  }

  return { entries, viewerEntry, tab }
}

async function allTimeLeaderboard(viewerUid: string | null, season: EconomySeason) {
  const accuracySql = `
    CASE
      WHEN p.data IS NULL OR COALESCE(jsonb_typeof(p.data->'history'), 'null') <> 'array'
        OR jsonb_array_length(p.data->'history') = 0 THEN 0
      ELSE ROUND(100.0 *
        (SELECT COUNT(*) FROM jsonb_array_elements(p.data->'history') h
         WHERE jsonb_typeof(h) = 'object'
           AND jsonb_typeof(h->'isCorrect') = 'boolean'
           AND h->'isCorrect' = 'true'::jsonb)
        / NULLIF(jsonb_array_length(p.data->'history'), 0))
    END
  `
  const publicResult = await pool.query(`
    WITH ranked AS (
      SELECT r.uid, r.name, r.level, r.class_level,
             COALESCE(w.lifetime_earned, 0) AS total_np,
             COALESCE(w.rank_points, 0) AS rank_points,
             c.equipped_title, c.equipped_frame, c.equipped_highlight, c.equipped_avatar,
             ${accuracySql} AS accuracy,
             ROW_NUMBER() OVER (
               ORDER BY COALESCE(w.lifetime_earned, 0) DESC, ${accuracySql} DESC, r.uid ASC
             ) AS public_rank
      FROM mednexus_registered_users r
      LEFT JOIN mednexus_season_wallets w ON w.user_id = r.uid AND w.season_id = $1
      LEFT JOIN mednexus_user_cosmetics c ON c.uid = r.uid
      LEFT JOIN mednexus_progress p ON p.uid = r.uid
      WHERE r.is_private = FALSE AND r.status = 'approved'
    )
    SELECT * FROM ranked WHERE public_rank <= 50 ORDER BY public_rank
  `, [season.id])
  const entries = publicResult.rows.map(allTimeEntry)
  let viewerEntry = viewerUid ? entries.find((entry) => entry.uid === viewerUid) ?? null : null

  if (viewerUid && !viewerEntry) {
    const viewerResult = await pool.query(`
      SELECT r.uid, r.name, r.level, r.class_level,
             COALESCE(w.lifetime_earned, 0) AS total_np,
             COALESCE(w.rank_points, 0) AS rank_points,
             c.equipped_title, c.equipped_frame, c.equipped_highlight, c.equipped_avatar,
             ${accuracySql} AS accuracy
      FROM mednexus_registered_users r
      LEFT JOIN mednexus_season_wallets w ON w.user_id = r.uid AND w.season_id = $1
      LEFT JOIN mednexus_user_cosmetics c ON c.uid = r.uid
      LEFT JOIN mednexus_progress p ON p.uid = r.uid
      WHERE r.uid = $2
    `, [season.id, viewerUid])
    const viewer = viewerResult.rows[0]
    if (viewer) {
      const rankResult = await pool.query(`
        SELECT 1 + COUNT(*)::int AS exact_rank
        FROM (
          SELECT r.uid, COALESCE(w.lifetime_earned, 0) AS total_np, ${accuracySql} AS accuracy
          FROM mednexus_registered_users r
          LEFT JOIN mednexus_season_wallets w ON w.user_id = r.uid AND w.season_id = $1
          LEFT JOIN mednexus_progress p ON p.uid = r.uid
          WHERE r.is_private = FALSE AND r.status = 'approved'
        ) public
        WHERE public.total_np > $2
           OR (public.total_np = $2 AND public.accuracy > $3)
           OR (public.total_np = $2 AND public.accuracy = $3 AND public.uid < $4)
      `, [season.id, Number(viewer.total_np ?? 0), Number(viewer.accuracy ?? 0), viewerUid])
      viewer.public_rank = Number(rankResult.rows[0]?.exact_rank ?? 1)
      viewerEntry = allTimeEntry(viewer)
    }
  }

  return { entries, viewerEntry, tab: "alltime" as const }
}

export async function GET(req: NextRequest) {
  let tab: RankingTab = "alltime"
  let viewerUid: string | null = null
  let seasonId: string | null = null
  try {
    const requested = req.nextUrl.searchParams.get("tab")
    tab = requested === "weekly" || requested === "monthly" ? requested : "alltime"
    const hasCredential = Boolean(req.headers.get("x-session-token") || req.headers.get("x-guest-token"))
    const auth = authenticateRequest(req.headers)
    if (hasCredential && !auth) return authError()
    viewerUid = auth?.uid ?? null
    const season = await getActiveSeason(pool)
    seasonId = season.id
    const data = tab === "alltime"
      ? await allTimeLeaderboard(viewerUid, season)
      : await timedLeaderboard(tab, viewerUid, season)

    if (viewerUid) {
      const viewerPrivacy = await pool.query(
        "SELECT is_private FROM mednexus_registered_users WHERE uid = $1 AND status = 'approved'",
        [viewerUid],
      )
      if (viewerPrivacy.rows[0]?.is_private === true) {
        return NextResponse.json({
          ...data,
          entries: data.viewerEntry ? [data.viewerEntry] : [],
        })
      }
    }
    return NextResponse.json({ ...data, season })
  } catch (error) {
    const code = diagnosticFor(error)
    console.error("[leaderboard GET]", {
      tab,
      seasonId,
      viewerUid,
      databaseErrorCode: databaseErrorCode(error),
      deploymentVersion: process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.DEPLOYMENT_VERSION ?? process.env.REPL_SLUG ?? "unknown",
      error,
    })
    return NextResponse.json({ error: "Rankings are temporarily unavailable", code }, { status: 500 })
  }
}
