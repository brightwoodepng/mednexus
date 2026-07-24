/** Deployment-only, audited bootstrap: pnpm admin:bootstrap --index-number=sm/sms/24/0123 */
import pool, { ensureSchema } from "../lib/db"
import { bootstrapAdmin } from "../lib/bootstrap-admin"

async function main() {
  const argument = process.argv.find((value) => value.startsWith("--index-number="))
  const indexNumber = argument?.slice("--index-number=".length)
  if (!indexNumber) throw new Error("Usage: pnpm admin:bootstrap --index-number=sm/sms/24/0123")
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const target = await bootstrapAdmin(client, indexNumber)
    await client.query("COMMIT")
    console.log(`Bootstrap success: existing account ${target.index_number} is SUPER_ADMIN${target.role === "SUPER_ADMIN" ? " (already assigned)" : ""}.`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally { client.release() }
}
main().catch(error => { console.error(error instanceof Error ? error.message : "Bootstrap failed"); process.exitCode = 1 })
