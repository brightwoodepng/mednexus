import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"

const requireAuthenticatedUser = vi.fn()
const getQuestionPage = vi.fn()
const getQuestionBankMetadata = vi.fn()
const getQuestionCatalog = vi.fn()

vi.mock("@/lib/request-auth", () => ({ requireAuthenticatedUser }))
vi.mock("@/lib/question-bank-server", () => ({
  getQuestionBankStatus: vi.fn(),
  getQuestionPage,
  getQuestionBankMetadata,
  getQuestionCatalog,
}))
vi.mock("@/lib/db", () => ({ default: { query: vi.fn() } }))

const request = (path: string) => new NextRequest(`http://mednexus.test${path}`)

describe("question transfer security", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requireAuthenticatedUser.mockResolvedValue(null)
    getQuestionBankMetadata.mockResolvedValue({ count: 123, updatedAt: null })
    getQuestionPage.mockResolvedValue({ questions: [], total: 0, updatedAt: null })
    getQuestionCatalog.mockResolvedValue({ modules: [], totalCount: 0, updatedAt: null })
  })

  it("keeps metadata public without loading a question page", async () => {
    const { GET } = await import("@/app/api/questions/route")
    const response = await GET(request("/api/questions?view=meta"))
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ count: 123, updatedAt: null })
    expect(getQuestionPage).not.toHaveBeenCalled()
  })

  it("rejects unauthenticated runtime projections before querying content", async () => {
    const { GET } = await import("@/app/api/questions/route")
    const response = await GET(request("/api/questions?view=runtime&module=Cardiology"))
    expect(response.status).toBe(401)
    expect(getQuestionPage).not.toHaveBeenCalled()
  })

  it("passes filters and bounded pages for authenticated lazy sets", async () => {
    requireAuthenticatedUser.mockResolvedValue({ uid: "learner-1" })
    const { GET } = await import("@/app/api/questions/route")
    const response = await GET(request("/api/questions?view=runtime&module=Cardiology&discipline=ECG&pageSize=500"))
    expect(response.status).toBe(200)
    expect(getQuestionPage).toHaveBeenCalledWith(expect.objectContaining({
      moduleName: "Cardiology", discipline: "ECG", pageSize: 25, offset: 0, publicProjection: false,
    }))
  })

  it("requires authentication before checking or revealing an answer", async () => {
    const { POST } = await import("@/app/api/questions/answer/route")
    const response = await POST(new NextRequest("http://mednexus.test/api/questions/answer", {
      method: "POST", body: JSON.stringify({ questionId: "q1", answer: "A" }),
      headers: { "content-type": "application/json" },
    }))
    expect(response.status).toBe(401)
  })
})
