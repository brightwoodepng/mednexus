// ============================================================================
// MedNexus — Master Class Level Registry
// ============================================================================
// Single source of truth for all valid academic levels across the platform.
// Import CLASS_LEVELS wherever a dropdown/validation is needed; import
// ENTRANCE_LEVEL when the hidden entrance-exam flow is in scope.
// ============================================================================

/**
 * Publicly visible class levels shown in registration forms and UI dropdowns.
 * Declared as a `const` tuple so each element is a string-literal type.
 */
export const CLASS_LEVELS = [
  "Level 100",
  "Level 200",
  "Level 300",
  "Level 400",
  "Level 500",
  "Level 600",
  "GEM 250",
  "GEM 300",
] as const

/**
 * Hidden level used exclusively for entrance-exam / pre-admission flows.
 * It is intentionally kept separate from CLASS_LEVELS so it never appears
 * in standard UI dropdowns.
 */
export const ENTRANCE_LEVEL = "Entrance Level" as const

// ── Derived types ─────────────────────────────────────────────────────────────

/** Union of all publicly visible class levels. */
export type ClassLevel = (typeof CLASS_LEVELS)[number]

/** Union that also includes the hidden entrance level (for internal use). */
export type AnyClassLevel = ClassLevel | typeof ENTRANCE_LEVEL

/** All levels combined — useful for exhaustive validation on the server. */
export const ALL_LEVELS: readonly string[] = [...CLASS_LEVELS, ENTRANCE_LEVEL]

/**
 * Returns `true` when `value` is any known level (public or hidden).
 * Use this in API routes to validate user-supplied classLevel strings.
 *
 * @example
 * if (!isValidLevel(body.classLevel)) return 400
 */
export function isValidLevel(value: unknown): value is AnyClassLevel {
  return typeof value === "string" && ALL_LEVELS.includes(value)
}
