import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const schema = readFileSync("lib/db.ts", "utf8")
const route = readFileSync("app/api/group-study/[pin]/route.ts", "utf8")

describe("Group Study persistence and authorization gates", () => {
  it("enforces membership, answer, host and reward idempotency in PostgreSQL", () => {
    expect(schema).toContain("UNIQUE (room_id, user_id)")
    expect(schema).toContain("UNIQUE (room_question_id, user_id)")
    expect(schema).toContain("mednexus_group_study_single_host_idx")
    expect(schema).toContain("mednexus_group_study_reward_idempotency_idx")
    expect(schema).toContain("COALESCE(room_question_id, '__room__')")
  })

  it("locks rooms for mutations and verifies host controls server-side", () => {
    expect(route).toContain("WHERE pin=$1 FOR UPDATE")
    expect(route).toContain('if (!isHost)')
    expect(route).toContain('room.current_phase !== "question_open"')
    expect(route).toContain("requireRegisteredUser")
  })

  it("keeps answer keys behind reveal serialization", () => {
    expect(route).toContain("publicGroupStudyQuestion(question.question_snapshot, reveal)")
    expect(route).not.toContain("correctAnswer: question.question_snapshot.correctAnswer")
    expect(route).toContain("score_processing_status='pending' FOR UPDATE")
    expect(route.indexOf("score_processing_status='pending' FOR UPDATE")).toBeLessThan(route.indexOf("SET current_phase='reveal'"))
  })
})
