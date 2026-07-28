import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"
import { COSMETIC_RENDERER_REGISTRY } from "@/components/cosmetics/registry"

const cssPath = new URL("../../components/cosmetics/highlights/highlights.css", import.meta.url)
const leaderboardPath = new URL("../../components/leaderboard-screen.tsx", import.meta.url)
const multiplayerPath = new URL("../../components/game-mode-multiplayer.tsx", import.meta.url)

const highlightIds = [
  "highlight_monitor_sweep", "highlight_radiology_lightbox", "highlight_triage_priority",
  "highlight_prescription_label", "highlight_anatomy_plate", "highlight_blood_flow",
  "highlight_neural_field", "highlight_sterile_field",
]

describe("clinical highlight renderers", () => {
  it("registers all eight highlights as component renderers", () => {
    for (const id of highlightIds) {
      const presentation = COSMETIC_RENDERER_REGISTRY[id]
      expect(presentation.kind).toBe("highlight")
      expect(presentation.className).toContain("clinical-highlight")
      expect(presentation.Renderer.name).not.toBe("PresentationRenderer")
    }
  })

  it("keeps compact and reduced-motion treatments static and confines motion to an edge", async () => {
    const css = await readFile(cssPath, "utf8")
    expect(css).toContain('[data-cosmetic-size="compact"]')
    expect(css).toContain('@media (prefers-reduced-motion: reduce)')
    expect(css).toContain('[data-motion-state="reduced"]')
    expect(css).toContain("clinical-highlight__signal")
    expect(css).not.toContain("color: transparent")
  })

  it("composes effects around leaderboard conflict states instead of looking up row classes", async () => {
    const [leaderboard, multiplayer] = await Promise.all([
      readFile(leaderboardPath, "utf8"), readFile(multiplayerPath, "utf8"),
    ])
    expect(leaderboard).toContain('<CosmeticHighlight as="button"')
    expect(leaderboard).toContain("playerRank={entry.rank}")
    expect(leaderboard).toContain("accuracySuppressed")
    expect(leaderboard).toContain("equippedFrame")
    expect(multiplayer).toContain("isWinner || isMe || isBankrupt ? null : p.equippedHighlight")
    expect(multiplayer).not.toContain("const rowClass")
  })
})
