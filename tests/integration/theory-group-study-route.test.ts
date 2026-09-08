import { beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ query: vi.fn(), auth: vi.fn(), reward: vi.fn() }))
vi.mock("@/lib/db", () => ({ default: { connect: async () => ({ query: mock.query, release: vi.fn() }) }, ensureGroupStudySchema: vi.fn() }))
vi.mock("@/lib/request-auth", () => ({ requireAuthenticatedUser: mock.auth }))
vi.mock("@/lib/notification-schema", () => ({ ensureNotificationSchema: vi.fn() }))
vi.mock("@/lib/personal-notifications", () => ({ notifyRoomMembers: vi.fn(), notifyUser: vi.fn() }))
vi.mock("@/lib/economy-seasons", () => ({ getActiveSeason: mock.reward }))
vi.mock("@/lib/economy-runtime-config", () => ({ getActiveEconomyConfig: mock.reward }))
vi.mock("@/lib/np-ledger", () => ({ applyNPCredits: mock.reward, dailyRewardRemaining: mock.reward, recordDailyActivity: mock.reward }))
vi.mock("@/lib/xp-ledger", () => ({ applyXPCredits: mock.reward }))

import { GET, POST } from "@/app/api/group-study/[pin]/route"

let room: Record<string, any>
let member: Record<string, any>
let questions: Array<Record<string, any>>
beforeEach(() => {
  vi.clearAllMocks()
  room = { id: "room", pin: "123456", study_type: "theory", host_user_id: "host", module_id: "Renal", discipline: "Physiology", difficulty: "mixed", question_count: 2, timer_seconds: 120,
    status: "active", current_question_index: 0, current_phase: "question_open", question_opened_at: new Date(), answer_closes_at: new Date(Date.now() - 1000), answer_closed_at: null,
    host_disconnected_at: null, version: 1, created_at: new Date(), expires_at: new Date(Date.now() + 600000), completed_at: null }
  member = { id: "member", user_id: "host", role: "host", name: "Host", ready: true, is_guest: true, first_eligible_question: 0, connection_status: "online", flagged_questions: [],
    questions_attempted: 0, correct_answers: 0, incorrect_answers: 0, eligible_unanswered: 0, current_streak: 0, highest_streak: 0, room_score: 0, session_np_earned: 0 }
  questions = [0, 1].map(position => ({ id: `rq${position}`, position, question_id: `q${position}`, opened_at: new Date(), closed_at: null, revealed_at: null,
    question_snapshot: { id: `q${position}`, module: "Renal", subject: "Physiology", vignette: "Prompt", options: [], multiple: false, correctAnswer: "", explanation: null,
      theory: { title: "Title", prompt: "Prompt", modelAnswer: "Secret model answer", keyMarkingPoints: ["Secret points"], hasAnswer: true, media: [] } } }))
  mock.auth.mockResolvedValue({ uid: "host", isGuest: true })
  mock.query.mockImplementation(async (sql: string, args: any[] = []) => {
    if (["BEGIN", "COMMIT", "ROLLBACK"].includes(sql)) return { rows: [], rowCount: 0 }
    if (sql.includes("SELECT * FROM mednexus_group_study_rooms")) return { rows: [{ ...room }] }
    if (sql.includes("SET connection_status='disconnected'")) return { rows: [], rowCount: 0 }
    if (sql.includes("SELECT user_id FROM mednexus_group_study_memberships")) return { rows: [{ user_id: "host" }] }
    if (sql.includes("SELECT connection_status")) return { rows: [{ connection_status: "online" }] }
    if (sql.includes("SELECT * FROM mednexus_group_study_memberships") || sql.includes("SELECT m.*,COALESCE")) return { rows: [{ ...member }] }
    if (sql.startsWith("UPDATE mednexus_group_study_rooms")) {
      if (sql.includes("current_question_index=$2")) room.current_question_index = args[1]
      if (sql.includes("current_question_index=current_question_index-1")) room.current_question_index--
      if (sql.includes("current_phase='discussion'")) room.current_phase = "discussion"
      if (sql.includes("current_phase='completed'")) { room.current_phase = "completed"; room.status = "completed"; room.completed_at = new Date() }
      return { rows: [{ ...room }], rowCount: 1 }
    }
    if (sql.includes("SET revealed_at=COALESCE")) { questions[args[1]].revealed_at = new Date(); return { rows: [], rowCount: 1 } }
    if (sql.includes("SELECT * FROM mednexus_group_study_room_questions")) return { rows: [questions[args[1]]] }
    if (sql.includes("SELECT q.id,q.position,q.question_snapshot")) return { rows: questions.map(q => ({ ...q, correct_count: 0, answer_count: 0, is_correct: null })) }
    return { rows: [], rowCount: 0 }
  })
})

async function action(body: Record<string, unknown>) {
  return POST(new Request("https://mednexus.test/api/group-study/123456", { method: "POST", body: JSON.stringify(body) }), { params: Promise.resolve({ pin: "123456" }) })
}
async function read(suffix = "") { return GET(new Request(`https://mednexus.test/api/group-study/123456${suffix}`), { params: Promise.resolve({ pin: "123456" }) }) }

describe("Theory room backend behavior", () => {
  it("advances directly with no answers and no reveal", async () => {
    const response = await action({ action: "next", expectedIndex: 0 })
    expect(response.status).toBe(200)
    expect((await response.json()).room.currentQuestionIndex).toBe(1)
    expect(mock.reward).not.toHaveBeenCalled()
    expect(mock.query.mock.calls.some(([sql]) => /INSERT INTO mednexus_group_study_answers/.test(sql))).toBe(false)
  })
  it("completes without paying rewards or inventing unanswered scores", async () => {
    room.current_question_index = 1
    const response = await action({ action: "next", expectedIndex: 1 })
    const result = await response.json()
    expect(response.status).toBe(200)
    expect(result.room.phase).toBe("completed")
    expect(result.members).toHaveLength(1)
    expect(JSON.stringify(result.finalReview)).not.toContain("Secret")
    expect(mock.reward).not.toHaveBeenCalled()
  })
  it("does not close answering or reveal when a discussion timer expires", async () => {
    const response = await read()
    const data = await response.json()
    expect(data.room.phase).toBe("question_open")
    expect(JSON.stringify(data)).not.toContain("Secret")
    expect(mock.reward).not.toHaveBeenCalled()
  })
  it.each(["submit", "close"])("rejects MCQ action %s", async actionName => {
    const response = await action({ action: actionName, answer: "A" })
    expect(response.status).toBe(409)
    expect((await response.json()).code).toBe("THEORY_DISCUSSION_ONLY")
  })
  it("reveals answers only after the host asks", async () => {
    const response = await action({ action: "reveal", expectedIndex: 0 })
    expect(response.status).toBe(200)
    expect((await response.json()).question.theory.modelAnswer).toBe("Secret model answer")
  })
  it.each(["reveal", "previous", "next"])("blocks participant control: %s", async actionName => {
    member.role = "member"; mock.auth.mockResolvedValue({ uid: "student", isGuest: true })
    const response = await action({ action: actionName, expectedIndex: 0 })
    expect(response.status).toBe(403)
  })
  it("allows anyone-advances without answering", async () => {
    room.difficulty = "hard"; member.role = "member"
    mock.auth.mockResolvedValue({ uid: "student", isGuest: true })
    expect((await action({ action: "next", expectedIndex: 0 })).status).toBe(200)
  })
  it("rejects a duplicate Next request", async () => {
    await action({ action: "next", expectedIndex: 0 })
    expect((await action({ action: "next", expectedIndex: 0 })).status).toBe(409)
    expect(room.current_question_index).toBe(1)
  })
  it("does not reveal skipped answers when revisiting", async () => {
    room.current_question_index = 1
    const response = await read("?question=0")
    expect(JSON.stringify(await response.json())).not.toContain("Secret")
  })
  it("locks future questions in host-paced rooms", async () => {
    expect((await read("?question=1")).status).toBe(403)
  })
  it("keeps the MCQ answer/reveal gate unchanged", async () => {
    room.study_type = "mcq"; room.answer_closes_at = null
    const response = await action({ action: "next" })
    expect(response.status).toBe(409)
    expect((await response.json()).error).toBe("Reveal the current answer first")
  })
})
