import { NextRequest, NextResponse } from "next/server"
import { createAdminToken, verifyAdminToken } from "@/lib/admin-auth"

// POST /api/admin/auth  — { password } → { token }
export async function POST(req: NextRequest) {
  try {
    const { password } = await req.json()
    if (!password) return NextResponse.json({ error: "Password required" }, { status: 400 })

    const adminPassword = process.env.ADMIN_PASSWORD
    if (!adminPassword) {
      return NextResponse.json({ error: "Admin not configured" }, { status: 503 })
    }

    if (password !== adminPassword) {
      return NextResponse.json({ error: "Invalid password" }, { status: 401 })
    }

    const token = createAdminToken(password)
    return NextResponse.json({ token })
  } catch (err) {
    console.error("[admin/auth POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

// GET /api/admin/auth  — verify token in header
export async function GET(req: NextRequest) {
  const token = req.headers.get("x-admin-token") ?? ""
  const valid = verifyAdminToken(token)
  return NextResponse.json({ valid })
}
