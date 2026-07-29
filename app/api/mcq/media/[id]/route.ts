import { NextResponse } from "next/server"
import { deliveryMcqMediaUrl, IMMUTABLE_CACHE_CONTROL } from "@/lib/mcq-media-storage"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  // Deployments can serve traffic while the explicit object-storage backfill is
  // still running. Keep legacy BYTEA assets readable until that migration has
  // verified every object and removed the data column.
  const legacyColumn = await pool.query(
    "SELECT 1 FROM information_schema.columns WHERE table_name='mednexus_mcq_media_assets' AND column_name='data'",
  )
  const projection = legacyColumn.rowCount ? "object_key,mime_type,data" : "object_key,mime_type"
  const result = await pool.query(`SELECT ${projection} FROM mednexus_mcq_media_assets WHERE id=$1`, [id])
  if (!result.rows[0]) return NextResponse.json({ error: "Media not found." }, { status: 404 })
  if (result.rows[0].object_key) {
    return NextResponse.redirect(await deliveryMcqMediaUrl(result.rows[0].object_key), { status: 307, headers: { "cache-control": IMMUTABLE_CACHE_CONTROL, "x-content-type-options": "nosniff" } })
  }
  if (result.rows[0].data) {
    return new Response(result.rows[0].data, { headers: { "content-type": result.rows[0].mime_type, "cache-control": IMMUTABLE_CACHE_CONTROL, "x-content-type-options": "nosniff" } })
  }
  return NextResponse.json({ error: "Media migration is incomplete." }, { status: 503 })
}
