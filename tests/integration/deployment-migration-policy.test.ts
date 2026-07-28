import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

import { deploymentBuildSteps } from "../../scripts/vercel-build.mjs"

describe("deployment migration policy", () => {
  it("keeps database migration as a required production gate", () => {
    expect(deploymentBuildSteps({ VERCEL_ENV: "production" })).toEqual(["db:migrate", "build"])
  })

  it("does not expose production data to arbitrary preview branches", () => {
    expect(deploymentBuildSteps({
      VERCEL_ENV: "preview",
      DATABASE_URL: "postgres://production.example/mednexus",
    })).toEqual(["build"])
  })

  it("migrates an explicitly approved preview database", () => {
    expect(deploymentBuildSteps({
      VERCEL_ENV: "preview",
      POSTGRES_URL: "postgres://preview.example/mednexus",
      VERCEL_PREVIEW_DATABASE_APPROVED: "true",
    })).toEqual(["db:migrate", "build"])
  })

  it("reports a missing connection variable without attempting localhost", () => {
    let output = ""
    try {
      execFileSync("pnpm", ["run", "db:migrate"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: { ...process.env, DATABASE_URL: "", POSTGRES_URL: "" },
        stdio: "pipe",
      })
    } catch (error) {
      output = `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}`
    }

    expect(output).toContain("Database migration failed.")
    expect(output).toContain("DATABASE_URL or POSTGRES_URL is not configured")
    expect(output).not.toContain("ECONNREFUSED")
  })
})
