import { NextResponse } from "next/server"
import { getPlatformSettings } from "@/lib/platform-settings"

export async function GET() {
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    const settings = await getPlatformSettings(pool)
    return NextResponse.json({
      registrationEnabled: settings.registrationEnabled,
      guestAccessEnabled: settings.guestAccessEnabled,
      maintenanceEnabled: settings.maintenanceEnabled,
      maintenanceMessage: settings.maintenanceMessage,
    })
  } catch {
    return NextResponse.json({
      registrationEnabled: true,
      guestAccessEnabled: true,
      maintenanceEnabled: false,
      maintenanceMessage: "",
    })
  }
}
