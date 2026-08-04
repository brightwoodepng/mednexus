import "server-only"

import type { Pool } from "pg"

/**
 * Return the already-provisioned application database pool.
 *
 * Schema changes belong to the release migration process. Runtime requests use
 * a deliberately restricted database role and must never attempt DDL before
 * reading or writing application data.
 */
export async function runtimePool(): Promise<Pool> {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    throw new Error("Application database is not configured.")
  }
  const { default: pool } = await import("@/lib/db")
  return pool
}

export async function optionalRuntimePool(): Promise<Pool | null> {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  return runtimePool()
}
