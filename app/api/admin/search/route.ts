import { NextRequest, NextResponse } from "next/server"
import { ADMIN_PERMISSIONS, adminAccessDenied, requireAdminRequest, type AdminPermission } from "@/lib/admin-access"

type SearchResult = { type: string; id: string; title: string; subtitle: string; href: string }

export async function GET(req: NextRequest) {
  const admin = await requireAdminRequest(req)
  if (!admin) return adminAccessDenied(req)
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim()
  const page = Math.max(1, Number(req.nextUrl.searchParams.get("page")) || 1)
  if (q.length < 2) return NextResponse.json({ results: [], page, hasMore: false })

  const permissionEntries = await Promise.all(ADMIN_PERMISSIONS.map(async (permission) =>
    [permission, Boolean(await requireAdminRequest(req, permission))] as const))
  const permissions = new Map<AdminPermission, boolean>(permissionEntries)
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const term = `%${q}%`
  const results: SearchResult[] = []

  if (permissions.get("manage_mcq_content")) {
    const rows = await pool.query(`
      SELECT item->>'id' AS id,
        COALESCE(NULLIF(item->>'vignette',''), 'MCQ question') AS title,
        CONCAT_WS(' · ', NULLIF(item->>'module',''), NULLIF(item->>'subject','')) AS subtitle
      FROM mednexus_questions, LATERAL jsonb_array_elements(data) item
      WHERE CONCAT_WS(' ',item->>'vignette',item->>'module',item->>'subject') ILIKE $1
      LIMIT 12`, [term])
    results.push(...rows.rows.map((row) => ({ type: "MCQ", id: row.id, title: row.title, subtitle: row.subtitle, href: `/admin/mcq?question=${encodeURIComponent(row.id)}` })))
  }
  if (permissions.get("manage_theory_content")) {
    const rows = await pool.query(`
      SELECT q.id, COALESCE(NULLIF(q.title,''),LEFT(q.prompt,100)) AS title,
        CONCAT_WS(' · ', c.title, COALESCE(m.name,d.name), s.name) AS subtitle
      FROM mednexus_theory_questions q
      JOIN mednexus_theory_collections c ON c.id=q.collection_id
      LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
      LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
      LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
      WHERE CONCAT_WS(' ',q.title,q.prompt,q.model_answer,c.title,m.name,d.name,s.name) ILIKE $1
      ORDER BY q.updated_at DESC LIMIT 12`, [term])
    results.push(...rows.rows.map((row) => ({ type: "Theory", id: row.id, title: row.title, subtitle: row.subtitle, href: `/admin/theory?question=${encodeURIComponent(row.id)}` })))
  }
  if (permissions.get("manage_users")) {
    const rows = await pool.query(`SELECT uid AS id,name AS title,CONCAT_WS(' · ',index_number,status) AS subtitle FROM mednexus_registered_users WHERE name ILIKE $1 OR index_number ILIKE $1 ORDER BY name LIMIT 10`, [term])
    results.push(...rows.rows.map((row) => ({ type: "User", id: row.id, title: row.title, subtitle: row.subtitle, href: `/admin/users?user=${encodeURIComponent(row.id)}` })))
  }
  if (permissions.get("manage_assessments")) {
    const rows = await pool.query(`SELECT id,title,CONCAT_WS(' · ',module_name,status) AS subtitle FROM mednexus_assessments WHERE title ILIKE $1 OR module_name ILIKE $1 ORDER BY created_at DESC LIMIT 10`, [term])
    results.push(...rows.rows.map((row) => ({ type: "Assessment", id: row.id, title: row.title, subtitle: row.subtitle, href: `/admin/assessments?id=${encodeURIComponent(row.id)}` })))
  }

  const pageSize = 20
  const offset = (page - 1) * pageSize
  return NextResponse.json({ results: results.slice(offset, offset + pageSize), page, hasMore: results.length > offset + pageSize })
}
