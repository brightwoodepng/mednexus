import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { CLASS_LEVELS } from "@/lib/levels"
import { promoteStudents, validPromotion } from "@/lib/bulk-promotion"

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_users")
  if (!admin) return await adminAccessDenied(req)
  const level = req.nextUrl.searchParams.get("level") ?? "Level 400"
  if (!CLASS_LEVELS.includes(level as typeof CLASS_LEVELS[number])) return NextResponse.json({ error: "Invalid level." }, { status: 400 })
  const rawPage = Number(req.nextUrl.searchParams.get("page") ?? 1)
  const page = Number.isInteger(rawPage) && rawPage > 0 ? Math.min(rawPage, 100000) : 1
  const search = (req.nextUrl.searchParams.get("search") ?? "").slice(0, 200)
  try {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query(
      `SELECT uid, name, index_number, level, COUNT(*) OVER()::int AS total
       FROM mednexus_registered_users WHERE level=$1 AND status='approved'
       AND role IN ('STUDENT','REGISTERED') AND (name ILIKE $2 OR index_number ILIKE $2)
       ORDER BY name, uid LIMIT 50 OFFSET $3`, [level, `%${search}%`, (page - 1) * 50],
    )
    return NextResponse.json({ users: result.rows, total: result.rows[0]?.total ?? 0 })
  } catch (error) {
    console.error("[admin promotion candidates]", error)
    return NextResponse.json({ error: "Unable to load students." }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminRequest(req, "manage_users")
  if (!admin) return await adminAccessDenied(req)
  const body = await req.json().catch(() => null)
  if (!body || !validPromotion(body.from, body.to, body.ids)) return NextResponse.json({ error: "Choose different valid levels and 1–500 unique students." }, { status: 400 })
  try {
    const { default: pool } = await import("@/lib/db")
    if (!await promoteStudents(pool, admin.uid, body.from, body.to, body.ids)) {
      return NextResponse.json({ error: "A selected student has changed or is no longer eligible. Refresh and review your selection again." }, { status: 409 })
    }
    return NextResponse.json({ promoted: body.ids.length })
  } catch (error) {
    console.error("[admin bulk promotion]", error)
    return NextResponse.json({ error: "Promotion failed. No changes were saved." }, { status: 500 })
  }
}
