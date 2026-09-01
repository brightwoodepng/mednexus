import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),"utf8")
const settings=read("components/admin/system-settings-workspace.tsx")
const settingsApi=read("app/api/admin/settings/route.ts")
const source=read("components/question-bank-source-manager.tsx")
const sourceApi=read("app/api/admin/question-bank/route.ts")
const taxonomyApi=read("app/api/admin/taxonomy/route.ts")
const database=read("lib/db.ts")

describe("admin platform controls",()=>{
  it("stages and validates settings with health and audit feedback",()=>{
    for(const text of ["Unsaved changes","Reset to current","Review these settings","System status","Recent activity"])expect(settings).toContain(text)
    expect(settingsApi).toContain("mednexus_admin_audit_log")
    expect(settingsApi).toContain('database: "operational"')
    expect(settingsApi).toContain("body.confirm !== true")
  })

  it("presents source diagnostics separately from normal MCQ management",()=>{
    for(const text of ["Active source","Records served","Manage MCQs","Recent source audit","Advanced recovery actions"])expect(source).toContain(text)
    expect(source).toContain('<details className=')
    expect(source).toContain('href="/admin/mcq"')
  })

  it("retains protected backups, typed confirmation, audit, and invalidation",()=>{
    expect(sourceApi).toContain('admin.role !== "SUPER_ADMIN"')
    expect(sourceApi).toContain("mednexus_question_bank_audit_log")
    expect(sourceApi).toContain("body.confirmation !== confirmation")
    expect(sourceApi).toContain("invalidated: true")
    expect(sourceApi).toContain("backup")
  })

  it("migrates admin platform tables and binds taxonomy actions safely",()=>{
    expect(database).toContain('CURRENT_SCHEMA_VERSION = "2026-08-28-theory-editor-trash-v1"')
    expect(taxonomyApi).toContain('const updateParameters = action === "move_discipline"')
    expect(taxonomyApi).toContain(': [body.module, discipline, body.newName?.trim() ?? null]')
    expect(taxonomyApi).toContain("Modules and disciplines are temporarily unavailable")
  })
})
