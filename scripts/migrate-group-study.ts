async function main() {
  const adminUrl = [
    process.env.DATABASE_ADMIN_URL,
    process.env.DATABASE_URL_UNPOOLED,
    process.env.POSTGRES_URL_NON_POOLING,
  ].find(value => value?.trim())

  if (!adminUrl) {
    throw new Error("Set DATABASE_ADMIN_URL to an owner-level PostgreSQL connection before running this migration")
  }

  process.env.DATABASE_URL = adminUrl
  const { ensureGroupStudySchema, groupStudySchemaStatus, default: pool } = await import("../lib/db")

  try {
    await ensureGroupStudySchema()
    const status = await groupStudySchemaStatus()
    if (!status.ready) throw new Error(`Group Study schema is still incomplete: ${status.missing.join(", ")}`)
    console.log("Group Study schema migration complete")
  } finally {
    await pool.end()
  }
}

void main()
