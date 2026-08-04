import "server-only"

import { NextResponse } from "next/server"

type DatabaseError = { code?: string; message?: string }

export function assessmentErrorResponse(error: unknown) {
  const databaseError = error as DatabaseError

  if (databaseError.code === "42703" || databaseError.code === "42P01") {
    return NextResponse.json({
      error: "Live Assessments is being upgraded. Please retry after the deployment finishes.",
      code: "ASSESSMENT_SCHEMA_OUTDATED",
    }, { status: 503 })
  }

  if (databaseError.code === "42501") {
    return NextResponse.json({
      error: "Live Assessments cannot access its database tables. An administrator must repair the database role.",
      code: "ASSESSMENT_DATABASE_PERMISSION",
    }, { status: 503 })
  }

  if (databaseError.code === "57014" || databaseError.code === "ETIMEDOUT") {
    return NextResponse.json({
      error: "The assessment request timed out. Please try again.",
      code: "ASSESSMENT_TIMEOUT",
    }, { status: 504 })
  }

  return NextResponse.json({
    error: "The assessment service could not complete this request. Please try again.",
    code: "ASSESSMENT_SERVER_ERROR",
  }, { status: 500 })
}
