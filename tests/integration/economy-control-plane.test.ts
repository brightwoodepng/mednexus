import {readFile} from "node:fs/promises"
import {describe,expect,it} from "vitest"

describe("economy control plane",()=>{
  it("installs immutable config, reward history, and NP gift schema only through migrations",async()=>{
    const [migration,db,route]=await Promise.all([readFile("migrations/2026-09-07-economy-control-plane.sql","utf8"),readFile("lib/db.ts","utf8"),readFile("app/api/admin/economy-seasons/route.ts","utf8")])
    for(const table of ["mednexus_economy_config_revisions","mednexus_economy_reward_runs","mednexus_economy_reward_recipients","mednexus_economy_gifts"]){expect(migration).toContain(table);expect(db).toContain(table);expect(route).not.toContain(`CREATE TABLE IF NOT EXISTS ${table}`)}
    expect(migration).toContain("mednexus_one_active_economy_config")
    expect(migration).toContain("UNIQUE (season_id, reward_type, period_key)")
  })
  it("versions runtime NP and XP transactions",async()=>{
    const [runtime,np,xp]=await Promise.all([readFile("lib/economy-runtime-config.ts","utf8"),readFile("lib/np-ledger.ts","utf8"),readFile("lib/xp-ledger.ts","utf8")])
    expect(runtime).toContain("getActiveEconomyConfig")
    expect(np).toContain("config_version")
    expect(xp).toContain("config_version")
  })
  it("removes weekly rounds from new progress and payouts",async()=>{
    const files=await Promise.all(["components/economy-panel.tsx","contexts/economy-context.tsx","app/api/economy/payout/route.ts","app/api/game-rooms/[pin]/score/route.ts","app/api/group-study/[pin]/route.ts"].map(file=>readFile(file,"utf8")))
    for(const source of files){expect(source).not.toContain("recordWeeklyGoalActivity");expect(source).not.toContain("Weekly rounds")}
  })
})
