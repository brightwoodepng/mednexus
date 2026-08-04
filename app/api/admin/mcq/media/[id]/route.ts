import { NextRequest, NextResponse } from "next/server"
import { adminAccessDenied, requireAdminRequest } from "@/lib/admin-access"
import { auditAdmin } from "@/lib/platform-settings"
import { deleteMcqMedia } from "@/lib/mcq-media-storage"
import { runtimePool } from "@/lib/runtime-db"

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await requireAdminRequest(req, "manage_mcq_content")
  if (!admin) return adminAccessDenied(req)
  const { id } = await params
  const pool = await runtimePool()
  const result = await pool.query("DELETE FROM mednexus_mcq_media_assets WHERE id=$1 RETURNING question_id,object_key", [id])
  if (!result.rowCount) return NextResponse.json({ error: "Media asset not found." }, { status: 404 })
  if (result.rows[0].object_key) {
    const shared = await pool.query("SELECT 1 FROM mednexus_mcq_media_assets WHERE object_key=$1 LIMIT 1", [result.rows[0].object_key])
    if (!shared.rowCount) await deleteMcqMedia(result.rows[0].object_key)
  }
  await auditAdmin(pool, admin.uid, "delete", "mcq_media", id, { questionId: result.rows[0]?.question_id })
  return NextResponse.json({ success: true })
}
