import { NextResponse } from "next/server"

export const DEFAULT_PAGE_SIZE = 20
export const MAX_PAGE_SIZE = 50

export type PaginationBounds = {
  maxPageSize?: number
  defaultPageSize?: number
}

export type Page = {
  page: number
  pageSize: number
  offset: number
}

export function boundedPagination(searchParams: URLSearchParams, bounds: PaginationBounds = {}): Page {
  const maxPageSize = Math.max(1, bounds.maxPageSize ?? MAX_PAGE_SIZE)
  const defaultPageSize = Math.min(maxPageSize, Math.max(1, bounds.defaultPageSize ?? DEFAULT_PAGE_SIZE))
  const requestedPage = Number.parseInt(searchParams.get("page") ?? "1", 10)
  const requestedPageSize = Number.parseInt(
    searchParams.get("pageSize") ?? String(defaultPageSize),
    10,
  )
  const page = Number.isFinite(requestedPage) ? Math.max(1, requestedPage) : 1
  const pageSize = Number.isFinite(requestedPageSize)
    ? Math.min(maxPageSize, Math.max(1, requestedPageSize))
    : defaultPageSize
  return { page, pageSize, offset: (page - 1) * pageSize }
}

export function serializedBytes(payload: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(payload), "utf8")
  } catch {
    return 0
  }
}

export function logDatabaseRoute(input: {
  route: string
  queryDurationMs: number
  rowCount: number
  payload: unknown
}) {
  if (process.env.NODE_ENV === "production") return
  console.info("[db-route]", JSON.stringify({
    route: input.route,
    queryDurationMs: Math.round(input.queryDurationMs * 10) / 10,
    rowCount: input.rowCount,
    responseBytes: serializedBytes(input.payload),
  }))
}

export function measuredJson<T>(
  input: {
    route: string
    queryStartedAt: number
    rowCount: number
    payload: T
  },
  init?: ResponseInit,
) {
  logDatabaseRoute({
    route: input.route,
    queryDurationMs: performance.now() - input.queryStartedAt,
    rowCount: input.rowCount,
    payload: input.payload,
  })
  return NextResponse.json(input.payload, init)
}
