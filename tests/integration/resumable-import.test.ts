import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"
import type { Question } from "@/lib/types"
import {
  createResumableBatches,
  failedQuestionRanges,
  mergeCompletedBatchQuestions,
  runWithImportRetry,
  stableImportQuestionId,
} from "@/lib/resumable-import"

function question(id: string): Question {
  return {
    id,
    subject: "Dermatology",
    vignette: `Question ${id}`,
    options: [{ id: "A", text: "Option A" }, { id: "B", text: "Option B" }],
    correctAnswer: "A",
    explanation: null,
  }
}

describe("resumable MCQ imports", () => {
  it("retries a temporary failure twice and succeeds on the third attempt", async () => {
    const attempts: number[] = []
    const waits: number[] = []
    const operation = vi.fn(async (attempt: number) => {
      if (attempt < 3) throw new Error("temporary")
      return "recovered"
    })

    const result = await runWithImportRetry(
      operation,
      (attempt) => attempts.push(attempt),
      [2_000, 5_000],
      async (milliseconds) => { waits.push(milliseconds) },
    )

    expect(result).toBe("recovered")
    expect(attempts).toEqual([1, 2, 3])
    expect(waits).toEqual([2_000, 5_000])
    expect(operation).toHaveBeenCalledTimes(3)
  })

  it("stops after three failed attempts", async () => {
    const attempts: number[] = []
    await expect(runWithImportRetry(
      async () => { throw new Error("still unavailable") },
      (attempt) => attempts.push(attempt),
      [2_000, 5_000],
      async () => undefined,
    )).rejects.toThrow("still unavailable")
    expect(attempts).toEqual([1, 2, 3])
  })

  it("preserves source order while excluding failed batches", () => {
    const batches = createResumableBatches(["1. One", "2. Two", "3. Three"], true, () => 1)
    batches[0].status = "completed"
    batches[0].questions = [question("one")]
    batches[1].status = "failed"
    batches[2].status = "completed"
    batches[2].questions = [question("three")]

    expect(mergeCompletedBatchQuestions(batches).map((item) => item.id)).toEqual(["one", "three"])
    expect(failedQuestionRanges(batches)).toEqual(["2"])
  })

  it("carries module and discipline tags forward without relying on earlier API results", () => {
    const batches = createResumableBatches([
      "MODULE: Integument II\nDISCIPLINE: Dermatology\n1. First",
      "2. Second",
      "DISCIPLINE: Pathology\n3. Third",
      "4. Fourth",
    ], true, () => 1)

    expect(batches[0].fallbackModule).toBeNull()
    expect(batches[1].fallbackModule).toBe("Integument II")
    expect(batches[1].fallbackDiscipline).toBe("Dermatology")
    expect(batches[2].fallbackDiscipline).toBe("Dermatology")
    expect(batches[3].fallbackDiscipline).toBe("Pathology")
  })

  it("creates deterministic source IDs for retried questions", () => {
    const fingerprint = "0123456789abcdef0123456789abcdef"
    expect(stableImportQuestionId(fingerprint, 6, 3, 154)).toBe("import-0123456789abcdef0123-q154-b7-p4")
    expect(stableImportQuestionId(fingerprint, 6, 3, 154)).toBe(stableImportQuestionId(fingerprint, 6, 3, 154))
  })

  it("exposes retry-only and guarded partial-import controls in the importer", async () => {
    const importer = await readFile(
      new URL("../../components/universal-importer.tsx", import.meta.url),
      "utf8",
    )

    expect(importer).toContain("Retry failed batches")
    expect(importer).toContain("Continue with partial import")
    expect(importer).toContain("Complete all batches first")
    expect(importer).toContain("Resume only the unfinished batches?")
    expect(importer).toContain("stableImportQuestionId")
  })
})
