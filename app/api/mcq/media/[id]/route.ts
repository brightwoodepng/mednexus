import { NextResponse } from "next/server"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const result = await pool.query("SELECT mime_type,data FROM mednexus_mcq_media_assets WHERE id=$1", [id])
  if (!result.rows[0]) return NextResponse.json({ error: "Media not found." }, { status: 404 })
  return new Response(result.rows[0].data, { headers: { "content-type": result.rows[0].mime_type, "cache-control": "public, max-age=31536000, immutable", "x-content-type-options": "nosniff" } })
}
