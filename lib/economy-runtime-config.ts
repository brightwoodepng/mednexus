import type { Pool, PoolClient } from "pg"
import { ECONOMY_CONFIG, type EconomyConfig } from "@/lib/economy-config"
import { XP_CONFIG } from "@/lib/xp-config"

export type RuntimeXPConfig = typeof XP_CONFIG
export type RuntimeEconomyConfig = EconomyConfig
export type EconomyConfigSnapshot = {
  version: string
  npConfig: RuntimeEconomyConfig
  xpConfig: RuntimeXPConfig
}

type Queryable = Pick<Pool | PoolClient, "query">

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T
}

export function defaultEconomyConfigSnapshot(): EconomyConfigSnapshot {
  return { version: `${ECONOMY_CONFIG.economyVersion}/${XP_CONFIG.version}`, npConfig: clone(ECONOMY_CONFIG), xpConfig: clone(XP_CONFIG) }
}

export async function getActiveEconomyConfig(db: Queryable): Promise<EconomyConfigSnapshot> {
  try {
    const result = await db.query(`SELECT version,np_config,xp_config FROM mednexus_economy_config_revisions WHERE is_active=TRUE LIMIT 1`)
    const row = result.rows[0]
    if (row) return { version: String(row.version), npConfig: row.np_config as RuntimeEconomyConfig, xpConfig: row.xp_config as RuntimeXPConfig }
  } catch (error) {
    // Deployments remain readable during the migration rollout. The admin
    // workspace itself reports the missing schema and cannot mutate it.
    if (!(typeof error === "object" && error && "code" in error && (error as { code?: string }).code === "42P01")) throw error
  }
  return defaultEconomyConfigSnapshot()
}

export function validateEconomyConfig(npConfig: unknown, xpConfig: unknown): string[] {
  const errors: string[] = []
  if (!npConfig || typeof npConfig !== "object") errors.push("NP configuration is required.")
  if (!xpConfig || typeof xpConfig !== "object") errors.push("XP configuration is required.")
  const visit = (value: unknown, path: string) => {
    if (typeof value === "number" && (!Number.isFinite(value) || value < 0)) errors.push(`${path} must be a non-negative number.`)
    else if (Array.isArray(value)) value.forEach((item, index) => visit(item, `${path}.${index}`))
    else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => visit(item, path ? `${path}.${key}` : key))
  }
  visit(npConfig, "NP")
  visit(xpConfig, "XP")
  const xp = xpConfig as { clinicalRanks?: Array<{ minimumXP?: number }> } | null
  const thresholds = xp?.clinicalRanks?.map(rank => Number(rank.minimumXP)) ?? []
  if (thresholds.some((value, index) => index > 0 && value <= thresholds[index - 1])) errors.push("Clinical rank XP thresholds must increase from one rank to the next.")
  const np = npConfig as { examRewards?: { accuracyMultipliers?: Array<{ minimumAccuracy?: number }> }; enabledEarningModes?: Record<string, unknown> } | null
  const accuracyBands = np?.examRewards?.accuracyMultipliers?.map(item => Number(item.minimumAccuracy)) ?? []
  if (accuracyBands.some((value, index) => value < 0 || value > 100 || (index > 0 && value <= accuracyBands[index - 1]))) errors.push("Exam accuracy thresholds must increase and remain between 0 and 100.")
  if (np?.enabledEarningModes && Object.values(np.enabledEarningModes).some(value => typeof value !== "boolean")) errors.push("Every earning-mode switch must be true or false.")
  return [...new Set(errors)]
}

export function economyConfigDiff(before: EconomyConfigSnapshot, npConfig: unknown, xpConfig: unknown) {
  const changes: Array<{ path: string; before: unknown; after: unknown }> = []
  const walk = (oldValue: unknown, newValue: unknown, path: string) => {
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) return
    if (oldValue && newValue && typeof oldValue === "object" && typeof newValue === "object" && !Array.isArray(oldValue) && !Array.isArray(newValue)) {
      for (const key of new Set([...Object.keys(oldValue), ...Object.keys(newValue)])) walk((oldValue as Record<string,unknown>)[key], (newValue as Record<string,unknown>)[key], path ? `${path}.${key}` : key)
    } else changes.push({ path, before: oldValue, after: newValue })
  }
  walk(before.npConfig, npConfig, "NP")
  walk(before.xpConfig, xpConfig, "XP")
  return changes
}
