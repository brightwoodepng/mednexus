import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const attemptRoute = readFileSync("app/api/assessments/[id]/attempt/route.ts", "utf8")
const assessmentRoute = readFileSync("app/api/assessments/[id]/route.ts", "utf8")
const createRoute = readFileSync("app/api/assessments/route.ts", "utf8")
const database = readFileSync("lib/db.ts", "utf8")

describe("negative-marking assessment contracts", () => {
  it("grades only on the server and returns the authoritative breakdown", () => {
    expect(attemptRoute).toContain("gradeAssessment(questionIds, correctAnswers, answers")
    expect(attemptRoute).toContain("breakdown: { correct: grade.correct, wrong: grade.wrong, unanswered: grade.unanswered }")
    expect(attemptRoute).not.toContain("body.score")
  })

  it("validates grading modes when assessments are created", () => {
    expect(createRoute).toContain("isAssessmentGradingMode(gradingMode)")
    expect(createRoute).toContain("_mednexusAssessment")
    expect(createRoute).toContain("$8::text")
    expect(createRoute).not.toContain("pass_mark,grading_mode,status")
  })

  it("defines the grading migration without running DDL in assessment requests", () => {
    expect(database).toContain('CURRENT_SCHEMA_VERSION = "2026-08-23-xp-ledger-and-leaderboard-v1"')
    expect(database).toContain("ADD COLUMN IF NOT EXISTS grading_mode")
    expect(createRoute).toContain("assessmentGradingModeSql")
    expect(createRoute).toContain("optionalRuntimePool")
    expect(createRoute).not.toContain("ensureSchema")
  })

  it("locks grading changes after the first submitted attempt", () => {
    expect(assessmentRoute).toContain("submitted_at IS NOT NULL")
    expect(assessmentRoute).toContain("Grading cannot be changed after the first submission")
    expect(assessmentRoute).toContain("status: 409")
  })
})
