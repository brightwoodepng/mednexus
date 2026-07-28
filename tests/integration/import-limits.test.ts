import { readFile } from "node:fs/promises"
import { describe, expect, it, vi } from "vitest"

vi.mock("@/lib/db", () => ({ default: { query: vi.fn() } }))
vi.mock("@/lib/admin-access", () => ({
  adminAccessDenied: vi.fn(),
  requireAdminRequest: vi.fn(),
}))
vi.mock("@/lib/request-auth", () => ({ authenticateRequest: vi.fn() }))

function image(index: number) {
  return {
    id: `IMAGE_${index}`,
    dataUri: "data:image/png;base64,aGVsbG8=",
  }
}

describe("large document import limits", () => {
  it("accepts 200,000 characters and 50 images at the requested boundaries", async () => {
    const {
      IMPORT_LIMITS,
      summarizeExtractedImport,
      validateExtractedImport,
    } = await import("@/lib/import-guard")
    const text = "x".repeat(200_000)
    const images = Array.from({ length: 50 }, (_, index) => image(index + 1))

    expect(IMPORT_LIMITS.textChars).toBe(200_000)
    expect(IMPORT_LIMITS.imageCount).toBe(50)
    expect(validateExtractedImport(text, images)).toBeNull()
    expect(summarizeExtractedImport(text, images)).toEqual({
      textChars: 200_000,
      imageCount: 50,
      limits: { textChars: 200_000, imageCount: 50 },
      withinLimits: true,
    })
  })

  it("reports the exact text or image count when a boundary is exceeded", async () => {
    const { validateExtractedImport } = await import("@/lib/import-guard")

    expect(validateExtractedImport("x".repeat(200_001), [])).toBe(
      "Document contains 200,001 characters; the limit is 200,000.",
    )
    expect(validateExtractedImport("valid", Array.from({ length: 51 }, (_, index) => image(index + 1)))).toBe(
      "Document contains 51 images; the limit is 50.",
    )
  })

  it("retains the existing file, decoded-image, response, and batch safeguards", async () => {
    const { IMPORT_LIMITS } = await import("@/lib/import-guard")

    expect(IMPORT_LIMITS.fileBytes).toBe(25 * 1024 * 1024)
    expect(IMPORT_LIMITS.imageBytes).toBe(8 * 1024 * 1024)
    expect(IMPORT_LIMITS.responseBytes).toBe(4 * 1024 * 1024)
    expect(IMPORT_LIMITS.chunkChars).toBe(24_000)
    expect(IMPORT_LIMITS.chunksPerImport).toBe(80)
  })

  it("shows the extraction summary before the staged questions are confirmed", async () => {
    const importer = await readFile(
      new URL("../../components/universal-importer.tsx", import.meta.url),
      "utf8",
    )

    expect(importer).toContain("Questions detected")
    expect(importer).toContain("Images detected")
    expect(importer).toContain("Processing batches")
    expect(importer).toContain("Within limits")
    expect(importer).toContain("<ImportSummaryPanel summary={importSummary} />")
  })
})
