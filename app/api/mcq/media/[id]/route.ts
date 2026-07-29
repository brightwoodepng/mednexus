import { NextResponse } from "next/server"
import { deliveryMcqMediaUrl, IMMUTABLE_CACHE_CONTROL } from "@/lib/mcq-media-storage"

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { default: pool, ensureSchema } = await import("@/lib/db")
  await ensureSchema()
  const result = await pool.query("SELECT object_key FROM mednexus_mcq_media_assets WHERE id=$1", [id])
  if (!result.rows[0]) return NextResponse.json({ error: "Media not found." }, { status: 404 })
  if (!result.rows[0].object_key) return NextResponse.json({ error: "Media migration is pending." }, { status: 503 })
  return NextResponse.redirect(await deliveryMcqMediaUrl(result.rows[0].object_key), { status: 307, headers: { "cache-control": IMMUTABLE_CACHE_CONTROL, "x-content-type-options": "nosniff" } })
}
