import { NextRequest, NextResponse } from "next/server"
import pool from "@/lib/db"
import { buildEconomyReport } from "@/lib/economy-report"
import { forbidden, requireAdminPermission, requireRegisteredUser, unauthorized } from "@/lib/request-auth"

export async function GET(req: NextRequest) {
  if (!await requireAdminPermission(req, "manage_system")) {
    return await requireRegisteredUser(req) ? forbidden() : unauthorized()
  }
  const days = Number(new URL(req.url).searchParams.get("days") ?? 30)
  const client = await pool.connect()
  try {
    return NextResponse.json(await buildEconomyReport(client, Number.isFinite(days) ? days : 30))
  } catch (error) {
    console.error("admin economy report", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  } finally {
    client.release()
  }
}
