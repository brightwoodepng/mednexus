import type { TheoryCollectionKind } from "@/lib/theory-import"

/** Keep set placement compatible with both the legacy composite FK and the current model. */
export function theorySetPlacement(
  kind: TheoryCollectionKind,
  moduleId: string | null,
  disciplineId: string | null,
) {
  return {
    moduleId: kind === "end_of_module" ? moduleId : null,
    disciplineId,
  }
}

export function theorySetAllocationKey(
  collectionId: string,
  kind: TheoryCollectionKind,
  moduleId: string | null,
  disciplineId: string | null,
) {
  const groupId = kind === "end_of_module" ? moduleId : disciplineId
  return `${collectionId}:${kind}:${groupId ?? ""}:${disciplineId ?? ""}`
}
