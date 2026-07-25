/**
 * Populate a non-production database with idempotent Theory Vault test content.
 *
 * Usage:
 *   pnpm seed:theory-demo
 */
import pool, { ensureSchema } from "../lib/db"
import { seedTheoryDemo } from "../lib/theory-demo-seed"

function productionEnvironment() {
  return process.env.NODE_ENV === "production"
    || process.env.VERCEL_ENV === "production"
    || process.env.NETLIFY_CONTEXT === "production"
}

async function seed() {
  if (productionEnvironment()) {
    throw new Error("Refusing command-line demo seeding in production. Use the authenticated Theory admin screen instead.")
  }
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error("DATABASE_URL or POSTGRES_URL is required to seed Theory demonstration content.")
  }
  await ensureSchema()
  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    const summary = await seedTheoryDemo(client)
    await client.query("COMMIT")
    console.log(`Seeded ${summary.questions} published Theory questions across ${summary.sets} sets.`)
  } catch (error) {
    await client.query("ROLLBACK")
    throw error
  } finally {
    client.release()
  }
}

seed()
  .catch(error => {
    console.error("Theory demo seed failed.", error)
    process.exitCode = 1
  })
  .finally(() => pool.end())

