import type { GroupStudyQuestionSnapshot } from "@/lib/group-study"
import type { TheoryQuestionDetail } from "@/lib/types"

export function isTheoryDiscussionTimer(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isInteger(value) && value >= 30 && value <= 3600)
}

export function theoryGroupSnapshot(question: TheoryQuestionDetail): GroupStudyQuestionSnapshot {
  return {
    id: question.id, module: question.moduleName, subject: question.disciplineName ?? "Theory",
    vignette: question.prompt, options: [], multiple: false, correctAnswer: "", explanation: null,
    theory: { title: question.title, prompt: question.prompt, modelAnswer: question.modelAnswer,
      keyMarkingPoints: question.keyMarkingPoints, media: question.media, hasAnswer: question.hasAnswer },
  }
}
