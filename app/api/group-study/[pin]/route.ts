import { NextResponse } from "next/server"
import type { PoolClient } from "pg"
import pool, { ensureGroupStudySchema } from "@/lib/db"
import { ECONOMY_CONFIG } from "@/lib/economy-config"
import { getActiveSeason } from "@/lib/economy-seasons"
import {
  firstEligibleQuestionIndex,
  GROUP_STUDY_CAPACITY,
  GROUP_STUDY_RECONNECT_MINUTES,
  groupStudyNavigationModeFromStorage,
  groupStudyNavigationModeToStorage,
  groupStudyRoomScore,
  isGroupStudyNavigationMode,
  isValidGroupStudyAnswer,
  publicGroupStudyQuestion,
  rankGroupStudyMembers,
  sameGroupStudyAnswer,
  type GroupStudyLeaderboardMember,
  type GroupStudyPhase,
  type GroupStudyQuestionSnapshot,
} from "@/lib/group-study"
import { applyNPCredits, dailyRewardRemaining, recordDailyActivity } from "@/lib/np-ledger"
import { requireAuthenticatedUser } from "@/lib/request-auth"
import { recordWeeklyGoalActivity } from "@/lib/weekly-goals"

type RoomRow = {
  id: string; pin: string; host_user_id: string; module_id: string; discipline: string | null; difficulty: string
  question_count: number; timer_seconds: number | null; status: string; current_question_index: number
  current_phase: GroupStudyPhase; question_opened_at: Date | null; answer_closes_at: Date | null
  answer_closed_at: Date | null; host_disconnected_at: Date | null; version: number
  created_at: Date; expires_at: Date; completed_at: Date | null
}

type RoomQuestionRow = { id: string; question_id: string; position: number; question_snapshot: GroupStudyQuestionSnapshot; opened_at: Date | null; closed_at: Date | null }

const fail = (message: string, status = 400, code = "INVALID_REQUEST") => NextResponse.json({ error: message, code }, { status })
const revealPhases = new Set<GroupStudyPhase>(["answer_closed", "reveal", "discussion", "completed"])

async function lockedRoom(client: PoolClient, pin: string) {
  const result = await client.query<RoomRow>("SELECT * FROM mednexus_group_study_rooms WHERE pin=$1 FOR UPDATE", [pin])
  return result.rows[0] ?? null
}

const navigationMode = (room: RoomRow) => groupStudyNavigationModeFromStorage(room.difficulty)

async function closeAnswering(client: PoolClient, room: RoomRow) {
  if (room.current_phase !== "question_open") return room
  const question = await client.query<RoomQuestionRow>(
    "SELECT * FROM mednexus_group_study_room_questions WHERE room_id=$1 AND position=$2", [room.id, room.current_question_index],
  )
  if (!question.rows[0]) throw new Error("Current Group Study question is missing")
  const unanswered = await client.query<{ user_id: string }>(
    `SELECT m.user_id FROM mednexus_group_study_memberships m
     WHERE m.room_id=$1 AND m.first_eligible_question<=$2 AND m.connection_status<>'left'
       AND NOT m.is_guest
       AND NOT EXISTS(SELECT 1 FROM mednexus_group_study_answers a WHERE a.room_question_id=$3 AND a.user_id=m.user_id)`,
    [room.id, room.current_question_index, question.rows[0].id],
  )
  await client.query(
    `UPDATE mednexus_group_study_memberships m
       SET eligible_unanswered=eligible_unanswered+1,current_streak=0
     WHERE room_id=$1 AND first_eligible_question <= $2 AND connection_status<>'left'
       AND NOT EXISTS (SELECT 1 FROM mednexus_group_study_answers a WHERE a.room_question_id=$3 AND a.user_id=m.user_id)`,
    [room.id, room.current_question_index, question.rows[0].id],
  )
  for (const member of unanswered.rows) {
    const eventId = `group-study:${room.id}:${question.rows[0].id}:${member.user_id}:unanswered`
    await client.query(
      `INSERT INTO mednexus_progress_history(uid,event_id,occurred_at,mode,question_id,payload)
       VALUES($1,$2,NOW(),'trial',$3,$4::jsonb) ON CONFLICT DO NOTHING`,
      [member.user_id, eventId, question.rows[0].question_id, JSON.stringify({
        id: eventId, questionId: question.rows[0].question_id, module: question.rows[0].question_snapshot.module,
        subject: question.rows[0].question_snapshot.subject, vignetteSnippet: question.rows[0].question_snapshot.vignette.slice(0, 160),
        mode: "trial", groupStudy: true, selectedOption: null, correctOption: question.rows[0].question_snapshot.correctAnswer,
        isCorrect: false, timestamp: Date.now(), unanswered: true,
      })],
    )
  }
  const submitted = await client.query<{ id: string; user_id: string; selected_answer: unknown; is_correct: boolean; is_guest: boolean }>(
    `SELECT a.id,a.user_id,a.selected_answer,a.is_correct,m.is_guest
     FROM mednexus_group_study_answers a
     JOIN mednexus_group_study_memberships m ON m.room_id=a.room_id AND m.user_id=a.user_id
     WHERE a.room_question_id=$1 AND a.score_processing_status='pending' FOR UPDATE OF a`, [question.rows[0].id],
  )
  for (const answer of submitted.rows) {
    const reward = answer.is_guest
      ? { earned: 0, eventId: `group-study:${room.id}:${question.rows[0].id}:${answer.user_id}` }
      : await rewardAnswer(client, room, question.rows[0], answer.user_id, answer.is_correct)
    await client.query(
      `UPDATE mednexus_group_study_answers SET score_processing_status='processed',progress_processing_status='processed',
       np_processing_status='processed',np_earned=$2 WHERE id=$1`, [answer.id, reward.earned],
    )
    await client.query(
      `UPDATE mednexus_group_study_memberships SET questions_attempted=questions_attempted+1,
       correct_answers=correct_answers+$2,incorrect_answers=incorrect_answers+$3,
       current_streak=CASE WHEN $2=1 THEN current_streak+1 ELSE 0 END,
       highest_streak=GREATEST(highest_streak,CASE WHEN $2=1 THEN current_streak+1 ELSE highest_streak END),
       room_score=room_score+$4,session_np_earned=session_np_earned+$5 WHERE room_id=$1 AND user_id=$6`,
      [room.id, answer.is_correct ? 1 : 0, answer.is_correct ? 0 : 1, groupStudyRoomScore(answer.is_correct), reward.earned, answer.user_id],
    )
    if (!answer.is_guest) {
      await client.query(
        `INSERT INTO mednexus_progress_history(uid,event_id,occurred_at,mode,question_id,payload)
         VALUES($1,$2,NOW(),'trial',$3,$4::jsonb) ON CONFLICT DO NOTHING`,
        [answer.user_id, reward.eventId, question.rows[0].question_id, JSON.stringify({
          id: reward.eventId, questionId: question.rows[0].question_id, module: question.rows[0].question_snapshot.module,
          subject: question.rows[0].question_snapshot.subject, vignetteSnippet: question.rows[0].question_snapshot.vignette.slice(0, 160),
          mode: "trial", groupStudy: true, selectedOption: answer.selected_answer,
          correctOption: question.rows[0].question_snapshot.correctAnswer, isCorrect: answer.is_correct, timestamp: Date.now(),
        })],
      )
    }
  }
  await client.query(
    `UPDATE mednexus_progress_history
     SET payload=jsonb_set(payload,'{correctOption}',$4::jsonb,true)
     WHERE question_id=$1 AND event_id LIKE $2 AND uid IN (
       SELECT user_id FROM mednexus_group_study_memberships WHERE room_id=$3
     )`,
    [question.rows[0].question_id, `group-study:${room.id}:${question.rows[0].id}:%`, room.id, JSON.stringify(question.rows[0].question_snapshot.correctAnswer)],
  )
  await client.query(
    `UPDATE mednexus_progress_history h
     SET payload=jsonb_set(h.payload,'{isCorrect}',to_jsonb(a.is_correct),true)
     FROM mednexus_group_study_answers a
     WHERE a.room_question_id=$1 AND h.uid=a.user_id
       AND h.event_id=$2||a.user_id`,
    [question.rows[0].id, `group-study:${room.id}:${question.rows[0].id}:`],
  )
  await client.query("UPDATE mednexus_group_study_room_questions SET closed_at=COALESCE(closed_at,NOW()) WHERE id=$1", [question.rows[0].id])
  const updated = await client.query<RoomRow>(
    `UPDATE mednexus_group_study_rooms
       SET current_phase='reveal',answer_closed_at=COALESCE(answer_closed_at,NOW()),version=version+1
     WHERE id=$1 RETURNING *`, [room.id],
  )
  return updated.rows[0]
}

async function maintainRoom(client: PoolClient, room: RoomRow) {
  if (room.current_phase === "question_open" && room.answer_closes_at && room.answer_closes_at.getTime() <= Date.now()) {
    room = await closeAnswering(client, room)
  }
  const disconnected = await client.query(
    `UPDATE mednexus_group_study_memberships SET connection_status='disconnected'
     WHERE room_id=$1 AND connection_status='online' AND last_seen_at < NOW()-INTERVAL '15 seconds' RETURNING id`, [room.id],
  )
  if (disconnected.rowCount) {
    const updated = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET version=version+1 WHERE id=$1 RETURNING *", [room.id])
    room = updated.rows[0]
  }
  const online = await client.query<{ user_id: string }>(
    "SELECT user_id FROM mednexus_group_study_memberships WHERE room_id=$1 AND connection_status='online' ORDER BY joined_at,user_id", [room.id],
  )
  if (!["completed", "ended", "expired"].includes(room.status) && online.rows.length) {
    const extended = await client.query<RoomRow>(
      "UPDATE mednexus_group_study_rooms SET expires_at=NOW()+($2||' minutes')::interval WHERE id=$1 RETURNING *",
      [room.id, GROUP_STUDY_RECONNECT_MINUTES],
    )
    room = extended.rows[0]
  } else if (!["completed", "ended", "expired"].includes(room.status) && room.expires_at.getTime() <= Date.now()) {
    const expired = await client.query<RoomRow>(
      "UPDATE mednexus_group_study_rooms SET status='expired',current_phase='expired',version=version+1 WHERE id=$1 RETURNING *", [room.id],
    )
    return expired.rows[0]
  }
  const hostConnection = await client.query<{ connection_status: string }>(
    "SELECT connection_status FROM mednexus_group_study_memberships WHERE room_id=$1 AND user_id=$2", [room.id, room.host_user_id],
  )
  if (hostConnection.rows[0]?.connection_status !== "online" && !room.host_disconnected_at) {
    const disconnected = await client.query<RoomRow>(
      "UPDATE mednexus_group_study_rooms SET host_disconnected_at=NOW(),version=version+1 WHERE id=$1 RETURNING *", [room.id],
    )
    room = disconnected.rows[0]
  }
  if (room.host_disconnected_at) {
    const replacement = await client.query<{ user_id: string }>(
      `SELECT user_id FROM mednexus_group_study_memberships
       WHERE room_id=$1 AND user_id<>$2 AND connection_status='online'
       ORDER BY joined_at,user_id LIMIT 1`, [room.id, room.host_user_id],
    )
    if (replacement.rows[0]) {
      await client.query("UPDATE mednexus_group_study_memberships SET role='member' WHERE room_id=$1 AND role='host'", [room.id])
      await client.query("UPDATE mednexus_group_study_memberships SET role='host' WHERE room_id=$1 AND user_id=$2", [room.id, replacement.rows[0].user_id])
      const migrated = await client.query<RoomRow>(
        `UPDATE mednexus_group_study_rooms SET host_user_id=$2,host_disconnected_at=NULL,version=version+1 WHERE id=$1 RETURNING *`,
        [room.id, replacement.rows[0].user_id],
      )
      room = migrated.rows[0]
    }
  }
  return room
}

async function membership(client: PoolClient, roomId: string, userId: string, lock = false) {
  const result = await client.query(
    `SELECT * FROM mednexus_group_study_memberships WHERE room_id=$1 AND user_id=$2${lock ? " FOR UPDATE" : ""}`,
    [roomId, userId],
  )
  return result.rows[0] ?? null
}

async function serializeRoom(client: PoolClient, room: RoomRow, viewerId: string, requestedPosition = room.current_question_index) {
  const allMemberRows = await client.query(
    `SELECT m.*,COALESCE(r.name,g.name,'Guest') AS name,c.equipped_avatar
     FROM mednexus_group_study_memberships m
     LEFT JOIN mednexus_registered_users r ON r.uid=m.user_id AND NOT m.is_guest
     LEFT JOIN mednexus_guest_users g ON g.uid=m.user_id AND m.is_guest
     LEFT JOIN mednexus_user_cosmetics c ON c.uid=m.user_id AND NOT m.is_guest
     WHERE m.room_id=$1 ORDER BY m.joined_at,m.user_id`, [room.id],
  )
  const visibleRows = room.current_phase === "completed"
    ? allMemberRows.rows.filter(row => Number(row.questions_attempted) > 0 || row.user_id === viewerId)
    : allMemberRows.rows.filter(row => row.connection_status === "online")
  const viewerMembership = allMemberRows.rows.find(row => row.user_id === viewerId)
  const viewerAnswered = await client.query<{ position: number }>(
    `SELECT q.position FROM mednexus_group_study_answers a
     JOIN mednexus_group_study_room_questions q ON q.id=a.room_question_id
     WHERE a.room_id=$1 AND a.user_id=$2 ORDER BY q.position`, [room.id, viewerId],
  )
  const leaderboardInput: GroupStudyLeaderboardMember[] = visibleRows.map(row => ({
    userId: row.user_id, name: row.name, avatar: row.equipped_avatar, role: row.role, isGuest: Boolean(row.is_guest),
    firstEligibleQuestion: row.first_eligible_question, questionsAttempted: Number(row.questions_attempted),
    correctAnswers: Number(row.correct_answers), incorrectAnswers: Number(row.incorrect_answers),
    eligibleUnanswered: Number(row.eligible_unanswered), currentStreak: Number(row.current_streak),
    highestStreak: Number(row.highest_streak), roomScore: Number(row.room_score),
    sessionNpEarned: Number(row.session_np_earned), connectionStatus: row.connection_status,
  }))
  const ranked = rankGroupStudyMembers(leaderboardInput)
  const viewedPosition = Math.max(0, Math.min(room.question_count - 1, requestedPosition))
  const current = await client.query<RoomQuestionRow>(
    "SELECT * FROM mednexus_group_study_room_questions WHERE room_id=$1 AND position=$2", [room.id, viewedPosition],
  )
  const question = current.rows[0]
  const answers = question
    ? await client.query<{ user_id: string; selected_answer: unknown; is_correct: boolean; np_earned: number }>(
        "SELECT user_id,selected_answer,is_correct,np_earned FROM mednexus_group_study_answers WHERE room_question_id=$1", [question.id],
      )
    : { rows: [] }
  const isLiveQuestion = viewedPosition === room.current_question_index
  const sharedReveal = isLiveQuestion && revealPhases.has(room.current_phase)
  const optionCounts: Record<string, number> = {}
  if (sharedReveal) for (const answer of answers.rows) {
    const selected = Array.isArray(answer.selected_answer) ? answer.selected_answer : [answer.selected_answer]
    for (const option of selected) if (typeof option === "string") optionCounts[option] = (optionCounts[option] ?? 0) + 1
  }
  const viewerAnswer = answers.rows.find(answer => answer.user_id === viewerId)
  const reveal = viewedPosition < room.current_question_index || sharedReveal || (viewedPosition > room.current_question_index && navigationMode(room) === "answer_ahead" && Boolean(viewerAnswer))
  const eligibleCount = visibleRows.filter(row => row.first_eligible_question !== null && row.first_eligible_question <= room.current_question_index).length
  const finalReview = room.current_phase === "completed"
    ? await client.query<{
        id: string; position: number; question_snapshot: GroupStudyQuestionSnapshot; selected_answer: unknown
        is_correct: boolean | null; correct_count: number; answer_count: number
      }>(
        `SELECT q.id,q.position,q.question_snapshot,viewer.selected_answer,viewer.is_correct,
          COUNT(a.id) FILTER(WHERE a.is_correct)::int correct_count,COUNT(a.id)::int answer_count
         FROM mednexus_group_study_room_questions q
         LEFT JOIN mednexus_group_study_answers a ON a.room_question_id=q.id
         LEFT JOIN mednexus_group_study_answers viewer ON viewer.room_question_id=q.id AND viewer.user_id=$2
         WHERE q.room_id=$1 GROUP BY q.id,viewer.selected_answer,viewer.is_correct ORDER BY q.position`,
        [room.id, viewerId],
      )
    : { rows: [] }
  return {
    room: {
      id: room.id, pin: room.pin, hostUserId: room.host_user_id, moduleId: room.module_id,
      discipline: room.discipline, difficulty: room.difficulty, questionCount: room.question_count, timerSeconds: room.timer_seconds,
      status: room.status, phase: room.current_phase, currentQuestionIndex: room.current_question_index,
      viewedQuestionIndex: viewedPosition, isLiveQuestion, navigationMode: navigationMode(room),
      questionOpenedAt: room.question_opened_at?.toISOString() ?? null,
      answerClosesAt: room.answer_closes_at?.toISOString() ?? null,
      answerClosedAt: room.answer_closed_at?.toISOString() ?? null,
      expiresAt: room.expires_at.toISOString(), completedAt: room.completed_at?.toISOString() ?? null,
      version: Number(room.version), capacity: GROUP_STUDY_CAPACITY, memberCount: visibleRows.length,
    },
    viewer: ranked.find(row => row.userId === viewerId) ?? null,
    viewerFlags: Array.isArray(viewerMembership?.flagged_questions)
      ? viewerMembership.flagged_questions.map(Number)
      : [],
    viewerAnsweredQuestions: viewerAnswered.rows.map(row => Number(row.position)),
    members: ranked.map(member => ({ ...member, ready: Boolean(visibleRows.find(row => row.user_id === member.userId)?.ready), hasSubmitted: isLiveQuestion && answers.rows.some(answer => answer.user_id === member.userId) })),
    question: question ? { roomQuestionId: question.id, position: question.position, ...publicGroupStudyQuestion(question.question_snapshot, reveal) } : null,
    answerState: {
      submitted: Boolean(viewerAnswer), selectedAnswer: viewerAnswer?.selected_answer ?? null,
      isCorrect: reveal ? viewerAnswer?.is_correct ?? null : null, npEarned: reveal ? Number(viewerAnswer?.np_earned ?? 0) : 0,
      correctCount: sharedReveal ? answers.rows.filter(answer => answer.is_correct).length : null,
      incorrectCount: sharedReveal ? answers.rows.filter(answer => !answer.is_correct).length : null,
      unansweredCount: sharedReveal ? Math.max(0, eligibleCount - answers.rows.length) : null,
      optionCounts: sharedReveal ? optionCounts : null,
    },
    finalReview: finalReview.rows.map(row => ({
      roomQuestionId: row.id, position: row.position,
      question: publicGroupStudyQuestion(row.question_snapshot, true), selectedAnswer: row.selected_answer,
      isCorrect: row.is_correct, correctCount: Number(row.correct_count), answerCount: Number(row.answer_count),
    })),
  }
}

async function rewardAnswer(client: PoolClient, room: RoomRow, question: RoomQuestionRow, userId: string, correct: boolean) {
  const season = await getActiveSeason(client, true)
  await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mednexus:activity-integrity:${userId}`])
  let earned = 0
  if (correct) {
    const progress = await client.query<{ correct_count: number }>(
      `SELECT correct_count FROM mednexus_user_question_progress
       WHERE season_id=$1 AND user_id=$2 AND question_id=$3 FOR UPDATE`, [season.id, userId, question.question_id],
    )
    const count = Number(progress.rows[0]?.correct_count ?? 0)
    const multiplier = ECONOMY_CONFIG.antiFarming.repeatRewardMultipliers[count] ?? 0
    const fatigue = await client.query<{ total: string }>(
      `SELECT COALESCE(SUM(np_earned),0)::text total FROM mednexus_discipline_np_log
       WHERE season_id=$1 AND user_id=$2 AND discipline=$3
         AND earned_date::date >= CURRENT_DATE-($4::int-1)`,
      [season.id, userId, question.question_snapshot.subject, ECONOMY_CONFIG.antiFarming.disciplineWindowDays],
    )
    const fatigued = Number(fatigue.rows[0]?.total ?? 0) >= ECONOMY_CONFIG.antiFarming.disciplineNPWindowLimit
    const requested = fatigued ? 0 : Math.floor(ECONOMY_CONFIG.gameRewards.solo.correctAnswer * multiplier)
    const remaining = await dailyRewardRemaining(client, userId, "multiplayer", season.id)
    const credit = await applyNPCredits(client, userId, requested > 0 ? [{
      source: "multiplayer_reward", sourceId: `group-study:${room.id}:${question.id}:correct`, amount: Math.min(requested, remaining),
      metadata: { mode: "group-study", roomId: room.id, questionId: question.question_id, description: "Group Study correct answer" },
    }] : [])
    earned = credit.credited
    if (earned > 0) await client.query(
      `INSERT INTO mednexus_discipline_np_log(season_id,user_id,discipline,earned_date,np_earned)
       VALUES($1,$2,$3,CURRENT_DATE::text,$4)
       ON CONFLICT(season_id,user_id,discipline,earned_date) DO UPDATE
       SET np_earned=mednexus_discipline_np_log.np_earned+EXCLUDED.np_earned`,
      [season.id, userId, question.question_snapshot.subject, earned],
    )
    await client.query(
      `INSERT INTO mednexus_user_question_progress(season_id,user_id,question_id,correct_count,discipline)
       VALUES($1,$2,$3,1,$4)
       ON CONFLICT(season_id,user_id,question_id) DO UPDATE SET correct_count=mednexus_user_question_progress.correct_count+1`,
      [season.id, userId, question.question_id, question.question_snapshot.subject],
    )
  }
  await recordDailyActivity(client, userId, 1, correct ? 1 : 0)
  const weekly = await recordWeeklyGoalActivity(client, userId, season.id, { answered: 1, correct: correct ? 1 : 0 })
  earned += weekly.credited.credited
  await client.query(
    `INSERT INTO mednexus_group_study_reward_events(id,user_id,room_id,room_question_id,event_type)
     VALUES($1,$2,$3,$4,'participation') ON CONFLICT DO NOTHING`,
    [`gsre-${crypto.randomUUID()}`, userId, room.id, question.id],
  )
  if (correct) await client.query(
    `INSERT INTO mednexus_group_study_reward_events(id,user_id,room_id,room_question_id,event_type)
     VALUES($1,$2,$3,$4,'correct_answer') ON CONFLICT DO NOTHING`,
    [`gsre-${crypto.randomUUID()}`, userId, room.id, question.id],
  )
  const eventId = `group-study:${room.id}:${question.id}:${userId}`
  await client.query("INSERT INTO mednexus_progress(uid) VALUES($1) ON CONFLICT(uid) DO NOTHING", [userId])
  await client.query(
    `UPDATE mednexus_progress SET data=data||jsonb_build_object(
       'totalAnswered',COALESCE((data->>'totalAnswered')::int,0)+1,
       'totalCorrect',COALESCE((data->>'totalCorrect')::int,0)+$2::int),version=version+1,updated_at=NOW() WHERE uid=$1`,
    [userId, correct ? 1 : 0],
  )
  return { earned, eventId }
}

async function awardCompletion(client: PoolClient, room: RoomRow) {
  const season = await getActiveSeason(client, true)
  const members = await client.query("SELECT * FROM mednexus_group_study_memberships WHERE room_id=$1 FOR UPDATE", [room.id])
  if (members.rows.length < ECONOMY_CONFIG.gameRewards.multiplayer.minimumPlayers) return
  for (const member of members.rows) {
    if (member.is_guest) continue
    if (Number(member.questions_attempted) < ECONOMY_CONFIG.gameRewards.multiplayer.minimumAnswers) continue
    const remaining = await dailyRewardRemaining(client, member.user_id, "multiplayer", season.id)
    const credit = await applyNPCredits(client, member.user_id, [{
      source: "game_completion", sourceId: `group-study:${room.id}:completion`, amount: Math.min(ECONOMY_CONFIG.gameRewards.multiplayer.participation, remaining),
      metadata: { mode: "group-study", roomId: room.id, multiplayer: true, description: "Group Study completion" },
    }])
    await client.query(
      `INSERT INTO mednexus_group_study_reward_events(id,user_id,room_id,room_question_id,event_type)
       VALUES($1,$2,$3,NULL,'completion') ON CONFLICT DO NOTHING`,
      [`gsre-${crypto.randomUUID()}`, member.user_id, room.id],
    )
    await client.query("UPDATE mednexus_group_study_memberships SET session_np_earned=session_np_earned+$3 WHERE room_id=$1 AND user_id=$2", [room.id, member.user_id, credit.credited])
  }
}

export async function GET(req: Request, context: { params: Promise<{ pin: string }> }) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth) return fail("Sign in or continue as a guest to join Group Study", 401, "AUTHENTICATION_REQUIRED")
  try { await ensureGroupStudySchema() } catch (error) { console.error("[group-study schema GET]", error); return fail("Group Study is temporarily unavailable", 503, "SCHEMA_UNAVAILABLE") }
  const { pin } = await context.params
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    let room = await lockedRoom(client, pin)
    if (!room) { await client.query("ROLLBACK"); return fail("Room not found", 404, "ROOM_NOT_FOUND") }
    room = await maintainRoom(client, room)
    if (["ended", "expired"].includes(room.status)) { await client.query("ROLLBACK"); return fail("This room has expired", 410, "ROOM_EXPIRED") }
    const member = await membership(client, room.id, auth.uid, true)
    if (!member) { await client.query("ROLLBACK"); return fail("Join this room first", 403, "NOT_A_MEMBER") }
    const requestedParam = new URL(req.url).searchParams.get("question")
    const requestedPosition = requestedParam === null ? room.current_question_index : Number(requestedParam)
    if (!Number.isInteger(requestedPosition) || requestedPosition < 0 || requestedPosition >= room.question_count) { await client.query("ROLLBACK"); return fail("Choose a valid question", 422, "INVALID_QUESTION") }
    if (requestedPosition > room.current_question_index && ["host_paced", "anyone_advances"].includes(navigationMode(room))) { await client.query("ROLLBACK"); return fail("Future questions are locked in this mode", 403, "FUTURE_LOCKED") }
    if (room.status !== "completed") await client.query("UPDATE mednexus_group_study_memberships SET last_seen_at=NOW(),connection_status='online',left_at=NULL WHERE id=$1", [member.id])
    if (room.status !== "completed" && room.host_user_id === auth.uid && room.host_disconnected_at) {
      const restored = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET host_disconnected_at=NULL,version=version+1 WHERE id=$1 RETURNING *", [room.id])
      room = restored.rows[0]
    }
    const payload = await serializeRoom(client, room, auth.uid, requestedPosition)
    await client.query("COMMIT")
    return NextResponse.json(payload)
  } catch (error) {
    await client.query("ROLLBACK"); console.error("[group-study GET]", error); return fail("Unable to load room", 500, "SERVER_ERROR")
  } finally { client.release() }
}

export async function POST(req: Request, context: { params: Promise<{ pin: string }> }) {
  const auth = await requireAuthenticatedUser(req)
  if (!auth) return fail("Sign in or continue as a guest to join Group Study", 401, "AUTHENTICATION_REQUIRED")
  try { await ensureGroupStudySchema() } catch (error) { console.error("[group-study schema POST]", error); return fail("Group Study is temporarily unavailable", 503, "SCHEMA_UNAVAILABLE") }
  const { pin } = await context.params
  const body = await req.json().catch(() => ({})) as { action?: string; answer?: unknown; ready?: unknown; force?: unknown; targetUserId?: unknown; questionPosition?: unknown; navigationMode?: unknown }
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    let room = await lockedRoom(client, pin)
    if (!room) { await client.query("ROLLBACK"); return fail("Room not found", 404, "ROOM_NOT_FOUND") }
    room = await maintainRoom(client, room)
    let member = await membership(client, room.id, auth.uid, true)

    if (body.action === "join" || body.action === "rejoin") {
      if (["completed", "ended", "expired"].includes(room.status)) { await client.query("ROLLBACK"); return fail("This room is no longer accepting members", 409, "ROOM_CLOSED") }
      if (!member) {
        const count = await client.query<{ count: number }>("SELECT COUNT(*)::int AS count FROM mednexus_group_study_memberships WHERE room_id=$1 AND connection_status='online'", [room.id])
        if (Number(count.rows[0].count) >= GROUP_STUDY_CAPACITY) { await client.query("ROLLBACK"); return fail("This room is full", 409, "ROOM_FULL") }
        const eligible = room.current_phase === "lobby" ? 0 : firstEligibleQuestionIndex(room.current_question_index, room.current_phase)
        const inserted = await client.query(
          `INSERT INTO mednexus_group_study_memberships(id,room_id,user_id,is_guest,role,first_eligible_question,connection_status)
           VALUES($1,$2,$3,$4,'member',$5,'online') RETURNING *`, [`gsm-${crypto.randomUUID()}`, room.id, auth.uid, auth.isGuest, eligible],
        )
        member = inserted.rows[0]
      } else {
        const restored = await client.query("UPDATE mednexus_group_study_memberships SET left_at=NULL,last_seen_at=NOW(),connection_status='online' WHERE id=$1 RETURNING *", [member.id])
        member = restored.rows[0]
      }
      if (room.host_user_id === auth.uid && room.host_disconnected_at) {
        const restoredRoom = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET host_disconnected_at=NULL,version=version+1 WHERE id=$1 RETURNING *", [room.id])
        room = restoredRoom.rows[0]
      }
      await client.query("UPDATE mednexus_group_study_rooms SET version=version+1 WHERE id=$1", [room.id])
    } else {
      if (!member) { await client.query("ROLLBACK"); return fail("Join this room first", 403, "NOT_A_MEMBER") }
      await client.query("UPDATE mednexus_group_study_memberships SET last_seen_at=NOW(),connection_status='online',left_at=NULL WHERE id=$1", [member.id])
      if (room.host_user_id === auth.uid && room.host_disconnected_at) {
        const restoredRoom = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET host_disconnected_at=NULL,version=version+1 WHERE id=$1 RETURNING *", [room.id])
        room = restoredRoom.rows[0]
      }
      const isHost = room.host_user_id === auth.uid && member.role === "host"
      if (body.action === "ready") {
        await client.query("UPDATE mednexus_group_study_memberships SET ready=$2 WHERE id=$1", [member.id, body.ready === true])
        await client.query("UPDATE mednexus_group_study_rooms SET version=version+1 WHERE id=$1", [room.id])
      } else if (body.action === "flag") {
        if (room.current_phase === "lobby" || room.current_question_index < 0) { await client.query("ROLLBACK"); return fail("There is no active question to flag", 409, "INVALID_PHASE") }
        const flagPosition = body.questionPosition === undefined ? room.current_question_index : Number(body.questionPosition)
        if (!Number.isInteger(flagPosition) || flagPosition < 0 || flagPosition >= room.question_count) { await client.query("ROLLBACK"); return fail("Choose a valid question", 422, "INVALID_QUESTION") }
        const flags = new Set<number>(Array.isArray(member.flagged_questions) ? member.flagged_questions.map(Number) : [])
        if (flags.has(flagPosition)) flags.delete(flagPosition)
        else flags.add(flagPosition)
        await client.query("UPDATE mednexus_group_study_memberships SET flagged_questions=$2::integer[] WHERE id=$1", [member.id, [...flags].sort((a, b) => a - b)])
        await client.query("UPDATE mednexus_group_study_rooms SET version=version+1 WHERE id=$1", [room.id])
      } else if (body.action === "navigation-mode") {
        if (!isHost) { await client.query("ROLLBACK"); return fail("Only the host can change navigation", 403, "HOST_REQUIRED") }
        if (!isGroupStudyNavigationMode(body.navigationMode)) { await client.query("ROLLBACK"); return fail("Choose a valid navigation mode", 422, "INVALID_NAVIGATION_MODE") }
        const updated = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET difficulty=$2,version=version+1 WHERE id=$1 RETURNING *", [room.id, groupStudyNavigationModeToStorage(body.navigationMode)])
        room = updated.rows[0]
      } else if (body.action === "start") {
        if (!isHost) { await client.query("ROLLBACK"); return fail("Only the host can start", 403, "HOST_REQUIRED") }
        if (room.current_phase !== "lobby") { await client.query("ROLLBACK"); return fail("The session has already started", 409, "INVALID_PHASE") }
        const members = await client.query<{ count: number; unready: number }>(
          "SELECT COUNT(*)::int count,COUNT(*) FILTER(WHERE NOT ready)::int unready FROM mednexus_group_study_memberships WHERE room_id=$1 AND connection_status='online'", [room.id],
        )
        if (Number(members.rows[0].unready) > 0 && body.force !== true) { await client.query("ROLLBACK"); return fail(`${members.rows[0].unready} participants are not ready`, 409, "UNREADY_MEMBERS") }
        const started = await client.query<RoomRow>(
          `UPDATE mednexus_group_study_rooms SET status='active',current_phase='question_open',current_question_index=0,
           question_opened_at=NOW(),answer_closes_at=CASE WHEN timer_seconds IS NULL THEN NULL ELSE NOW()+timer_seconds*INTERVAL '1 second' END,
           answer_closed_at=NULL,version=version+1 WHERE id=$1 RETURNING *`, [room.id],
        )
        room = started.rows[0]
        await client.query("UPDATE mednexus_group_study_room_questions SET opened_at=NOW() WHERE room_id=$1 AND position=0", [room.id])
      } else if (body.action === "submit") {
        const answerPosition = body.questionPosition === undefined ? room.current_question_index : Number(body.questionPosition)
        const answeringAhead = answerPosition > room.current_question_index
        if (!Number.isInteger(answerPosition) || answerPosition < room.current_question_index || answerPosition >= room.question_count) { await client.query("ROLLBACK"); return fail("This question cannot be answered", 409, "ANSWERING_CLOSED") }
        if (answeringAhead && navigationMode(room) !== "answer_ahead") { await client.query("ROLLBACK"); return fail("Answering ahead is not enabled", 403, "FUTURE_LOCKED") }
        if (!answeringAhead && room.current_phase !== "question_open") { await client.query("ROLLBACK"); return fail("Answering is closed", 409, "ANSWERING_CLOSED") }
        if (member.first_eligible_question === null || Number(member.first_eligible_question) > answerPosition) { await client.query("ROLLBACK"); return fail("You are not eligible for this question", 409, "JOINED_LATE") }
        const current = await client.query<RoomQuestionRow>("SELECT * FROM mednexus_group_study_room_questions WHERE room_id=$1 AND position=$2 FOR UPDATE", [room.id, answerPosition])
        const question = current.rows[0]
        if (!question || !isValidGroupStudyAnswer(body.answer, question.question_snapshot)) { await client.query("ROLLBACK"); return fail("Select a valid answer") }
        const correct = sameGroupStudyAnswer(body.answer, question.question_snapshot.correctAnswer)
        const inserted = await client.query(
          `INSERT INTO mednexus_group_study_answers(id,room_id,room_question_id,user_id,selected_answer,is_correct)
           VALUES($1,$2,$3,$4,$5::jsonb,$6) ON CONFLICT(room_question_id,user_id) DO NOTHING RETURNING id`,
          [`gsa-${crypto.randomUUID()}`, room.id, question.id, auth.uid, JSON.stringify(body.answer), correct],
        )
        if (!inserted.rowCount) { await client.query("ROLLBACK"); return fail("Your answer is already locked", 409, "DUPLICATE_ANSWER") }
        const remaining = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int count FROM mednexus_group_study_memberships m
           WHERE m.room_id=$1 AND m.first_eligible_question<=$2 AND m.connection_status<>'left'
           AND NOT EXISTS(SELECT 1 FROM mednexus_group_study_answers a WHERE a.room_question_id=$3 AND a.user_id=m.user_id)`,
          [room.id, answerPosition, question.id],
        )
        if (!answeringAhead && Number(remaining.rows[0].count) === 0) room = await closeAnswering(client, room)
        else await client.query("UPDATE mednexus_group_study_rooms SET version=version+1 WHERE id=$1", [room.id])
      } else if (body.action === "close") {
        if (!isHost) { await client.query("ROLLBACK"); return fail("Only the host can close answering", 403, "HOST_REQUIRED") }
        if (room.current_phase !== "question_open") { await client.query("ROLLBACK"); return fail("Answering is already closed", 409, "INVALID_PHASE") }
        const current = await client.query<{ id: string }>("SELECT id FROM mednexus_group_study_room_questions WHERE room_id=$1 AND position=$2", [room.id, room.current_question_index])
        const remaining = await client.query<{ count: number }>(
          `SELECT COUNT(*)::int count FROM mednexus_group_study_memberships m WHERE room_id=$1 AND first_eligible_question<=$2
           AND connection_status<>'left' AND NOT EXISTS(SELECT 1 FROM mednexus_group_study_answers a WHERE a.room_question_id=$3 AND a.user_id=m.user_id)`,
          [room.id, room.current_question_index, current.rows[0].id],
        )
        if (Number(remaining.rows[0].count) > 0 && body.force !== true) { await client.query("ROLLBACK"); return fail(`${remaining.rows[0].count} participants have not answered`, 409, "UNANSWERED_MEMBERS") }
        room = await closeAnswering(client, room)
      } else if (body.action === "next") {
        if (!isHost && navigationMode(room) !== "anyone_advances") { await client.query("ROLLBACK"); return fail("Only the host can advance", 403, "HOST_REQUIRED") }
        if (!revealPhases.has(room.current_phase)) { await client.query("ROLLBACK"); return fail("Reveal the current answer first", 409, "INVALID_PHASE") }
        const nextIndex = room.current_question_index + 1
        if (nextIndex >= room.question_count) {
          const completed = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET status='completed',current_phase='completed',completed_at=NOW(),version=version+1 WHERE id=$1 RETURNING *", [room.id])
          room = completed.rows[0]
          await awardCompletion(client, room)
        } else {
          const advanced = await client.query<RoomRow>(
            `UPDATE mednexus_group_study_rooms SET current_question_index=$2,current_phase='question_open',question_opened_at=NOW(),
             answer_closes_at=CASE WHEN timer_seconds IS NULL THEN NULL ELSE NOW()+timer_seconds*INTERVAL '1 second' END,
             answer_closed_at=NULL,version=version+1 WHERE id=$1 RETURNING *`, [room.id, nextIndex],
          )
          room = advanced.rows[0]
          await client.query("UPDATE mednexus_group_study_room_questions SET opened_at=NOW() WHERE room_id=$1 AND position=$2", [room.id, nextIndex])
        }
      } else if (body.action === "end") {
        if (!isHost) { await client.query("ROLLBACK"); return fail("Only the host can end the room", 403, "HOST_REQUIRED") }
        const ended = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET status='ended',current_phase='ended',completed_at=COALESCE(completed_at,NOW()),version=version+1 WHERE id=$1 RETURNING *", [room.id])
        room = ended.rows[0]
      } else if (body.action === "leave") {
        await client.query("UPDATE mednexus_group_study_memberships SET connection_status='left',left_at=NOW(),last_seen_at=NOW(),ready=FALSE WHERE id=$1", [member.id])
        const remaining = await client.query<{ user_id: string }>(
          "SELECT user_id FROM mednexus_group_study_memberships WHERE room_id=$1 AND connection_status='online' ORDER BY joined_at,user_id", [room.id],
        )
        if (!remaining.rows.length) {
          const expired = await client.query<RoomRow>(
            "UPDATE mednexus_group_study_rooms SET status='expired',current_phase='expired',host_disconnected_at=NULL,version=version+1 WHERE id=$1 RETURNING *", [room.id],
          )
          room = expired.rows[0]
        } else if (isHost) {
          const nextHost = remaining.rows[0].user_id
          await client.query("UPDATE mednexus_group_study_memberships SET role='member' WHERE room_id=$1 AND role='host'", [room.id])
          await client.query("UPDATE mednexus_group_study_memberships SET role='host' WHERE room_id=$1 AND user_id=$2", [room.id, nextHost])
          const transferred = await client.query<RoomRow>(
            "UPDATE mednexus_group_study_rooms SET host_user_id=$2,host_disconnected_at=NULL,version=version+1 WHERE id=$1 RETURNING *", [room.id, nextHost],
          )
          room = transferred.rows[0]
        } else await client.query("UPDATE mednexus_group_study_rooms SET version=version+1 WHERE id=$1", [room.id])
      } else if (body.action === "transfer") {
        if (!isHost || typeof body.targetUserId !== "string") { await client.query("ROLLBACK"); return fail("Only the host can transfer control", 403, "HOST_REQUIRED") }
        const target = await membership(client, room.id, body.targetUserId, true)
        if (!target || target.connection_status !== "online") { await client.query("ROLLBACK"); return fail("Select an active room member", 422) }
        await client.query("UPDATE mednexus_group_study_memberships SET role='member' WHERE id=$1", [member.id])
        await client.query("UPDATE mednexus_group_study_memberships SET role='host' WHERE id=$1", [target.id])
        const transferred = await client.query<RoomRow>("UPDATE mednexus_group_study_rooms SET host_user_id=$2,host_disconnected_at=NULL,version=version+1 WHERE id=$1 RETURNING *", [room.id, target.user_id])
        room = transferred.rows[0]
      } else { await client.query("ROLLBACK"); return fail("Unknown Group Study action") }
    }
    const fresh = (await lockedRoom(client, pin))!
    const responsePosition = Number.isInteger(Number(body.questionPosition)) ? Number(body.questionPosition) : fresh.current_question_index
    const allowedPosition = responsePosition > fresh.current_question_index && ["host_paced", "anyone_advances"].includes(navigationMode(fresh)) ? fresh.current_question_index : responsePosition
    const payload = await serializeRoom(client, fresh, auth.uid, allowedPosition)
    await client.query("COMMIT")
    return NextResponse.json(payload)
  } catch (error) {
    await client.query("ROLLBACK"); console.error("[group-study POST]", error); return fail("Unable to update room", 500, "SERVER_ERROR")
  } finally { client.release() }
}
