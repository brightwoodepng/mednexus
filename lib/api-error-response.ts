import { NextResponse } from "next/server"

type DatabaseError = Error & { code?: string }

const transientCodes = new Set(["57P01", "57P02", "57P03", "08000", "08003", "08006", "08001", "08004", "53300"])

export function isTransientDatabaseError(error: unknown) {
  return transientCodes.has((error as DatabaseError | undefined)?.code ?? "")
}

export function databaseErrorResponse(error: unknown, fallback: string, status = 500) {
  const databaseError = error as DatabaseError | undefined
  const retryable = isTransientDatabaseError(error)
  const code = retryable ? "DATABASE_TEMPORARILY_UNAVAILABLE"
    : databaseError?.code === "23503" ? "RELATED_RECORD_MISMATCH"
      : databaseError?.code === "23505" ? "DUPLICATE_RECORD"
        : databaseError?.code === "42501" ? "DATABASE_PERMISSION_DENIED"
          : "DATABASE_REQUEST_FAILED"
  const safeMessage = status < 500 && databaseError?.message ? databaseError.message : retryable
    ? "The database connection was interrupted. Please retry."
    : fallback
  return NextResponse.json({ error: safeMessage, code, retryable }, { status: retryable ? 503 : status })
}
