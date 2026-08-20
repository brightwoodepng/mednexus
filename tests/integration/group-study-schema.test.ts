import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const schema = readFileSync("lib/db.ts", "utf8")
const route = readFileSync("app/api/group-study/[pin]/route.ts", "utf8")
const creationRoute = readFileSync("app/api/group-study/route.ts", "utf8")
const home = readFileSync("components/group-study/group-study-home.tsx", "utf8")
const room = readFileSync("components/group-study/group-study-room.tsx", "utf8")
const dashboard = readFileSync("components/dashboard.tsx", "utf8")
const multiplayerApi = readFileSync("lib/multiplayer-api.ts", "utf8")

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

  it("allows verified guests to create, join, and host without economy privileges", () => {
    expect(schema).toContain("is_guest BOOLEAN NOT NULL DEFAULT FALSE")
    expect(schema).toContain("DROP CONSTRAINT IF EXISTS mednexus_group_study_memberships_user_id_fkey")
    expect(schema).toContain("DROP CONSTRAINT IF EXISTS mednexus_group_study_answers_user_id_fkey")
    expect(schema).toContain("DROP CONSTRAINT IF EXISTS mednexus_group_study_rooms_host_user_id_fkey")
    expect(route).toContain("auth.isGuest")
    expect(route).toContain("if (member.is_guest) continue")
    expect(route).toContain("LEFT JOIN mednexus_guest_users")
    expect(creationRoute).toContain("canCreate: true")
    expect(creationRoute).toContain("requireAuthenticatedUser(req)")
    expect(creationRoute).toContain("auth.isGuest ? { rows: []")
    expect(home).toContain("Registered and guest accounts can join")
    expect(multiplayerApi.indexOf('if (guest) headers["x-guest-token"]')).toBeLessThan(multiplayerApi.indexOf('else if (session) headers["x-session-token"]'))
  })

  it("keeps rooms alive while occupied and expires an explicitly empty room", () => {
    expect(route).toContain("GROUP_STUDY_RECONNECT_MINUTES")
    expect(route).toContain("connection_status='online'")
    expect(route).toContain("expires_at=NOW()+($2||' minutes')::interval")
    expect(route).toContain("if (!remaining.rows.length)")
    expect(route).toContain("status='expired',current_phase='expired'")
    expect(route).toContain('return fail("This room has expired", 410, "ROOM_EXPIRED")')
    expect(route).toContain("user_id<>$2 AND connection_status='online'")
    expect(route).not.toContain("user_id<>$2 AND connection_status='online' AND NOT is_guest")
  })

  it("removes personal review actions and connection labels from the room UI", () => {
    expect(route).not.toContain('body.action === "bookmark"')
    expect(route).not.toContain('body.action === "revision"')
    expect(route).not.toContain('body.action === "missed-revision"')
    expect(room).toContain("<GroupReveal")
    expect(room).toContain("<GroupFinalResults")
    expect(room).not.toContain("· {member.connectionStatus}")
  })

  it("persists flags and enforces all four navigation modes without a new database column", () => {
    expect(schema).toContain("flagged_questions INTEGER[] NOT NULL DEFAULT '{}'")
    expect(route).toContain('body.action === "flag"')
    expect(route).toContain("flagged_questions=$2::integer[]")
    expect(room).toContain('aria-label="Question navigator"')
    expect(schema).not.toContain("navigation_mode")
    expect(creationRoute).toContain("isGroupStudyNavigationMode")
    expect(creationRoute).toContain('body.navigationMode ?? "host_paced"')
    expect(creationRoute).toContain("groupStudyNavigationModeToStorage(navigationMode)")
    expect(route).toContain('body.action === "navigation-mode"')
    expect(route).toContain('navigationMode(room) !== "answer_ahead"')
    expect(route).toContain('navigationMode(room) !== "anyone_advances"')
    expect(route).toContain('["host_paced", "anyone_advances"].includes(navigationMode(room))')
    expect(room).toContain("Tap to open navigator")
    expect(room).toContain("Return to live question")
    expect(home).toContain("Default (host-paced)")
    expect(home).toContain("Browse and answer ahead")
  })

  it("keeps Group Study out of the dashboard and optimizes the lobby for phones", () => {
    expect(dashboard).not.toContain('href="/group-study"')
    expect(room).toContain("sticky bottom-3")
    expect(room).toContain("min-h-12 w-full")
    expect(room).toContain('isHost && <button disabled={busy}')
    expect(route).not.toContain("NOT_ENOUGH_MEMBERS")
    expect(multiplayerApi).toContain('cache: "no-store"')
    expect(room).toContain("member.isGuest")
  })

  it("normalizes room PINs and retries a fresh room lookup before reporting it missing", () => {
    expect(route).toContain('pin.replace(/\\D/g, "").slice(0, 6)')
    expect(home).toContain('error.code !== "ROOM_NOT_FOUND"')
    expect(room).toContain('error.code !== "ROOM_NOT_FOUND"')
  })

  it("keeps answer keys behind reveal serialization", () => {
    expect(route).toContain("publicGroupStudyQuestion(question.question_snapshot, reveal)")
    expect(route).not.toContain("correctAnswer: question.question_snapshot.correctAnswer")
    expect(route).toContain("score_processing_status='pending' FOR UPDATE")
    expect(route.indexOf("score_processing_status='pending' FOR UPDATE")).toBeLessThan(route.indexOf("SET current_phase='reveal'"))
  })

  it("keeps early feedback private and shared statistics on the live reveal", () => {
    const revealSection = room.slice(room.indexOf("function GroupReveal"), room.indexOf("function GroupFinalResults"))
    expect(route).toContain("Boolean(viewerAnswer)")
    expect(route).toContain("sharedReveal ? optionCounts : null")
    expect(route).toContain("ON CONFLICT(room_question_id,user_id) DO NOTHING")
    expect(revealSection.indexOf("Explanation")).toBeLessThan(revealSection.indexOf('Stat label="Correct"'))
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
    expect(home).toContain("SUGGESTED_QUESTION_COUNTS")
    expect(home).toContain("Custom amount")
    expect(home).toContain('max={available}')
  })
})
