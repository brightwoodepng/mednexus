import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const mediaRoute = readFileSync("app/api/mcq/media/[id]/route.ts", "utf8")

describe("MCQ media migration compatibility", () => {
  it("continues serving legacy database images during the object-storage backfill", () => {
    expect(mediaRoute).toContain("information_schema.columns")
    expect(mediaRoute).toContain('column_name=\'data\'')
    expect(mediaRoute).toContain("result.rows[0].data")
    expect(mediaRoute).toContain('"content-type": result.rows[0].mime_type')
  })

  it("redirects migrated images to object storage", () => {
    expect(mediaRoute).toContain("deliveryMcqMediaUrl(result.rows[0].object_key)")
    expect(mediaRoute).toContain("NextResponse.redirect")
  })
})
