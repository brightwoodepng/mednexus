import { NextResponse } from "next/server"
import type { Pool, PoolClient } from "pg"
import { serializedBytes } from "@/lib/api-efficiency"

export type EconomyQueryMetrics = { count: number; startedAt: number }

export function economyMetrics(): EconomyQueryMetrics {
  return { count: 0, startedAt: performance.now() }
}

/** Wraps a pg queryable without changing transaction/connection semantics. */
export function countEconomyQueries<T extends Pool | PoolClient>(db: T, metrics: EconomyQueryMetrics): T {
  return new Proxy(db, {
    get(target, property, receiver) {
      if (property !== "query") return Reflect.get(target, property, receiver)
      return (...args: unknown[]) => {
        metrics.count++
        return (target.query as (...queryArgs: unknown[]) => unknown).apply(target, args)
      }
    },
  })
}

/** Exposes inexpensive measurements without making the application payload larger. */
export function economyJson<T>(route: string, payload: T, metrics: EconomyQueryMetrics, init?: ResponseInit) {
  const bytes = serializedBytes(payload)
  const durationMs = Math.round((performance.now() - metrics.startedAt) * 10) / 10
  if (process.env.NODE_ENV !== "production") {
    console.info("[economy-api]", JSON.stringify({ route, queryCount: metrics.count, responseBytes: bytes, durationMs }))
  }
  const response = NextResponse.json(payload, init)
  response.headers.set("X-Economy-Query-Count", String(metrics.count))
  response.headers.set("X-Economy-Response-Bytes", String(bytes))
  response.headers.set("Server-Timing", `economy;dur=${durationMs}`)
  return response
}
