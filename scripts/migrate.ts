/** Apply database schema migrations. Run during deployment, never in request handlers. */
async function migrate() {
  if (!(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim())) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not configured")
  }

  // Do not load lib/db until after the guard. pg otherwise interprets a missing
  // connection string as a request to use its localhost defaults.
  const { ensureSchema } = await import("../lib/db")
  await ensureSchema()
  console.log("Database migrations applied.")
}

migrate().catch((error) => {
  console.error("Database migration failed.", error)
  process.exitCode = 1
})
