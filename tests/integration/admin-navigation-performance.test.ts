import { readFile } from "node:fs/promises"
import { describe, expect, it } from "vitest"

describe("admin navigation performance", () => {
  it("deduplicates access lookups and provides immediate route feedback", async () => {
    const [access, shell, loading] = await Promise.all([
      readFile(new URL("../../lib/admin-access.ts", import.meta.url), "utf8"),
      readFile(new URL("../../components/admin-shell.tsx", import.meta.url), "utf8"),
      readFile(new URL("../../app/admin/loading.tsx", import.meta.url), "utf8"),
    ])
    expect(access).toContain('import { cache } from "react"')
    expect(access).toContain("const currentAccessForUser = cache(")
    expect(shell).toContain("prefetch")
    expect(loading).toContain("Opening workspace")
  })
})
