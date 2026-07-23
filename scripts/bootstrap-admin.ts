/** Explicit, audited bootstrap: pnpm tsx scripts/bootstrap-admin.ts <index-number> <ADMIN|SUPER_ADMIN> */
import pool, { ensureSchema } from "../lib/db"
async function main() {
  const [indexNumber, role] = process.argv.slice(2)
  if (!indexNumber || !["ADMIN", "SUPER_ADMIN"].includes(role)) throw new Error("Usage: bootstrap-admin <index-number> <ADMIN|SUPER_ADMIN>")
  await ensureSchema()
  const result = await pool.query("UPDATE mednexus_registered_users SET role = $1 WHERE index_number = $2 RETURNING uid, index_number, role", [role, indexNumber.toLowerCase()])
  if (!result.rowCount) throw new Error("No registered user found; no role was granted.")
  console.log("Administrator role assigned:", result.rows[0])
}
main().catch(error => { console.error(error); process.exitCode = 1 })
