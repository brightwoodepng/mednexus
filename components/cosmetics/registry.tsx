import type { ComponentType } from "react"
import type { CosmeticPresentationMetadata, CosmeticRendererProps } from "./types"

function PresentationRenderer({ children, avatarImage }: CosmeticRendererProps) {
  return <>{avatarImage ?? children}</>
}

type RegistryEntry = CosmeticPresentationMetadata & { Renderer: ComponentType<CosmeticRendererProps> }
const entry = (metadata: CosmeticPresentationMetadata): RegistryEntry => ({ ...metadata, Renderer: PresentationRenderer })

/**
 * Client-side presentation only. This registry deliberately contains no price,
 * inventory, ownership, availability, or authorization information.
 */
export const COSMETIC_RENDERER_REGISTRY: Readonly<Record<string, RegistryEntry>> = {
  title_pre_med: entry({ kind: "title", label: "Pre-Med", title: "Pre-Med" }),
  title_intern: entry({ kind: "title", label: "The Intern", title: "The Intern" }),
  title_fellow: entry({ kind: "title", label: "Fellow", title: "Fellow" }),
  title_attending: entry({ kind: "title", label: "Attending", title: "Attending" }),
  title_chief_resident: entry({ kind: "title", label: "Chief Resident", title: "Chief Resident" }),
  title_the_gunner: entry({ kind: "title", label: "The Gunner", title: "The Gunner" }),
  title_caffeine_dependent: entry({ kind: "title", label: "Caffeine Dependent", title: "Caffeine Dependent" }),
  title_department_chair: entry({ kind: "title", label: "Department Chair", title: "Department Chair" }),
  title_chief_of_surgery: entry({ kind: "title", label: "Chief of Surgery", title: "Chief of Surgery" }),
  title_dean_of_medicine: entry({ kind: "title", label: "Dean of Medicine", title: "Dean of Medicine" }),
  frame_gold: entry({ kind: "frame", label: "Gold frame", className: "cosmetic-frame cosmetic-frame--gold", legacy: true }),
  frame_neon: entry({ kind: "frame", label: "Neon frame", className: "cosmetic-frame cosmetic-frame--neon", legacy: true }),
  frame_fire: entry({ kind: "frame", label: "Fire frame", className: "cosmetic-frame cosmetic-frame--fire", legacy: true }),
  frame_legendary_diamond: entry({ kind: "frame", label: "Diamond frame", className: "cosmetic-frame cosmetic-frame--diamond", legacy: true }),
  frame_legendary_biohazard: entry({ kind: "frame", label: "Biohazard frame", className: "cosmetic-frame cosmetic-frame--biohazard", legacy: true }),
  frame_mythic_nebula: entry({ kind: "frame", label: "Nebula frame", className: "cosmetic-frame cosmetic-frame--nebula", legacy: true }),
  frame_mythic_heartbeat: entry({ kind: "frame", label: "Heartbeat frame", className: "cosmetic-frame cosmetic-frame--heartbeat", legacy: true }),
  frame_lightning: entry({ kind: "frame", label: "Lightning frame", className: "cosmetic-frame cosmetic-frame--lightning", legacy: true }),
  frame_toxic_drip: entry({ kind: "frame", label: "Toxic Drip frame", className: "cosmetic-frame cosmetic-frame--toxic", legacy: true }),
  highlight_neon: entry({ kind: "highlight", label: "Neon highlight", className: "cosmetic-highlight cosmetic-highlight--neon", legacy: true }),
  highlight_gold: entry({ kind: "highlight", label: "Gold highlight", className: "cosmetic-highlight cosmetic-highlight--gold", legacy: true }),
  highlight_amethyst: entry({ kind: "highlight", label: "Amethyst highlight", className: "cosmetic-highlight cosmetic-highlight--amethyst", legacy: true }),
  highlight_legendary_crimson: entry({ kind: "highlight", label: "Crimson highlight", className: "cosmetic-highlight cosmetic-highlight--crimson", legacy: true }),
  highlight_legendary_emerald: entry({ kind: "highlight", label: "Emerald highlight", className: "cosmetic-highlight cosmetic-highlight--emerald", legacy: true }),
  highlight_mythic_lightning: entry({ kind: "highlight", label: "Lightning highlight", className: "cosmetic-highlight cosmetic-highlight--lightning", legacy: true }),
  highlight_mythic_void_walker: entry({ kind: "highlight", label: "Void Walker highlight", className: "cosmetic-highlight cosmetic-highlight--void", legacy: true }),
  avatar_scrub_tech: entry({ kind: "avatar", label: "Scrub Tech avatar" }),
  avatar_coffee_drip: entry({ kind: "avatar", label: "Coffee Drip avatar" }),
  avatar_lab_rat: entry({ kind: "avatar", label: "Lab Rat avatar" }),
  avatar_night_shift: entry({ kind: "avatar", label: "Night Shift avatar" }),
  avatar_gold_steth: entry({ kind: "avatar", label: "Golden Stethoscope avatar" }),
  avatar_plague_doctor: entry({ kind: "avatar", label: "Plague Doctor avatar" }),
  avatar_cyber_surgeon: entry({ kind: "avatar", label: "Cyber Surgeon avatar" }),
  avatar_ascended: entry({ kind: "avatar", label: "Ascended avatar" }),
  avatar_marble: entry({ kind: "avatar", label: "Marble avatar" }),
  avatar_vital_sign: entry({ kind: "avatar", label: "Vital Sign avatar" }),
}

export function getCosmeticPresentation(id?: string | null, kind?: CosmeticPresentationMetadata["kind"]): RegistryEntry {
  const found = id ? COSMETIC_RENDERER_REGISTRY[id] : undefined
  if (found && (!kind || found.kind === kind)) return found
  return entry({ kind: kind ?? "avatar", label: "Default cosmetic" })
}
