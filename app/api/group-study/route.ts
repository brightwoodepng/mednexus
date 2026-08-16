import { NextResponse } from "next/server"
import pool, { ensureGroupStudySchema } from "@/lib/db"
import { isSupportedSoloQuestion } from "@/lib/game-question-pool"
import {
  GROUP_STUDY_EXPIRY_HOURS,
  isGroupStudyTimer,
  prioritizeGroupStudyQuestions,
  type GroupStudyQuestionSnapshot,
} from "@/lib/group-study"
import { requireRegisteredUser } from "@/lib/request-auth"
import type { Question } from "@/lib/types"

const fail = (message: string, status = 400, code = "INVALID_REQUEST") =>
  NextResponse.json({ error: message, code }, { status })

function snapshot(question: Question): GroupStudyQuestionSnapshot {
  if (question.correctAnswer === null) throw new Error("Question has no answer key")
  return {
    id: question.id,
    module: question.module ?? null,
    subject: question.subject,
    vignette: question.vignette,
    questionType: question.questionType,
    contextContent: question.contextContent,
    options: question.options,
    media: question.media,
    mediaBase64: question.mediaBase64,
    multiple: Array.isArray(question.correctAnswer),
    correctAnswer: question.correctAnswer,
    explanation: question.explanation,
  }
}

async function questionBank() {
  const result = await pool.query<{ data: Question[] }>("SELECT data FROM mednexus_questions WHERE id=1")
  return (result.rows[0]?.data ?? []).filter(question => question.moduleStatus !== "offline" && question.status !== "offline" && isSupportedSoloQuestion(question))
}

export async function GET(req: Request) {
  if (!await requireRegisteredUser(req)) return fail("Registered account required", 401, "AUTHENTICATION_REQUIRED")
  try {
    const questions = await questionBank()
    const modules = new Map<string, Map<string, number>>()
    for (const question of questions) {
      const moduleId = question.module?.trim() || question.subject.trim()
      const discipline = question.subject.trim()
      const disciplines = modules.get(moduleId) ?? new Map<string, number>()
      disciplines.set(discipline, (disciplines.get(discipline) ?? 0) + 1)
      modules.set(moduleId, disciplines)
    }
    return NextResponse.json({ modules: [...modules.entries()].map(([id, disciplines]) => ({
      id,
      total: [...disciplines.values()].reduce((sum, count) => sum + count, 0),
      disciplines: [...disciplines.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    })).sort((a, b) => a.id.localeCompare(b.id)) })
  } catch (error) {
    console.error("[group-study GET]", error)
    return fail("Unable to load Group Study options", 500, "SERVER_ERROR")
  }
}

export async function POST(req: Request) {
  const auth = await requireRegisteredUser(req)
  if (!auth) return fail("Registered account required", 401, "AUTHENTICATION_REQUIRED")
  try {
    await ensureGroupStudySchema()
    const body = await req.json() as { moduleId?: unknown; discipline?: unknown; questionCount?: unknown; timerSeconds?: unknown }
    const moduleId = typeof body.moduleId === "string" ? body.moduleId.trim() : ""
    const discipline = typeof body.discipline === "string" ? body.discipline.trim() : ""
    const questionCount = Number(body.questionCount)
    const timerSeconds = body.timerSeconds === undefined ? null : body.timerSeconds
    if (!moduleId || !Number.isInteger(questionCount) || questionCount < 1) return fail("A valid module and question count are required")
    if (!isGroupStudyTimer(timerSeconds)) return fail("Timer must be off, 30, 45, 60 or 90 seconds")

    const available = (await questionBank()).filter(question => {
      const questionModule = question.module?.trim() || question.subject.trim()
      return questionModule === moduleId && (!discipline || question.subject.trim() === discipline)
    })
    if (!available.length) return fail("No eligible questions are available for this selection", 422, "INSUFFICIENT_QUESTIONS")
    if (questionCount > available.length) return fail(`Only ${available.length} eligible questions are available for this selection`, 422, "INSUFFICIENT_QUESTIONS")
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      const disciplineScope = discipline || ""
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`mednexus:group-study-rotation:${auth.uid}:${moduleId}:${disciplineScope}`])
      await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:group-study-pin'))")
      const user = await client.query<{ name: string; avatar: string | null }>(
        `SELECT r.name, c.equipped_avatar AS avatar
         FROM mednexus_registered_users r
         LEFT JOIN mednexus_user_cosmetics c ON c.uid=r.uid
         WHERE r.uid=$1 FOR UPDATE OF r`, [auth.uid],
      )
      if (!user.rows.length) throw new Error("Registered user not found")
      const history = await client.query<{ question_id: string; last_selected_at: Date }>(
        `SELECT question_id,last_selected_at FROM mednexus_group_study_question_history
         WHERE user_id=$1 AND module_id=$2 AND discipline_scope=$3`,
        [auth.uid, moduleId, disciplineScope],
      )
      const lastSelected = new Map(history.rows.map(row => [row.question_id, row.last_selected_at.getTime()]))
      const selected = prioritizeGroupStudyQuestions(available, lastSelected).slice(0, questionCount).map(snapshot)
      const roomId = `gsr-${crypto.randomUUID()}`
      let pin = ""
      for (let attempt = 0; attempt < 20; attempt++) {
        const candidate = Math.floor(100000 + Math.random() * 900000).toString()
        const exists = await client.query("SELECT 1 FROM mednexus_group_study_rooms WHERE pin=$1", [candidate])
        if (!exists.rows.length) { pin = candidate; break }
      }
      if (!pin) throw new Error("Unable to reserve a room PIN")
      await client.query(
        `INSERT INTO mednexus_group_study_rooms
          (id,pin,host_user_id,module_id,discipline,difficulty,question_count,timer_seconds,status,current_phase,expires_at)
         VALUES($1,$2,$3,$4,$5,'mixed',$6,$7,'lobby','lobby',NOW()+($8||' hours')::interval)`,
        [roomId, pin, auth.uid, moduleId, discipline || null, questionCount, timerSeconds, GROUP_STUDY_EXPIRY_HOURS],
      )
      for (let position = 0; position < selected.length; position++) {
        const question = selected[position]
        await client.query(
          `INSERT INTO mednexus_group_study_room_questions(id,room_id,question_id,position,question_snapshot)
           VALUES($1,$2,$3,$4,$5::jsonb)`,
          [`gsq-${crypto.randomUUID()}`, roomId, question.id, position, JSON.stringify(question)],
        )
        await client.query(
          `INSERT INTO mednexus_group_study_question_history
            (user_id,module_id,discipline_scope,question_id,last_selected_at,selection_count)
           VALUES($1,$2,$3,$4,NOW(),1)
           ON CONFLICT(user_id,module_id,discipline_scope,question_id) DO UPDATE
           SET last_selected_at=NOW(),selection_count=mednexus_group_study_question_history.selection_count+1`,
          [auth.uid, moduleId, disciplineScope, question.id],
        )
      }
      await client.query(
        `INSERT INTO mednexus_group_study_memberships
          (id,room_id,user_id,role,ready,connection_status,first_eligible_question)
         VALUES($1,$2,$3,'host',TRUE,'online',0)`,
        [`gsm-${crypto.randomUUID()}`, roomId, auth.uid],
      )
      await client.query("COMMIT")
      return NextResponse.json({ roomId, pin, invitationPath: `/group-study/${pin}` }, { status: 201 })
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error("[group-study POST]", error)
    return fail("Unable to create Group Study room", 500, "SERVER_ERROR")
  }
}
