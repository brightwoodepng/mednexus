import { beforeEach, describe, expect, it, vi } from "vitest"

const mock = vi.hoisted(() => ({ query: vi.fn(), ready: vi.fn(), questions: vi.fn(), auth: vi.fn() }))
vi.mock("@/lib/db", () => ({ default: { query: mock.query, connect: async () => ({ query: mock.query, release: vi.fn() }) }, ensureGroupStudySchema: vi.fn() }))
vi.mock("@/lib/request-auth", () => ({ requireAuthenticatedUser: mock.auth }))
vi.mock("@/lib/theory-group-study-server", () => ({ theoryGroupSchemaReady: mock.ready, theoryGroupQuestions: mock.questions, theoryGroupOptions: vi.fn() }))
import { POST } from "@/app/api/group-study/route"

beforeEach(() => {
  vi.clearAllMocks()
  mock.auth.mockResolvedValue({ uid: "host", isGuest: true })
  mock.ready.mockResolvedValue(true)
  mock.questions.mockResolvedValue([{ id: "t1", collectionTitle: "End of Module", moduleName: "Renal", disciplineName: "Physiology", title: "Filtration", prompt: "Explain filtration", modelAnswer: "", hasAnswer: false, keyMarkingPoints: [], media: [] }])
  mock.query.mockResolvedValue({ rows: [], rowCount: 0 })
})
const create = (body: object) => POST(new Request("https://mednexus.test/api/group-study", { method: "POST", body: JSON.stringify(body) }))

describe("Theory room creation and rollout", () => {
  it("creates a prompt-only snapshot and persists the Theory room type", async () => {
    const response = await create({ studyType: "theory", setId: "set1", questionCount: 1, timerSeconds: 300 })
    expect(response.status).toBe(201)
    const inserts = mock.query.mock.calls.filter(([sql]) => sql.includes("INSERT INTO mednexus_group_study_rooms"))
    expect(inserts).toHaveLength(1)
    expect(inserts[0][0]).toContain("study_type")
    expect(inserts[0][1].at(-1)).toBe("theory")
    const snapshot = mock.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO mednexus_group_study_room_questions"))!
    expect(JSON.parse(snapshot[1][4])).toMatchObject({ id: "t1", theory: { hasAnswer: false, prompt: "Explain filtration" } })
  })
  it("holds back only Theory creation before the migration", async () => {
    mock.ready.mockResolvedValue(false)
    const response = await create({ studyType: "theory", setId: "set1", questionCount: 1 })
    expect(response.status).toBe(503)
    expect((await response.json()).code).toBe("THEORY_SCHEMA_REQUIRED")
    expect(mock.questions).not.toHaveBeenCalled()
    expect(mock.query).not.toHaveBeenCalled()
  })
  it("rejects answer-ahead for Theory", async () => {
    expect((await create({ studyType: "theory", setId: "set1", questionCount: 1, navigationMode: "answer_ahead" })).status).toBe(400)
  })
  it("rejects counts beyond the published set", async () => {
    expect((await create({ studyType: "theory", setId: "set1", questionCount: 2 })).status).toBe(422)
  })
  it("does not require new schema fields when creating MCQ rooms", async () => {
    mock.query.mockImplementation(async (sql: string) => sql.includes("SELECT data FROM mednexus_questions")
      ? { rows: [{ data: [{ id: "m1", module: "Renal", subject: "Physiology", vignette: "MCQ", options: [{ id: "A", text: "A" }, { id: "B", text: "B" }], correctAnswer: "A", explanation: null }] }] }
      : { rows: [], rowCount: 0 })
    const response = await create({ moduleId: "Renal", questionCount: 1 })
    expect(response.status).toBe(201)
    expect(mock.ready).not.toHaveBeenCalled()
    const insert = mock.query.mock.calls.find(([sql]) => sql.includes("INSERT INTO mednexus_group_study_rooms"))!
    expect(insert[0]).not.toContain("study_type")
    expect(insert[1]).toHaveLength(9)
  })
})
