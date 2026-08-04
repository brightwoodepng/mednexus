import { describe, expect, it } from "vitest"
import {
  PLAIN_TEXT_IMPORT_CHAR_LIMIT,
  plainTextImportFileType,
  readPlainTextImportFile,
} from "@/lib/plain-text-import"

describe("plain-text imports", () => {
  it("recognizes text and Markdown extensions case-insensitively", () => {
    expect(plainTextImportFileType("questions.txt")).toBe("txt")
    expect(plainTextImportFileType("Theory.MD")).toBe("md")
    expect(plainTextImportFileType("questions.csv")).toBeNull()
  })

  it("reads UTF-8 and removes a byte-order mark", async () => {
    const file = new File(["\uFEFFMODULE: Cardiology\nQUESTION: Explain shock."], "theory.md", { type: "text/markdown" })
    await expect(readPlainTextImportFile(file)).resolves.toBe("MODULE: Cardiology\nQUESTION: Explain shock.")
  })

  it("rejects empty, binary, invalid UTF-8, and oversized files", async () => {
    await expect(readPlainTextImportFile(new File([], "empty.txt"))).rejects.toThrow("empty")
    await expect(readPlainTextImportFile(new File([new Uint8Array([65, 0, 66])], "binary.txt"))).rejects.toThrow("binary data")
    await expect(readPlainTextImportFile(new File([new Uint8Array([0xc3, 0x28])], "invalid.txt"))).rejects.toThrow("valid UTF-8")
    await expect(readPlainTextImportFile(new File(["x".repeat(PLAIN_TEXT_IMPORT_CHAR_LIMIT + 1)], "large.txt"))).rejects.toThrow("200,000")
  })
})
