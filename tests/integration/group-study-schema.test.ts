import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const schema = readFileSync("lib/db.ts", "utf8")
const route = readFileSync("app/api/group-study/[pin]/route.ts", "utf8")
const creationRoute = readFileSync("app/api/group-study/route.ts", "utf8")
const home = readFileSync("components/group-study/group-study-home.tsx", "utf8")
const room = readFileSync("components/group-study/group-study-room.tsx", "utf8")
const dashboard = readFileSync("components/dashboard.tsx", "utf8")

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
    expect(route).toContain("requireAuthenticatedUser")
  })

  it("allows verified guest participants without granting host or economy privileges", () => {
    expect(schema).toContain("is_guest BOOLEAN NOT NULL DEFAULT FALSE")
    expect(schema).toContain("DROP CONSTRAINT IF EXISTS mednexus_group_study_memberships_user_id_fkey")
    expect(schema).toContain("DROP CONSTRAINT IF EXISTS mednexus_group_study_answers_user_id_fkey")
    expect(route).toContain("auth.isGuest")
    expect(route).toContain("if (member.is_guest) continue")
    expect(route).toContain("target.is_guest")
    expect(route).toContain("LEFT JOIN mednexus_guest_users")
    expect(creationRoute).toContain("canCreate: !auth.isGuest")
    expect(home).toContain("Registered and guest accounts can join")
  })

  it("keeps the dashboard shortcut between statistics and study modules and optimizes the lobby for phones", () => {
    expect(dashboard.indexOf("Group Study")).toBeGreaterThan(dashboard.indexOf("Stats row"))
    expect(dashboard.indexOf("Group Study")).toBeLessThan(dashboard.indexOf("Study Modules"))
    expect(room).toContain("sticky bottom-3")
    expect(room).toContain("min-h-12 w-full")
    expect(room).toContain("Invite at least one participant")
    expect(room).toContain("member.isGuest")
  })

  it("keeps answer keys behind reveal serialization", () => {
    expect(route).toContain("publicGroupStudyQuestion(question.question_snapshot, reveal)")
    expect(route).not.toContain("correctAnswer: question.question_snapshot.correctAnswer")
    expect(route).toContain("score_processing_status='pending' FOR UPDATE")
    expect(route.indexOf("score_processing_status='pending' FOR UPDATE")).toBeLessThan(route.indexOf("SET current_phase='reveal'"))
  })

  it("creates rooms by module, optional discipline, and a bounded question count", () => {
    expect(schema).toContain("discipline               TEXT")
    expect(schema).toContain("mednexus_group_study_question_history")
    expect(creationRoute).toContain('question.subject.trim() === discipline')
    expect(creationRoute).toContain("questionCount > available.length")
    expect(creationRoute).toContain("prioritizeGroupStudyQuestions(available, lastSelected)")
    expect(creationRoute).toContain("pg_advisory_xact_lock(hashtext($1))")
    expect(creationRoute).toContain("await ensureGroupStudySchema()")
    expect(route).toContain("await ensureGroupStudySchema()")
    expect(creationRoute).not.toContain("await ensureSchema()")
    expect(home).toContain("All disciplines")
    expect(home).not.toContain("Difficulty<select")
    expect(home).toContain('type="number"')
    expect(home).toContain("Unseen questions are selected first")
  })
})
