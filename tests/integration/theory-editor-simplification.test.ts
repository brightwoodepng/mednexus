import { readFileSync } from "node:fs"
import { describe, expect, it } from "vitest"

const admin = readFileSync("components/theory-admin-simplified.tsx", "utf8")
const route = readFileSync("app/api/admin/theory/route.ts", "utf8")
const learner = readFileSync("components/theory-vault.tsx", "utf8")
const schema = readFileSync("migrations/2026-08-28-theory-editor-trash.sql", "utf8")

describe("simplified Theory editor", () => {
  it("uses module-first folders and visible question actions", () => {
    for (const label of ["Questions", "Edit", "Preview", "Move", "Publish", "Trash"]) expect(admin).toContain(label)
    expect(admin).toContain("Use next available set automatically")
    expect(admin).toContain("Import history")
  })

  it("publishes prompt-only questions but still requires an assigned set", () => {
    expect(route).toContain('if (status === "published" && !setId)')
    expect(route).toContain("AND deleted_at IS NULL AND set_id IS NOT NULL AND trim(prompt)<>''")
    expect(route).not.toContain("A set, model answer, and key marking points are required before publishing")
  })

  it("supports reversible hierarchy trash and deliberate permanent deletion", () => {
    for (const column of ["deleted_at", "deleted_by", "previous_status"]) expect(schema).toContain(column)
    for (const action of ['action === "trash"', 'action === "restore"', 'action === "purge"', 'action === "empty_trash"']) expect(route).toContain(action)
  })

  it("keeps prompt-only practice available without answer review or self-marking", () => {
    expect(learner).toContain("Model answer coming soon")
    expect(learner).toContain("You cannot self-mark this response yet")
    expect(learner).toContain("disabled={!question.hasAnswer}")
  })
})
