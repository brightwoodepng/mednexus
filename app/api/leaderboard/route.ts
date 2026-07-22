import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { authenticateRequest, authError } from "@/lib/request-auth"

// GET /api/leaderboard?tab=alltime|weekly
// Public entries contain only non-private approved users and may be viewed
// anonymously. Sending a valid credential additionally returns the caller's
// own rank entry, including it when their profile is private or off the list.
// All-time: sorted by total NP (wallet.balance), tie-broken by overall accuracy.
// Weekly:   sorted by NP earned in last 7 days, tie-broken by weekly accuracy
//           (forced to 0% if < 50 questions answered that week).
export async function GET(req: NextRequest) {
  try {

    const tab = req.nextUrl.searchParams.get("tab") ?? "alltime"
    const hasCredential = Boolean(
      req.headers.get("x-session-token") || req.headers.get("x-guest-token"),
    )
    const auth = authenticateRequest(req.headers)
    if (hasCredential && !auth) return authError()
    // Never accept a client-provided viewer UID: private profile data is only
    // queried for the identity established by a verified credential.
    const viewerUid = auth?.uid ?? null

    if (tab === "weekly") {
      // ── Weekly leaderboard ─────────────────────────────────────────────────
      // Weekly NP comes from mednexus_discipline_np_log (already populated by
      // the anti-farming engine). Weekly question counts come from
      // mednexus_daily_activity (populated by the payout route).
      const sevenDaysAgo = new Date()
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6)
      const cutoff = sevenDaysAgo.toISOString().slice(0, 10)

      const res = await pool.query(`
        SELECT
          r.uid,
          r.name,
          r.level,
          r.class_level,
          r.is_private,
          COALESCE(np.weekly_np, 0)              AS weekly_np,
          COALESCE(da.weekly_questions, 0)       AS weekly_questions,
          COALESCE(da.weekly_correct, 0)         AS weekly_correct,
          c.equipped_title,
          c.equipped_frame,
          c.equipped_highlight,
          c.equipped_avatar
        FROM mednexus_registered_users r
        LEFT JOIN (
          SELECT user_id, SUM(np_earned) AS weekly_np
          FROM   mednexus_discipline_np_log
          WHERE  earned_date >= $1
          GROUP  BY user_id
        ) np ON np.user_id = r.uid
        LEFT JOIN (
          SELECT user_id,
                 SUM(questions_answered) AS weekly_questions,
                 SUM(correct_answers)    AS weekly_correct
          FROM   mednexus_daily_activity
          WHERE  activity_date >= $1
          GROUP  BY user_id
        ) da ON da.user_id = r.uid
        LEFT JOIN mednexus_user_cosmetics c ON c.uid = r.uid
        WHERE r.is_private = FALSE
          AND r.status     = 'approved'
          AND COALESCE(np.weekly_np, 0) > 0
        ORDER BY weekly_np DESC,
                 -- tie-breaker: weekly accuracy (0 if < 50 questions)
                 CASE WHEN COALESCE(da.weekly_questions, 0) >= 50
                      THEN ROUND(100.0 * COALESCE(da.weekly_correct, 0)
                           / NULLIF(COALESCE(da.weekly_questions, 0), 0))
                      ELSE 0
                 END DESC
        LIMIT 50
      `, [cutoff])

      const entries = res.rows.map((row, idx) => {
        const wq = Number(row.weekly_questions)
        const wc = Number(row.weekly_correct)
        const accuracy = wq >= 50 ? Math.round((wc / wq) * 100) : 0
        return {
          rank: idx + 1,
          uid: row.uid,
          name: row.name,
          level: row.level,
          classLevel: row.class_level,
          np: Number(row.weekly_np),
          accuracy,
          weeklyQuestions: wq,
          accuracySuppressed: wq > 0 && wq < 50,
          equippedTitle: row.equipped_title ?? null,
          equippedFrame: row.equipped_frame ?? null,
          equippedHighlight: row.equipped_highlight ?? null,
          equippedAvatar: row.equipped_avatar ?? null,
        }
      })

      // Authenticated viewer-specific data: only the verified caller's row may
      // be included when it is private or outside the public top 50.
      let viewerEntry = viewerUid ? entries.find(e => e.uid === viewerUid) ?? null : null
      if (viewerUid && !viewerEntry) {
        const vRes = await pool.query(`
          SELECT
            r.uid, r.name, r.level, r.class_level, r.is_private,
            COALESCE(np.weekly_np, 0) AS weekly_np,
            COALESCE(da.weekly_questions, 0) AS weekly_questions,
            COALESCE(da.weekly_correct, 0) AS weekly_correct,
            c.equipped_title, c.equipped_frame, c.equipped_highlight, c.equipped_avatar
          FROM mednexus_registered_users r
          LEFT JOIN (
            SELECT user_id, SUM(np_earned) AS weekly_np
            FROM   mednexus_discipline_np_log WHERE earned_date >= $2 GROUP BY user_id
          ) np ON np.user_id = r.uid
          LEFT JOIN (
            SELECT user_id, SUM(questions_answered) AS weekly_questions, SUM(correct_answers) AS weekly_correct
            FROM   mednexus_daily_activity WHERE activity_date >= $2 GROUP BY user_id
          ) da ON da.user_id = r.uid
          LEFT JOIN mednexus_user_cosmetics c ON c.uid = r.uid
          WHERE r.uid = $1
        `, [viewerUid, cutoff])
        if (vRes.rows[0]) {
          const row = vRes.rows[0]
          const wq = Number(row.weekly_questions)
          const wc = Number(row.weekly_correct)
          viewerEntry = {
            rank: entries.length + 1,
            uid: row.uid,
            name: row.name,
            level: row.level,
            classLevel: row.class_level,
            np: Number(row.weekly_np),
            accuracy: wq >= 50 ? Math.round((wc / wq) * 100) : 0,
            weeklyQuestions: wq,
            accuracySuppressed: wq > 0 && wq < 50,
            equippedTitle: row.equipped_title ?? null,
            equippedFrame: row.equipped_frame ?? null,
            equippedHighlight: row.equipped_highlight ?? null,
            equippedAvatar: row.equipped_avatar ?? null,
          }
        }
      }

      return NextResponse.json({ entries, viewerEntry, tab: "weekly" })
    }

    // ── All-time leaderboard ───────────────────────────────────────────────────
    // Uses wallet.balance for NP, accuracy from progress JSONB for tie-breaking.
    const res = await pool.query(`
      SELECT
        r.uid,
        r.name,
        r.level,
        r.class_level,
        r.is_private,
        COALESCE(w.balance, 0) AS total_np,
        COALESCE(w.rank_points, 0) AS rank_points,
        c.equipped_title,
        c.equipped_frame,
        c.equipped_highlight,
        c.equipped_avatar,
        -- All-time accuracy from progress JSONB
        CASE
          WHEN p.data IS NULL OR jsonb_array_length(COALESCE(p.data->'history', '[]'::jsonb)) = 0
          THEN 0
          ELSE ROUND(
            100.0
            * (SELECT COUNT(*) FROM jsonb_array_elements(p.data->'history') h
               WHERE (h->>'isCorrect')::boolean = TRUE)
            / NULLIF(jsonb_array_length(p.data->'history'), 0)
          )
        END AS accuracy
      FROM mednexus_registered_users r
      LEFT JOIN mednexus_wallet           w ON w.uid = r.uid
      LEFT JOIN mednexus_user_cosmetics   c ON c.uid = r.uid
      LEFT JOIN mednexus_progress         p ON p.uid = r.uid
      WHERE r.is_private = FALSE
        AND r.status     = 'approved'
      ORDER BY total_np DESC, accuracy DESC
      LIMIT 50
    `)

    const entries = res.rows.map((row, idx) => ({
      rank: idx + 1,
      uid: row.uid,
      name: row.name,
      level: row.level,
      classLevel: row.class_level,
      np: Number(row.total_np),
      rankPoints: Number(row.rank_points),
      accuracy: Number(row.accuracy ?? 0),
      weeklyQuestions: null,
      accuracySuppressed: false,
      equippedTitle: row.equipped_title ?? null,
      equippedFrame: row.equipped_frame ?? null,
      equippedHighlight: row.equipped_highlight ?? null,
      equippedAvatar: row.equipped_avatar ?? null,
    }))

    // Authenticated viewer-specific data: only the verified caller's row may
    // be included when it is private or outside the public top 50.
    let viewerEntry = viewerUid ? entries.find(e => e.uid === viewerUid) ?? null : null
    if (viewerUid && !viewerEntry) {
      const vRes = await pool.query(`
        SELECT
          r.uid, r.name, r.level, r.class_level, r.is_private,
          COALESCE(w.balance, 0) AS total_np,
          COALESCE(w.rank_points, 0) AS rank_points,
          c.equipped_title, c.equipped_frame, c.equipped_highlight, c.equipped_avatar,
          CASE
            WHEN p.data IS NULL OR jsonb_array_length(COALESCE(p.data->'history', '[]'::jsonb)) = 0 THEN 0
            ELSE ROUND(100.0
              * (SELECT COUNT(*) FROM jsonb_array_elements(p.data->'history') h
                 WHERE (h->>'isCorrect')::boolean = TRUE)
              / NULLIF(jsonb_array_length(p.data->'history'), 0))
          END AS accuracy
        FROM mednexus_registered_users r
        LEFT JOIN mednexus_wallet         w ON w.uid = r.uid
        LEFT JOIN mednexus_user_cosmetics c ON c.uid = r.uid
        LEFT JOIN mednexus_progress       p ON p.uid = r.uid
        WHERE r.uid = $1
      `, [viewerUid])
      if (vRes.rows[0]) {
        const row = vRes.rows[0]
        viewerEntry = {
          rank: entries.length + 1, // approximate — outside top 50
          uid: row.uid,
          name: row.name,
          level: row.level,
          classLevel: row.class_level,
          np: Number(row.total_np),
          rankPoints: Number(row.rank_points),
          accuracy: Number(row.accuracy ?? 0),
          weeklyQuestions: null,
          accuracySuppressed: false,
          equippedTitle: row.equipped_title ?? null,
          equippedFrame: row.equipped_frame ?? null,
          equippedHighlight: row.equipped_highlight ?? null,
          equippedAvatar: row.equipped_avatar ?? null,
        }
      }
    }

    return NextResponse.json({ entries, viewerEntry, tab: "alltime" })
  } catch (err) {
    console.error("[leaderboard GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
