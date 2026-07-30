import { readFileSync } from "node:fs"
import { performance } from "node:perf_hooks"
import { beforeEach, describe, expect, it, vi } from "vitest"

type Phase = "lobby" | "question" | "reveal" | "done"

const harness = vi.hoisted(() => ({
  row: {} as Record<string, unknown>,
  queries: [] as string[],
}))

vi.mock("@/lib/request-auth", () => ({
  requireAuthenticatedUser: async (request: Request) => {
    const uid = request.headers.get("authorization")?.replace("Bearer ", "")
    return uid ? { uid } : null
  },
}))

vi.mock("@/lib/db", () => ({
  default: {
    query: async (sql: string) => {
      harness.queries.push(sql)
      return { rows: [{ ...harness.row }] }
    },
    connect: async () => {
      throw new Error("poll traffic unexpectedly acquired a database client")
    },
  },
}))

import { GET } from "@/app/api/game-rooms/[pin]/route"

const PARTICIPANT_COUNTS = [2, 5, 10] as const
const QUESTION_COUNT = 10
const POLL_INTERVAL_MS = 1_500

// A reproducible ten-question match: 15 seconds in the lobby, 15 seconds to
// answer each question, 3 seconds answered/waiting, a 3 second reveal, and one
// final completion poll. The first poll in a new version is a delta; all other
// polls are deliberately unchanged.
const MATCH_TRACE: ReadonlyArray<{ phase: Phase; label: string; polls: number; versionBump: boolean }> = [
  { phase: "lobby", label: "lobby", polls: 10, versionBump: false },
  ...Array.from({ length: QUESTION_COUNT }, () => [
    { phase: "question" as const, label: "question", polls: 10, versionBump: true },
    { phase: "question" as const, label: "answered-waiting", polls: 2, versionBump: true },
    { phase: "reveal" as const, label: "reveal", polls: 2, versionBump: true },
  ]).flat(),
  { phase: "done", label: "completion", polls: 1, versionBump: true },
]

const BUDGETS = {
  maxRequestsPerParticipant: 152,
  maxQueriesPerParticipant: 183,
  maxLockedTransactionsPerMatch: 0,
  maxBytesPerParticipant: 180_000,
  maxP95LatencyMs: 25,
} as const

function questionPool() {
  return Array.from({ length: QUESTION_COUNT }, (_, index) => ({
    id: `q-${index}`,
    subject: "Medicine",
    module: "Cardiology",
    vignette: `Representative clinical vignette ${index} ${"x".repeat(350)}`,
    options: ["A", "B", "C", "D"].map(id => ({ id, text: `Option ${id} ${"y".repeat(45)}` })),
    correctAnswer: "A",
    explanation: { objective: "Representative objective", details: "z".repeat(180) },
  }))
}

function setRoom(participants: number, phase: Phase, version: number, answered = false) {
  const players = Array.from({ length: participants }, (_, index) => ({
    id: `player-${index}`,
    name: `Participant ${index}`,
    score: index * 100,
    streak: index,
    answer: answered ? "A" : null,
    answeredAt: answered ? 1_700_000_000_000 : null,
    isHost: index === 0,
  }))
  harness.row = {
    pin: "246810",
    mode: "clash",
    host_id: "player-0",
    host_name: "Participant 0",
    question_pool: questionPool(),
    current_question: questionPool()[Math.min(version, QUESTION_COUNT - 1)],
    current_qi: Math.min(Math.floor(version / 3), QUESTION_COUNT - 1),
    phase,
    players,
    version,
    scored_uids: [],
    created_at: new Date(),
    phase_started_at: new Date(),
    knockout_winner_id: null,
    is_player: true,
  }
}

async function poll(player: number, version?: number) {
  const query = version === undefined ? "" : `?version=${version}${player === 0 ? "&tick=1" : ""}`
  const request = new Request(`http://localhost/api/game-rooms/246810${query}`, {
    headers: { authorization: `Bearer player-${player}` },
  })
  const started = performance.now()
  const response = await GET(request, { params: Promise.resolve({ pin: "246810" }) })
  const body = await response.text()
  return { response, body, latencyMs: performance.now() - started }
}

function percentile95(values: number[]) {
  return [...values].sort((a, b) => a - b)[Math.ceil(values.length * 0.95) - 1]
}

describe("game-room route traffic budget", () => {
  beforeEach(() => {
    harness.queries.length = 0
  })

  for (const participants of PARTICIPANT_COUNTS) {
    it(`stays within the ${participants}-participant match budget`, async () => {
      setRoom(participants, "lobby", 0)
      const versions = Array(participants).fill(undefined) as Array<number | undefined>
      const requests = Array(participants).fill(0)
      const bytes = Array(participants).fill(0)
      const latencies: number[] = []
      const labelsSeen = new Set<string>()
      const initialBodies: string[] = []
      const unchangedBodies: string[] = []

      for (let player = 0; player < participants; player++) {
        const result = await poll(player)
        requests[player]++
        bytes[player] += Buffer.byteLength(result.body)
        latencies.push(result.latencyMs)
        initialBodies.push(result.body)
        versions[player] = Number(JSON.parse(result.body).version)
      }

      let version = 0
      for (const step of MATCH_TRACE) {
        labelsSeen.add(step.label)
        if (step.versionBump) version++
        setRoom(participants, step.phase, version, step.label === "answered-waiting")
        for (let sample = 0; sample < step.polls; sample++) {
          for (let player = 0; player < participants; player++) {
            const result = await poll(player, versions[player])
            requests[player]++
            bytes[player] += Buffer.byteLength(result.body)
            latencies.push(result.latencyMs)
            const payload = JSON.parse(result.body)
            if (payload.unchanged) unchangedBodies.push(result.body)
            else versions[player] = Number(payload.version)
          }
        }
      }

      const lockedTransactions = harness.queries.filter(sql => /FOR\s+UPDATE/i.test(sql)).length
      const report = {
        participants,
        requestsPerParticipant: Math.max(...requests),
        totalDatabaseQueries: harness.queries.length,
        lockedTransactions,
        bytesReturned: bytes.reduce((sum, value) => sum + value, 0),
        maxBytesPerParticipant: Math.max(...bytes),
        p95LatencyMs: Number(percentile95(latencies).toFixed(2)),
      }
      console.info("GAME_ROOM_TRAFFIC", JSON.stringify(report))

      expect(labelsSeen).toEqual(new Set(["lobby", "question", "answered-waiting", "reveal", "completion"]))
      expect(initialBodies.every(body => body.includes('"questionPool"'))).toBe(true)
      expect(unchangedBodies.length).toBeGreaterThan(0)
      expect(unchangedBodies.every(body => !body.includes("questionPool") && !body.includes("currentQuestion"))).toBe(true)
      expect(harness.queries.filter(sql => sql.includes("question_pool")).length).toBeLessThanOrEqual(participants * (QUESTION_COUNT * 3 + 2))
      expect(requests.every(count => count <= BUDGETS.maxRequestsPerParticipant)).toBe(true)
      expect(harness.queries.length).toBeLessThanOrEqual(participants * BUDGETS.maxQueriesPerParticipant)
      expect(lockedTransactions).toBeLessThanOrEqual(BUDGETS.maxLockedTransactionsPerMatch)
      expect(Math.max(...bytes)).toBeLessThanOrEqual(BUDGETS.maxBytesPerParticipant)
      expect(percentile95(latencies)).toBeLessThanOrEqual(BUDGETS.maxP95LatencyMs)
    })
  }

  it("keeps the client poll loop single-flight", () => {
    const client = readFileSync("components/game-mode-multiplayer.tsx", "utf8")
    expect(client).toContain("if (pollInFlightRef.current) return")
    expect(client).toContain("pollInFlightRef.current = true")
    expect(client).toContain("await poll()")
    expect(client).toContain("setTimeout(schedule, retryDelayRef.current)")
    expect(client).not.toMatch(/setInterval\(poll\s*,/)
  })
})
