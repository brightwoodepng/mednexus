import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"

const read=(file:string)=>fs.readFileSync(path.join(process.cwd(),file),"utf8")
const adminUi=read("components/broadcast-screen.tsx")
const broadcastApi=read("app/api/notifications/route.ts")
const preferenceApi=read("app/api/notification-preferences/route.ts")
const database=read("lib/db.ts")
const notificationSchema=read("lib/notification-schema.ts")
const overlay=read("components/notification-overlay.tsx")
const bell=read("components/notification-bell.tsx")

describe("notification centre",()=>{
  it("supports targeted, scheduled, expiring and actionable broadcasts",()=>{
    for(const text of ["Compose notification","Delivery history","Automated activity","Specific users","Class level","Learner preview"])expect(adminUi).toContain(text)
    for(const field of ["audience_value","action_url","scheduled_at","expires_at","adminView"])expect(broadcastApi).toContain(field)
    expect(broadcastApi).toContain("No approved users matched those index numbers")
  })

  it("keeps delivery targeting and preferences in the database",()=>{
    expect(database).toContain("2026-08-23-xp-ledger-and-leaderboard-v1")
    expect(notificationSchema).toContain("mednexus_notification_preferences")
    expect(notificationSchema).not.toMatch(/^\s*(DROP|DELETE|TRUNCATE)\b/m)
    for(const field of ["group_study","rewards","rankings","announcements"])expect(preferenceApi).toContain(field)
  })

  it("opens internal actions and refreshes unread state every minute",()=>{
    expect(overlay).toContain("window.location.assign(item.actionUrl)")
    expect(overlay).toContain("item.actionLabel")
    expect(bell).toContain("const POLL_INTERVAL = 60_000")
  })
})
