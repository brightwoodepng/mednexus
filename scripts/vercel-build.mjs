import { spawnSync } from "node:child_process"
import { pathToFileURL } from "node:url"

export function deploymentBuildSteps(env = process.env) {
  if (env.VERCEL_ENV === "production") return ["db:migrate", "build"]

  if (env.VERCEL_ENV === "preview") {
    const previewDatabaseApproved = env.VERCEL_PREVIEW_DATABASE_APPROVED === "true"

    if (previewDatabaseApproved) return ["db:migrate", "build"]

    console.log("Preview database migration skipped: no approved Preview database is configured.")
    return ["build"]
  }

  return env.DATABASE_URL?.trim() || env.POSTGRES_URL?.trim()
    ? ["db:migrate", "build"]
    : ["build"]
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const script of deploymentBuildSteps()) {
    const result = spawnSync("pnpm", ["run", script], { stdio: "inherit" })
    if (result.error) throw result.error
    if (result.status !== 0) process.exit(result.status ?? 1)
  }
}
