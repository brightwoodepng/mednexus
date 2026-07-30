import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export function deploymentBuildSteps(env = process.env) {
  // Schema changes are an explicit release operation. Running the entire
  // idempotent schema program on every Vercel build consumes database
  // connections/transfer, blocks otherwise-safe frontend deployments when a
  // provider quota is exhausted, and repeats work already completed by the
  // release operator.
  if (env.VERCEL_ENV === "production") {
    return env.RUN_DATABASE_MIGRATIONS === "true"
      ? ["db:migrate", "build"]
      : ["build"]
  }

  if (env.VERCEL_ENV === "preview") {
    const previewDatabaseApproved = env.VERCEL_PREVIEW_DATABASE_APPROVED === "true"
      && env.RUN_DATABASE_MIGRATIONS === "true"

    if (previewDatabaseApproved) return ["db:migrate", "build"]

    console.log("Preview database migration skipped: no approved Preview database is configured.")
    return ["build"]
  }

  return env.RUN_DATABASE_MIGRATIONS === "true"
    && (env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim())
    ? ["db:migrate", "build"]
    : ["build"]
}

export function validateDeploymentEnvironment(env = process.env) {
  if (env.VERCEL_ENV === "production" && !env.SESSION_SECRET?.trim()) {
    throw new Error("SESSION_SECRET is not configured for the Vercel Production environment")
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  validateDeploymentEnvironment()
  for (const script of deploymentBuildSteps()) {
    const result = spawnSync("pnpm", ["run", script], { stdio: "inherit" })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
}
