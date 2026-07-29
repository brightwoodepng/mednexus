import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const gameMode = readFileSync("components/game-mode.tsx", "utf8")

describe("solo game replay flow", () => {
  it("does not forward the button click event into solo game start functions", () => {
    expect(gameMode).not.toContain("onReplay={start}")
    expect(gameMode.match(/onReplay=\{\(\) => start\(\)\}/g)).toHaveLength(5)
  })

  it("keeps replay and setup changes as separate actions for every solo mode", () => {
    expect(gameMode.match(/onChangeSetup=/g)?.length).toBeGreaterThanOrEqual(5)
    expect(gameMode.match(/onReplay=/g)).toHaveLength(5)
  })
})
