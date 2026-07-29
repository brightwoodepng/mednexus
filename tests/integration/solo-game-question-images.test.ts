import { readFile } from "node:fs/promises"
import path from "node:path"
import { describe, expect, it } from "vitest"

describe("solo game question media", () => {
  it("renders legacy, stem, and option images in Game Mode", async () => {
    const source = await readFile(path.join(process.cwd(), "components/game-mode.tsx"), "utf8")

    expect(source).toContain("legacyImage={question.mediaBase64}")
    expect(source).toContain('item.placement === "stem"')
    expect(source).toContain('item.placement === "option" && item.optionId === opt.id')
    expect(source).toContain("...(opt.media ?? [])")
    expect(source).toContain('data-testid="game-question-media"')
  })

  it("deduplicates media URLs before rendering", async () => {
    const source = await readFile(path.join(process.cwd(), "components/game-mode.tsx"), "utf8")

    expect(source).toContain("all.findIndex(candidate => candidate.url === item.url) === index")
  })
})
