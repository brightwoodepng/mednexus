import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("expired guest logout", () => {
  it("validates guest credentials against the live expiry row", async () => {
    const route = await readFile("app/api/auth/guest/route.ts", "utf8")
    expect(route).toContain("export async function GET")
    expect(route).toContain("requireAuthenticatedUser(req)")
    expect(route).toContain("expires_at > NOW()")
    expect(route).toContain("if (!auth?.isGuest) return unauthorized()")
  })

  it("does not restore an expired or deleted guest workspace", async () => {
    const context = await readFile("contexts/app-context.tsx", "utf8")
    expect(context).toContain("guestTokenExpiry")
    expect(context).toContain("validateGuestSession(guestToken)")
    expect(context).toContain('validation.state === "expired"')
    expect(context).toContain("clearExpiredGuestStorage(uid)")
    expect(context).toContain("setUser(null)")
  })

  it("logs an active guest out at expiry and rechecks on focus or reconnect", async () => {
    const context = await readFile("contexts/app-context.tsx", "utf8")
    expect(context).toContain("window.setTimeout(expireGuest")
    expect(context).toContain('window.addEventListener("online", verifyLiveGuest)')
    expect(context).toContain('window.addEventListener("focus", verifyLiveGuest)')
    expect(context).toContain("5 * 60_000")
  })
})
