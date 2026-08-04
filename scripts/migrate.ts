import { pathToFileURL } from "node:url"

type MigrationEnvironment = Record<string, string | undefined>

/** Prefer a release/owner connection for DDL over the restricted runtime URL. */
export function migrationDatabaseUrl(env: MigrationEnvironment = process.env) {
  const integrationOwnerUrl = Object.entries(env)
    .find(([key, value]) => (key.endsWith("_DATABASE_URL_UNPOOLED") || key.endsWith("_POSTGRES_URL_NON_POOLING")) && value?.trim())?.[1]?.trim()
  return env.MIGRATION_DATABASE_URL?.trim()
    || integrationOwnerUrl
    || env.DATABASE_URL?.trim()
    || env.POSTGRES_URL?.trim()
    || ""
}

/** Apply database schema migrations. Run during deployment, never in request handlers. */
export async function migrate() {
  const connectionString = migrationDatabaseUrl()
  if (!connectionString) throw new Error("A migration database URL is not configured")

  // lib/db creates its pool at import time, so select the release connection
  // before importing it. Never copy the secret into logs or build output.
  process.env.DATABASE_URL = connectionString

  // Do not load lib/db until after the guard. pg otherwise interprets a missing
  // connection string as a request to use its localhost defaults.
  const { ensureSchema } = await import("../lib/db")
  await ensureSchema()
  console.log("Database migrations applied.")
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  migrate().catch((error) => {
    console.error("Database migration failed.", error)
    process.exitCode = 1
  })
}
