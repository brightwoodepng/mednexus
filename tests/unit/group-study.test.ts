import { describe, expect, it } from "vitest"
import {
  firstEligibleQuestionIndex,
  isValidGroupStudyAnswer,
  publicGroupStudyQuestion,
  rankGroupStudyMembers,
  sameGroupStudyAnswer,
  type GroupStudyLeaderboardMember,
  type GroupStudyQuestionSnapshot,
} from "@/lib/group-study"

const question: GroupStudyQuestionSnapshot = {
  id: "q1", module: "Medicine", subject: "Cardiology", vignette: "Stem", multiple: false,
  options: [{ id: "A", text: "One" }, { id: "B", text: "Two" }], correctAnswer: "B",
  explanation: { objective: "Objective", details: "Details", incorrectReasoning: "Reasoning" },
}

function member(overrides: Partial<GroupStudyLeaderboardMember>): GroupStudyLeaderboardMember {
  return { userId: crypto.randomUUID(), name: "Member", role: "member", firstEligibleQuestion: 0,
    questionsAttempted: 0, correctAnswers: 0, incorrectAnswers: 0, eligibleUnanswered: 0,
    currentStreak: 0, highestStreak: 0, roomScore: 0, sessionNpEarned: 0,
    connectionStatus: "online", ...overrides }
}

describe("Group Study domain rules", () => {
  it("never exposes keys or explanations before reveal", () => {
    expect(publicGroupStudyQuestion(question, false)).not.toHaveProperty("correctAnswer")
    expect(publicGroupStudyQuestion(question, false)).not.toHaveProperty("explanation")
    expect(publicGroupStudyQuestion(question, true)).toMatchObject({ correctAnswer: "B", explanation: question.explanation })
  })

  it("sets late-join eligibility from the authoritative phase", () => {
    expect(firstEligibleQuestionIndex(3, "question_open")).toBe(3)
    expect(firstEligibleQuestionIndex(3, "reveal")).toBe(4)
    expect(firstEligibleQuestionIndex(3, "discussion")).toBe(4)
  })

  it("validates and compares single and multiple answers", () => {
    expect(isValidGroupStudyAnswer("B", question)).toBe(true)
    expect(isValidGroupStudyAnswer("C", question)).toBe(false)
    expect(sameGroupStudyAnswer(["A", "C"], ["C", "A"])).toBe(true)
  })

  it("ranks without speed and assigns shared tied positions", () => {
    const ranked = rankGroupStudyMembers([
      member({ userId: "late", name: "Late", firstEligibleQuestion: 3, correctAnswers: 3, questionsAttempted: 3, currentStreak: 3 }),
      member({ userId: "early", name: "Early", correctAnswers: 3, questionsAttempted: 5, currentStreak: 1 }),
      member({ userId: "tie", name: "Tie", correctAnswers: 3, questionsAttempted: 5, currentStreak: 1 }),
    ])
    expect(ranked.map(row => [row.userId, row.rank])).toEqual([["early", 1], ["tie", 1], ["late", 3]])
    expect(ranked.find(row => row.userId === "late")?.eligibleQuestions).toBe(3)
  })
})
