import { Pool } from "pg"
import { THEORY_GROUP_STUDY_SCHEMA } from "../lib/theory-group-study-schema"

async function main() {
  const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.DATABASE_ADMIN_URL
    || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING
    || process.env.DATABASE_URL || process.env.POSTGRES_URL
  if (!connectionString) throw new Error("No database connection configured. Configure the existing PostgreSQL migration connection and run this command again.")
  const pool = new Pool({ connectionString, max: 1, connectionTimeoutMillis: 10000,
    ssl: process.env.REPL_ID && !connectionString.includes("sslmode=require") ? false : { rejectUnauthorized: false } })
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("SELECT pg_advisory_xact_lock(hashtext('mednexus:group-study-schema'))")
    const base = await client.query("SELECT to_regclass('public.mednexus_group_study_rooms') IS NOT NULL AS ready")
    if (!base.rows[0]?.ready) throw new Error("The base Group Study schema is missing. Run the existing database migration first.")
    await client.query(THEORY_GROUP_STUDY_SCHEMA)
    const result = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema='public'
      AND ((table_name='mednexus_group_study_rooms' AND column_name='study_type')
        OR (table_name='mednexus_group_study_room_questions' AND column_name='revealed_at'))`)
    if (result.rows.length !== 2) throw new Error("Theory Group Study schema verification failed")
    await client.query("COMMIT")
    console.log("Theory Group Study migration applied and verified. Existing rooms were preserved.")
  } catch (error) { await client.query("ROLLBACK"); throw error }
  finally { client.release(); await pool.end() }
}
main().catch(error => {
  // Never emit connection strings or driver details containing credentials.
  console.error(error instanceof Error && !('code' in error) ? error.message : "Database migration failed. Check the configured connection and schema permissions.")
  process.exitCode = 1
})
