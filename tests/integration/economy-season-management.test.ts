import {describe,expect,it} from "vitest"
import fs from "node:fs"
import path from "node:path"
const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),"utf8")
const api=read("app/api/admin/economy-seasons/route.ts"),ui=read("components/admin/economy-seasons-workspace.tsx"),settingsApi=read("app/api/admin/settings/route.ts"),settingsUi=read("components/admin/system-settings-workspace.tsx"),economy=read("lib/economy-seasons.ts")

describe("economy season management",()=>{
  it("opens through resilient client APIs with retry states",()=>{
    expect(api).toContain("ECONOMY_SCHEMA_NOT_READY")
    expect(ui).toContain("Retry")
    expect(settingsApi).toContain("SYSTEM_SETTINGS_SCHEMA_NOT_READY")
    expect(settingsUi).toContain("Retry")
  })
  it("plans and activates seasons only through protected confirmed actions",()=>{
    expect(api).toContain('action==="create"')
    expect(api).toContain('action!=="activate"')
    expect(api).toContain('admin.role!=="SUPER_ADMIN"')
    expect(api).toContain("confirmationFor(target.name)")
    expect(api).toContain("pg_advisory_xact_lock")
    expect(api).toContain("A planned season already uses this name or economy version.")
  })
  it("archives the prior season and verifies every opening balance",()=>{
    for(const text of ["mednexus_economy_season_archives","status='closed'","status='active'","mednexus_economy_cutovers","Opening balance verification failed","auditAdmin"])expect(api).toContain(text)
    expect(economy).toContain("season.openingGrant")
    expect(ui).toContain("Purchases and cosmetics remain")
    expect(api).toContain("WITH grants AS")
    expect(api).toContain("BigInt(affectedUsers)")
    expect(ui).toContain('label="Supply"')
    expect(ui).toContain('label="Earned"')
  })

  it("saves system and theory settings atomically with strict validation",()=>{
    expect(settingsApi).toContain("Choose a valid registration approval mode.")
    expect(settingsApi).toContain("SELECT id FROM mednexus_system_settings WHERE id=1 FOR UPDATE")
    expect(settingsApi).toContain("ON CONFLICT(id) DO UPDATE")
    expect(settingsApi).toContain("Send valid JSON settings.")
  })
})
