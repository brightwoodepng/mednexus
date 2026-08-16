import { NextResponse } from "next/server"
import pool from "@/lib/db"
import { isSupportedSoloQuestion } from "@/lib/game-question-pool"
import {
  GROUP_STUDY_DIFFICULTIES,
  GROUP_STUDY_EXPIRY_HOURS,
  isGroupStudyDifficulty,
  isGroupStudyTimer,
  type GroupStudyDifficulty,
  type GroupStudyQuestionSnapshot,
} from "@/lib/group-study"
import { requireRegisteredUser } from "@/lib/request-auth"
import type { Question } from "@/lib/types"

const fail = (message: string, status = 400, code = "INVALID_REQUEST") =>
  NextResponse.json({ error: message, code }, { status })

function difficultyOf(question: Question): Exclude<GroupStudyDifficulty, "mixed"> | null {
  const raw = (question as Question & { difficulty?: unknown }).difficulty
  if (typeof raw === "string") {
    const normalized = raw.toLowerCase()
    if (normalized === "easy" || normalized === "medium" || normalized === "hard") return normalized
  }
  if (typeof raw === "number") return raw <= 2 ? "easy" : raw >= 4 ? "hard" : "medium"
  const tags = question.tags?.map(tag => tag.toLowerCase()) ?? []
  return GROUP_STUDY_DIFFICULTIES.find(value => value !== "mixed" && tags.includes(value)) as Exclude<GroupStudyDifficulty, "mixed"> | undefined ?? null
}

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

function shuffled<T>(values: T[]) {
  const next = [...values]
  for (let index = next.length - 1; index > 0; index--) {
    const swap = Math.floor(Math.random() * (index + 1))
    ;[next[index], next[swap]] = [next[swap], next[index]]
  }
  return next
}

async function questionBank() {
  const result = await pool.query<{ data: Question[] }>("SELECT data FROM mednexus_questions WHERE id=1")
  return (result.rows[0]?.data ?? []).filter(question => question.moduleStatus !== "offline" && question.status !== "offline" && isSupportedSoloQuestion(question))
}

export async function GET(req: Request) {
  if (!await requireRegisteredUser(req)) return fail("Registered account required", 401, "AUTHENTICATION_REQUIRED")
  try {
    const questions = await questionBank()
    const modules = new Map<string, { total: number; easy: number; medium: number; hard: number; unclassified: number }>()
    for (const question of questions) {
      const moduleId = question.module?.trim() || question.subject.trim()
      const row = modules.get(moduleId) ?? { total: 0, easy: 0, medium: 0, hard: 0, unclassified: 0 }
      row.total++
      const difficulty = difficultyOf(question)
      if (difficulty) row[difficulty]++
      else row.unclassified++
      modules.set(moduleId, row)
    }
    return NextResponse.json({ modules: [...modules.entries()].map(([id, counts]) => ({
      id, ...counts, easy: counts.easy + counts.unclassified,
      medium: counts.medium + counts.unclassified, hard: counts.hard + counts.unclassified,
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
    const body = await req.json() as { moduleId?: unknown; questionCount?: unknown; difficulty?: unknown; timerSeconds?: unknown }
    const moduleId = typeof body.moduleId === "string" ? body.moduleId.trim() : ""
    const questionCount = Number(body.questionCount)
    const difficulty = body.difficulty ?? "mixed"
    const timerSeconds = body.timerSeconds === undefined ? null : body.timerSeconds
    if (!moduleId || !Number.isInteger(questionCount) || questionCount < 1 || questionCount > 200) return fail("A valid module and question count are required")
    if (!isGroupStudyDifficulty(difficulty)) return fail("Difficulty must be Mixed, Easy, Medium or Hard")
    if (!isGroupStudyTimer(timerSeconds)) return fail("Timer must be off, 30, 45, 60 or 90 seconds")

    const available = (await questionBank()).filter(question => {
      const questionModule = question.module?.trim() || question.subject.trim()
      const classified = difficultyOf(question)
      return questionModule === moduleId && (difficulty === "mixed" || classified === difficulty || classified === null)
    })
    if (available.length < questionCount) return fail(`Only ${available.length} eligible questions are available for this selection`, 422, "INSUFFICIENT_QUESTIONS")
    const selected = shuffled(available).slice(0, questionCount).map(snapshot)
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:group-study-pin'))")
      const user = await client.query<{ name: string; avatar: string | null }>(
        `SELECT r.name, c.equipped_avatar AS avatar
         FROM mednexus_registered_users r
         LEFT JOIN mednexus_user_cosmetics c ON c.uid=r.uid
         WHERE r.uid=$1 FOR UPDATE OF r`, [auth.uid],
      )
      if (!user.rows.length) throw new Error("Registered user not found")
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
          (id,pin,host_user_id,module_id,difficulty,question_count,timer_seconds,status,current_phase,expires_at)
         VALUES($1,$2,$3,$4,$5,$6,$7,'lobby','lobby',NOW()+($8||' hours')::interval)`,
        [roomId, pin, auth.uid, moduleId, difficulty, questionCount, timerSeconds, GROUP_STUDY_EXPIRY_HOURS],
      )
      for (let position = 0; position < selected.length; position++) {
        const question = selected[position]
        await client.query(
          `INSERT INTO mednexus_group_study_room_questions(id,room_id,question_id,position,question_snapshot)
           VALUES($1,$2,$3,$4,$5::jsonb)`,
          [`gsq-${crypto.randomUUID()}`, roomId, question.id, position, JSON.stringify(question)],
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
