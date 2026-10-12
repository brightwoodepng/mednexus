import type { Pool } from "pg"
import { CLASS_LEVELS } from "./levels"
import { auditAdmin } from "./platform-settings"

export function validPromotion(from: unknown, to: unknown, ids: unknown): ids is string[] {
  return typeof from === "string" && typeof to === "string"
    && CLASS_LEVELS.includes(from as typeof CLASS_LEVELS[number])
    && CLASS_LEVELS.includes(to as typeof CLASS_LEVELS[number]) && from !== to
    && Array.isArray(ids) && ids.length > 0 && ids.length <= 500
    && ids.every(id => typeof id === "string" && id.length > 0 && id.length <= 200)
    && new Set(ids).size === ids.length
}

export async function promoteStudents(pool: Pool, actorId: string, from: string, to: string, ids: string[]) {
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const result = await client.query(
      `SELECT uid, level, class_level, status, role FROM mednexus_registered_users
       WHERE uid = ANY($1::text[]) ORDER BY uid FOR UPDATE`, [ids],
    )
    if (result.rows.length !== ids.length || result.rows.some(user =>
      user.level !== from || user.status !== "approved" || !["STUDENT", "REGISTERED"].includes(user.role)
    )) {
      await client.query("ROLLBACK")
      return false
    }
    await client.query(
      `UPDATE mednexus_registered_users SET level=$1, class_level=$1 WHERE uid=ANY($2::text[])`, [to, ids],
    )
    for (const user of result.rows) {
      await auditAdmin(client, actorId, "bulk_promote", "user", user.uid, {
        previousLevel: user.level, previousClassLevel: user.class_level, level: to, batchSize: ids.length,
      })
    }
    await client.query("COMMIT")
    return true
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}
