import { beforeAll, describe, expect, it, vi } from "vitest"

vi.mock("server-only", () => ({}))

describe("assessment participant tokens", () => {
  beforeAll(() => { process.env.SESSION_SECRET = "assessment-participant-test-secret" })

  it("is tamper resistant and assessment scoped", async () => {
    const { createAssessmentParticipantToken, verifyAssessmentParticipantToken } = await import("@/lib/assessment-participant-token")
    const token = createAssessmentParticipantToken({ participantId: "assessment-person-1", assessmentId: "assessment-1", name: "External Learner" })
    expect(verifyAssessmentParticipantToken(token)).toMatchObject({ participantId: "assessment-person-1", assessmentId: "assessment-1", name: "External Learner", type: "assessment-participant" })
    expect(verifyAssessmentParticipantToken(`${token.slice(0, -1)}x`)).toBeNull()
  })

  it("rejects expired tokens", async () => {
    const { createAssessmentParticipantToken, verifyAssessmentParticipantToken } = await import("@/lib/assessment-participant-token")
    const token = createAssessmentParticipantToken({ participantId: "assessment-person-2", assessmentId: "assessment-2", name: "External Learner" }, -1)
    expect(verifyAssessmentParticipantToken(token)).toBeNull()
  })
})
