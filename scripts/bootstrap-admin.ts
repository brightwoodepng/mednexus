/** Deployment-only, audited bootstrap: pnpm admin:bootstrap --index-number=sm/sms/22/0001 */
import pool, { ensureSchema } from "../lib/db"

function normalizeIndexNumber(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
    .replace(/^sm(sms|gem)(\d{2})(\d{4})$/, "sm/$1/$2/$3")
}

async function main() {
  const argument = process.argv.find((value) => value.startsWith("--index-number="))
  const indexNumber = argument?.slice("--index-number=".length)
  if (!indexNumber) throw new Error("Usage: pnpm admin:bootstrap --index-number=sm/sms/22/0001")
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const account = await client.query(
      "SELECT uid, index_number, role FROM mednexus_registered_users WHERE index_number = $1 FOR UPDATE",
      [normalizeIndexNumber(indexNumber)],
    )
    if (!account.rowCount) throw new Error("Bootstrap failed: no registered account matched that index number; no role was granted.")
    const target = account.rows[0]
    if (target.role !== "SUPER_ADMIN") {
      await client.query("UPDATE mednexus_registered_users SET role = 'SUPER_ADMIN' WHERE uid = $1", [target.uid])
      await client.query(
        `INSERT INTO mednexus_role_audit_log (actor_uid, target_uid, change_type, old_value, new_value)
         VALUES (NULL, $1, 'ROLE_BOOTSTRAP', $2, 'SUPER_ADMIN')`, [target.uid, target.role],
      )
    }
    await client.query("COMMIT")
    console.log(`Bootstrap success: existing account ${target.index_number} is SUPER_ADMIN${target.role === "SUPER_ADMIN" ? " (already assigned)" : ""}.`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1 })
