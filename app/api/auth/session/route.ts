import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifySessionToken } from "@/lib/session-auth"

type ServerRole = "STUDENT" | "ADMIN" | "SUPER_ADMIN"

function normalizeRole(role: unknown): ServerRole {
  return role === "ADMIN" || role === "SUPER_ADMIN" ? role : "STUDENT"
}

/**
 * Returns the current registered account from the HttpOnly session cookie.
 * The role is presentation metadata only; protected routes must continue to
 * authorize through lib/admin-access.ts.
 */
export async function GET() {
  const token = (await cookies()).get("mednexus_session")?.value
  const session = verifySessionToken(token ?? "")

  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  try {
    const { default: pool } = await import("@/lib/db")
    const result = await pool.query(
      `SELECT uid, name, status, class_level, level, role
       FROM mednexus_registered_users WHERE uid = $1`,
      [session.uid],
    )
    const account = result.rows[0]
    if (!account) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    return NextResponse.json({
      uid: account.uid,
      name: account.name,
      status: account.status,
      classLevel: account.class_level || account.level || "",
      role: normalizeRole(account.role),
    })
  } catch (error) {
    console.error("[auth/session]", error)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
