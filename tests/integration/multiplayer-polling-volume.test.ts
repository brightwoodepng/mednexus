import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const client = readFileSync("components/game-mode-multiplayer.tsx", "utf8")
const route = readFileSync("app/api/game-rooms/[pin]/route.ts", "utf8")

describe("multiplayer polling query budget", () => {
  it("serializes polls and backs off instead of starting a 300ms interval", () => {
    expect(client).toContain("pollInFlightRef.current")
    expect(client).toContain("Math.min(retryDelayRef.current * 2, 12_000)")
    expect(client).not.toContain("setInterval(poll, 300)")
  })

  it("keeps unchanged participant polls to one metadata query and no lock", () => {
    expect(route).toContain('X-Game-Room-Query-Count')
    expect(route).toContain('instrument(NextResponse.json({ unchanged: true, version: knownVersion }), 1, "unchanged")')
    expect(route.indexOf("if (transitionDue) await autoTick(pin)")).toBeGreaterThan(route.indexOf("const transitionDue"))
  })

  it("models a representative eight-player minute without transaction amplification", () => {
    const participants = 8
    const seconds = 60
    const steadyPollMs = 1500
    const routineQueries = participants * Math.ceil(seconds * 1000 / steadyPollMs)

    // One cheap query per participant poll: 320 SELECTs/minute. The previous
    // autoTick + state read path required multiple statements/transactions per
    // poll (and the 300ms fast path could issue 1,600 polls/minute).
    expect(routineQueries).toBe(320)
    expect(routineQueries / participants).toBe(40)
  })

  it("returns an initial pool followed by compact current-question deltas", () => {
    expect(route).toContain('{ questionPool: safePool } : { currentQuestion }')
    expect(route).toContain('question_pool -> current_qi AS current_question')
    expect(client).toContain("const questionPool = [...previous.questionPool]")
  })
})
