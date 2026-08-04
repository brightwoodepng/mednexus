import { execFileSync } from "node:child_process"
import { describe, expect, it } from "vitest"

import { migrationDatabaseUrl } from "../../scripts/migrate"
import { deploymentBuildSteps, validateDeploymentEnvironment } from "../../scripts/vercel-build.mjs"

describe("deployment migration policy", () => {
  it("rejects production builds that cannot issue session tokens", () => {
    expect(() => validateDeploymentEnvironment({ NODE_ENV: "test", VERCEL_ENV: "production" })).toThrow("SESSION_SECRET")
    expect(() => validateDeploymentEnvironment({ NODE_ENV: "test", VERCEL_ENV: "production", SESSION_SECRET: "test-secret" })).not.toThrow()
  })
  it("does not consume database transfer during ordinary production builds", () => {
    expect(deploymentBuildSteps({ NODE_ENV: "test", VERCEL_ENV: "production" })).toEqual(["build"])
    expect(deploymentBuildSteps({
      NODE_ENV: "test",
      VERCEL_ENV: "production",
      RUN_DATABASE_MIGRATIONS: "true",
    })).toEqual(["db:migrate", "build"])
  })

  it("does not expose production data to arbitrary preview branches", () => {
    expect(deploymentBuildSteps({
      VERCEL_ENV: "preview",
      NODE_ENV: "test",
      DATABASE_URL: "postgres://production.example/mednexus",
    })).toEqual(["build"])
  })

  it("migrates an explicitly approved preview database", () => {
    expect(deploymentBuildSteps({
      VERCEL_ENV: "preview",
      NODE_ENV: "test",
      POSTGRES_URL: "postgres://preview.example/mednexus",
      VERCEL_PREVIEW_DATABASE_APPROVED: "true",
      RUN_DATABASE_MIGRATIONS: "true",
    })).toEqual(["db:migrate", "build"])
  })

  it("uses a release-owner database URL before the restricted runtime URL", () => {
    expect(migrationDatabaseUrl({
      MIGRATION_DATABASE_URL: "postgres://release.example/mednexus",
      bright_DATABASE_URL_UNPOOLED: "postgres://integration.example/mednexus",
      DATABASE_URL: "postgres://runtime.example/mednexus",
    })).toBe("postgres://release.example/mednexus")
    expect(migrationDatabaseUrl({
      bright_DATABASE_URL_UNPOOLED: "postgres://integration.example/mednexus",
      DATABASE_URL: "postgres://runtime.example/mednexus",
    })).toBe("postgres://integration.example/mednexus")
  })

  it("reports a missing connection variable without attempting localhost", () => {
    let output = ""
    try {
      execFileSync(process.execPath, ["--import", "tsx", "scripts/migrate.ts"], {
        cwd: process.cwd(),
        encoding: "utf8",
        env: {
          ...process.env,
          DATABASE_URL: "",
          POSTGRES_URL: "",
          PNPM_HOME: `${process.cwd()}/.pnpm-home`,
          XDG_DATA_HOME: `${process.cwd()}/.pnpm-data`,
          XDG_CACHE_HOME: `${process.cwd()}/.pnpm-cache`,
        },
        stdio: "pipe",
      })
    } catch (error) {
      output = `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}`
    }

    expect(output).toContain("Database migration failed.")
    expect(output).toContain("A migration database URL is not configured")
    expect(output).not.toContain("ECONNREFUSED")
  })
})
