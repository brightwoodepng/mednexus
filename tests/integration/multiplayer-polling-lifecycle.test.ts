import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const client = readFileSync("components/game-mode-multiplayer.tsx", "utf8")
const pollingEffect = client.slice(
  client.indexOf("  useEffect(() => {", client.indexOf("function GameRoomController")),
  client.indexOf("  // Reset the reaction-time clock", client.indexOf("function GameRoomController")),
)

describe("multiplayer polling lifecycle", () => {
  it("suspends polling while the document is hidden", () => {
    expect(pollingEffect).toContain('document.visibilityState !== "visible"')
    expect(pollingEffect).toMatch(/document\.visibilityState === "visible"\) \{\s*pollRef\.current = setTimeout/)
  })

  it("polls immediately when the document returns to the foreground", () => {
    expect(pollingEffect).toContain('document.addEventListener("visibilitychange", handleVisibilityChange)')
    expect(pollingEffect).toMatch(/if \(!pollInFlightRef\.current\) \{[\s\S]*?void schedule\(\)/)
  })

  it("terminates the loop after the room reaches the done phase", () => {
    expect(client).toContain('if (state.phase === "done")')
    expect(pollingEffect).toContain("!pollingCompleteRef.current")
  })

  it("cleans up timeout scheduling and its visibility listener", () => {
    expect(pollingEffect).toContain("clearTimeout(pollRef.current)")
    expect(pollingEffect).not.toContain("clearInterval(pollRef.current)")
    expect(pollingEffect).toContain('document.removeEventListener("visibilitychange", handleVisibilityChange)')
  })
})
