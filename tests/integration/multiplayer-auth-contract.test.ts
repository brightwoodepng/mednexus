import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"

const client = readFileSync("components/game-mode-multiplayer.tsx", "utf8")
const createRoute = readFileSync("app/api/game-rooms/route.ts", "utf8")
const roomRoute = readFileSync("app/api/game-rooms/[pin]/route.ts", "utf8")
const scoreRoute = readFileSync("app/api/game-rooms/[pin]/score/route.ts", "utf8")

describe("multiplayer authentication contract", () => {
  it("uses the shared transport for every room operation", () => {
    expect(client).not.toContain("getOrCreatePlayerId")
    for (const method of ['method: "POST"', 'method: "PATCH"', 'method: "DELETE"']) expect(client).toContain(method)
    expect(client.match(/multiplayerApi/g)?.length).toBeGreaterThanOrEqual(5)
  })

  it("derives room identities asynchronously from authentication", () => {
    expect(createRoute).toContain("await requireAuthenticatedUser(req)")
    expect(createRoute).toContain("id: auth.uid")
    expect(createRoute).toContain("host_id, host_name")
    expect(roomRoute).toContain("body.playerId = auth.uid")
    expect(roomRoute).toContain("body.requesterId = auth.uid")
    expect(scoreRoute).toContain("const playerId = auth.uid")
    expect(`${createRoute}${roomRoute}`).not.toContain("authenticateRequest(")
  })

  it("accepts IDs only and snapshots the authoritative eligible bank", () => {
    expect(createRoute).toContain("questionIds")
    expect(createRoute).not.toContain("questionPool: Question[]")
    expect(createRoute).toContain("getQuestionBankStatus")
    expect(createRoute).toContain("isSupportedSoloQuestion")
    expect(createRoute).toContain("createQuestionContentFingerprint")
    expect(createRoute).toContain("body.questionIds.length > 200")
  })
})
