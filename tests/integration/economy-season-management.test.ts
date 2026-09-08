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
  it("manages versioned reward rules and audited NP gifts by learner index number",()=>{
    for(const action of ['action==="update_rules"','action==="gift_np"','action==="validate_gifts"','action==="activate_config"'])expect(api).toContain(action)
    expect(api).toContain("applyNPCredits")
    expect(api).toContain("LOWER(r.index_number)=ANY($1::text[])")
    expect(api).toContain('source:"admin_gift"')
    expect(api).not.toContain('action==="finalize_week"')
    expect(api).not.toContain("applyXPCredits")
    expect(api).not.toContain("ensureNotificationSchema")
    for(const label of ["Finalize month","NP & XP Rules","Gift NP","Search by learner name or index number","Bulk gift list","Review gift","lifetime XP remain"])expect(ui).toContain(label)
    expect(api).toContain("learners:learners.rows")
    expect(api).toContain("WHERE u.status='approved'")
    expect(api).not.toContain("u.role='STUDENT'")
    expect(api).not.toContain("ORDER BY u.name,u.index_number LIMIT")
    expect(ui).not.toContain("learners.slice")
    expect(ui).not.toContain("Correct the JSON")
    expect(ui).not.toContain("Weekly rounds")
    expect(ui).not.toMatch(/\bNT\b/)
    expect(api).not.toMatch(/\bNT\b/)
    expect(ui).not.toContain("Audited learner correction")
  })
  it("archives the prior season and verifies every opening balance",()=>{
    for(const text of ["mednexus_economy_season_archives","status='closed'","status='active'","mednexus_economy_cutovers","Opening balance verification failed","auditAdmin"])expect(api).toContain(text)
    expect(economy).toContain("season.openingGrant")
    expect(ui).toContain("NP, purchases, cosmetics, and lifetime XP remain")
    expect(api).toContain("WITH grants AS")
    expect(api).toContain("BigInt(affectedUsers)")
    expect(ui).toContain('label="NP supply"')
    expect(ui).toContain('label="NP awarded"')
  })

  it("saves system and theory settings atomically with strict validation",()=>{
    expect(settingsApi).toContain("Choose a valid registration approval mode.")
    expect(settingsApi).toContain("SELECT id FROM mednexus_system_settings WHERE id=1 FOR UPDATE")
    expect(settingsApi).toContain("ON CONFLICT(id) DO UPDATE")
    expect(settingsApi).toContain("Send valid JSON settings.")
  })
})
