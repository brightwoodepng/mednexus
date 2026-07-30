import { readFileSync } from "node:fs"
import { describe, expect, it, vi } from "vitest"

const root = process.cwd()
const read = (path: string) => readFileSync(`${root}/${path}`, "utf8")

describe("database transfer regressions", () => {
  it("projects assessment questions in Postgres instead of transferring snapshots or the full bank", () => {
    const helper = read("lib/assessment-questions.ts")
    expect(helper).toContain("jsonb_array_elements")
    expect(helper).toContain("assessment.question_ids ? (item.value->>'id')")
    expect(helper).toContain("jsonb_array_elements_text(assessment.question_ids)")

    for (const route of [
      "app/api/assessments/[id]/route.ts",
      "app/api/assessments/by-token/route.ts",
      "app/api/assessments/[id]/attempt/route.ts",
      "app/api/admin/results/[id]/route.ts",
    ]) {
      const source = read(route)
      expect(source).toContain("loadAssessmentQuestions")
      expect(source).not.toContain("SELECT data FROM mednexus_questions")
      expect(source).not.toMatch(/SELECT[^`]*question_snapshot/)
    }
    const createRoute = read("app/api/assessments/route.ts")
    expect(createRoute).toContain("INSERT INTO mednexus_assessments")
    expect(createRoute).toContain("jsonb_agg(question)")
    expect(createRoute).not.toContain("qRes.rows.map")
  })

  it("reconciles legacy editor deltas without sending the complete bank", () => {
    const context = read("contexts/questions-context.tsx")
    const route = read("app/api/admin/mcq/questions/reconcile/route.ts")
    expect(context).toContain("/api/admin/mcq/questions/reconcile")
    expect(context).toContain("deletedIds")
    expect(context).not.toContain('fetch("/api/questions", {\n      method: "PUT"')
    expect(route).toContain("jsonb_array_elements($1::jsonb)")
    expect(route).not.toContain("SELECT data FROM mednexus_questions")
    expect(read("app/api/admin/mcq/questions/route.ts")).not.toContain(
      "SELECT data FROM mednexus_questions WHERE id=1 FOR UPDATE",
    )
    expect(read("app/api/admin/taxonomy/route.ts")).not.toContain(
      "SELECT data FROM mednexus_questions WHERE id=1 FOR UPDATE",
    )
    const publicQuestionsRoute = read("app/api/questions/route.ts")
    const legacyPut = publicQuestionsRoute.slice(publicQuestionsRoute.indexOf("export async function PUT"))
    expect(legacyPut).not.toContain("getQuestionBankStatus()")
  })

  it("externalizes newly persisted inline MCQ media when object storage is configured", () => {
    const normalizer = read("lib/mcq-media-normalization.ts")
    const storage = read("lib/mcq-media-storage.ts")
    const append = read("app/api/questions/append/route.ts")
    const reconcile = read("app/api/admin/mcq/questions/reconcile/route.ts")
    expect(normalizer).toContain("putMcqMedia")
    expect(normalizer).toContain("mediaBase64: _embedded")
    expect(normalizer).toContain("BLOB_READ_WRITE_TOKEN")
    expect(storage).toContain('from "@vercel/blob"')
    expect(storage).toContain('access: "public"')
    expect(storage).not.toContain("@aws-sdk")
    expect(append).toContain("externalizeLegacyQuestionMedia")
    expect(reconcile).toContain("externalizeLegacyQuestionMedia")
    const migration = read("scripts/migrate-inline-mcq-media.ts")
    expect(migration).toContain("question_snapshot")
    expect(migration).toContain("Inline MCQ media migration complete")
  })

  it("uses version-aware startup sync and cached poll authorization", () => {
    const sync = read("app/api/sync/route.ts")
    const app = read("contexts/app-context.tsx")
    const rooms = read("app/api/game-rooms/[pin]/route.ts")
    expect(sync).toContain("unchanged: true")
    expect(sync.indexOf("knownVersion === version")).toBeLessThan(sync.indexOf("mednexus_progress_history"))
    expect(sync).toContain("LEFT JOIN mednexus_progress")
    expect(sync.indexOf('pool.query("SELECT data FROM mednexus_progress')).toBeGreaterThan(sync.indexOf("knownVersion === version"))
    expect(app).toContain("mednexus-sync-version:")
    expect(app).toContain("if (remote.progress) setProgress(remote.progress)")
    expect(rooms).toContain("requireAuthenticatedUser(req, { cacheMs: 15_000 })")
    expect(rooms).toContain("AS is_player")
    expect(rooms).toContain("if (!row.is_player)")
  })

  it("caches the legacy media schema check instead of querying it for every image", () => {
    const media = read("app/api/mcq/media/[id]/route.ts")
    expect(media).toContain("legacyDataColumnPromise")
    expect(media).toContain("if (!legacyDataColumnPromise)")
  })

  it("reuses resolved notification permissions without a second authorization query", () => {
    const summary = read("app/api/notifications/unread-summary/route.ts")
    const notifications = read("app/api/notifications/route.ts")
    expect(summary).not.toContain("requireAdminRequest")
    expect(summary).toContain('permissions?.has("manage_broadcasts")')
    expect(notifications).toContain('permissions?.has("manage_broadcasts")')
  })

  it("loads only the selected randomized game questions instead of the first bank page", () => {
    const context = read("contexts/questions-context.tsx")
    const route = read("app/api/questions/route.ts")
    const server = read("lib/question-bank-server.ts")
    const solo = read("components/game-mode.tsx")
    const multiplayer = read("components/game-mode-multiplayer.tsx")

    expect(context).toContain('view: "game"')
    expect(context).toContain('quantity: String(Math.max(1, quantity))')
    expect(context).not.toContain("view=runtime&page=1&pageSize=${QUESTION_PAGE_SIZE}")
    expect(route).toContain('get("view") === "game"')
    expect(route).toContain("getRandomGameQuestions")
    expect(server).toContain("ORDER BY random()")
    expect(server).toContain("LIMIT $3")
    expect(solo).toContain("loadSoloRoundSelection")
    expect(solo).toContain("gameCatalog: catalog")
    expect(multiplayer).toContain("loadGameQuestionPool")
    expect(multiplayer).not.toContain("filterQuestions(allQ")
  })
})

describe("assessment question SQL projection", () => {
  it("returns only rows produced by the bounded projection query", async () => {
    vi.resetModules()
    const { loadAssessmentQuestions } = await import("@/lib/assessment-questions")
    const query = vi.fn(async (_sql: string, _params: unknown[]) => ({
      rows: [{ question: { id: "q1", correctAnswer: "A" } }],
    }))
    const result = await loadAssessmentQuestions({ query } as never, "assessment-1", "grading")
    expect(result).toEqual([{ id: "q1", correctAnswer: "A" }])
    expect(query).toHaveBeenCalledTimes(1)
    expect(query.mock.calls[0][0]).toContain("jsonb_build_object")
    expect(query.mock.calls[0][1]).toEqual(["assessment-1"])
  })
})
