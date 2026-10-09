import { describe, expect, it } from "vitest"
import { applyPendingMutations } from "@/lib/progress-sync"
import type { UserProgress } from "@/lib/types"

const progress = { totalAnswered: 20, totalCorrect: 10, history: [], examScores: [], flaggedQuestionIds: [], streak: 10, lastStudyDate: "2026-10-09", srsData: {} } as unknown as UserProgress

describe("progress reconciliation", () => {
  it("applies unsent offline changes over another device's progress", () => {
    const result = applyPendingMutations(progress, [{ mutationId: "offline", increments: { totalAnswered: 2, totalCorrect: 1 }, patch: { favoriteModules: ["Cardiology"] } }])
    expect(result.totalAnswered).toBe(22)
    expect(result.totalCorrect).toBe(11)
    expect(result.streak).toBe(10)
    expect(result.favoriteModules).toEqual(["Cardiology"])
  })

  it("does not count an acknowledged mutation twice after a lost response", () => {
    const remote = { ...progress, _syncMutationIds: ["accepted"] }
    expect(applyPendingMutations(remote, [{ mutationId: "accepted", increments: { totalAnswered: 2 } }]).totalAnswered).toBe(20)
  })

  it("keeps the latest saved attempt or its explicit deletion", () => {
    expect(applyPendingMutations(progress, [{ patch: { savedQuizSession: null } }]).savedQuizSession).toBeNull()
  })
})
