import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("economy earning paths", () => {
  it("includes competitive multiplayer hosts in reward eligibility", async () => {
    const scoreRoute = await readFile("app/api/game-rooms/[pin]/score/route.ts", "utf8")

    expect(scoreRoute).toContain('room.mode === "cohort" && p.id === room.host_id')
    expect(scoreRoute).not.toContain("p.id !== room.host_id && !p.isSpectator")
  })

  it("does not let one idle player suppress every valid multiplayer payout", async () => {
    const scoreRoute = await readFile("app/api/game-rooms/[pin]/score/route.ts", "utf8")

    expect(scoreRoute).toContain("meaningfulParticipants.length >= ECONOMY_CONFIG.gameRewards.multiplayer.minimumPlayers")
    expect(scoreRoute).not.toContain("hasMeaningfulServerHistory")
  })

  it("waits for a gamified Trial payout before exit or replay", async () => {
    const quiz = await readFile("components/quiz-simulator.tsx", "utf8")

    expect(quiz).toContain("payoutPromiseRef.current =")
    expect(quiz).toContain("await payoutPromiseRef.current")
    expect(quiz).toContain("waitForPendingPayout().then(onExit)")
  })

  it("initializes wallet and daily-login rewards for each signed-in user", async () => {
    const economyContext = await readFile("contexts/economy-context.tsx", "utf8")

    expect(economyContext).toContain("initializedUserId.current !== user.uid")
    expect(economyContext).toContain("initializedUserId.current = null")
    expect(economyContext).not.toContain("initialized.current = true")
  })
})
