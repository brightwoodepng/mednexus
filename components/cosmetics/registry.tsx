import type { ComponentType } from "react"
import type { CosmeticPresentationMetadata, CosmeticRendererProps } from "./types"
import {
  CardiacConductionFrame, CellCultureFrame, ChartGridFrame, CodeBlueFrame, CTGantryFrame,
  MicroscopeIrisFrame, NeuralSynapseFrame, OperatingTheatreFrame, RadiologyContrastFrame,
  SurgicalSteelFrame, TheResuscitatorFrame, VitalRingFrame,
} from "./frames"

function PresentationRenderer({ children, avatarImage }: CosmeticRendererProps) {
  return <>{avatarImage ?? children}</>
}

type RegistryEntry = CosmeticPresentationMetadata & { Renderer: ComponentType<CosmeticRendererProps> }
const entry = (metadata: CosmeticPresentationMetadata): RegistryEntry => ({ ...metadata, Renderer: PresentationRenderer })
const renderedEntry = (metadata: CosmeticPresentationMetadata, Renderer: ComponentType<CosmeticRendererProps>): RegistryEntry => ({ ...metadata, Renderer })

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
  frame_neon: renderedEntry({ kind: "frame", label: "Vital Ring (Neon Pulse remaster)", className: "clinical-frame clinical-frame--vital", legacy: true }, VitalRingFrame),
  frame_fire: entry({ kind: "frame", label: "Fire frame", className: "cosmetic-frame cosmetic-frame--fire", legacy: true }),
  frame_legendary_diamond: renderedEntry({ kind: "frame", label: "Surgical Steel (Legendary Diamond remaster)", className: "clinical-frame clinical-frame--steel", legacy: true }, SurgicalSteelFrame),
  frame_legendary_biohazard: entry({ kind: "frame", label: "Biohazard frame", className: "cosmetic-frame cosmetic-frame--biohazard", legacy: true }),
  frame_mythic_nebula: entry({ kind: "frame", label: "Nebula frame", className: "cosmetic-frame cosmetic-frame--nebula", legacy: true }),
  frame_mythic_heartbeat: entry({ kind: "frame", label: "Heartbeat frame", className: "cosmetic-frame cosmetic-frame--heartbeat", legacy: true }),
  frame_lightning: entry({ kind: "frame", label: "Lightning frame", className: "cosmetic-frame cosmetic-frame--lightning", legacy: true }),
  frame_toxic_drip: entry({ kind: "frame", label: "Toxic Drip frame", className: "cosmetic-frame cosmetic-frame--toxic", legacy: true }),
  frame_vital_ring: renderedEntry({ kind: "frame", label: "Vital Ring", className: "clinical-frame clinical-frame--vital" }, VitalRingFrame),
  frame_surgical_steel: renderedEntry({ kind: "frame", label: "Surgical Steel", className: "clinical-frame clinical-frame--steel" }, SurgicalSteelFrame),
  frame_chart_grid: renderedEntry({ kind: "frame", label: "Chart Grid", className: "clinical-frame clinical-frame--chart" }, ChartGridFrame),
  frame_ct_gantry: renderedEntry({ kind: "frame", label: "CT Gantry", className: "clinical-frame clinical-frame--ct" }, CTGantryFrame),
  frame_microscope_iris: renderedEntry({ kind: "frame", label: "Microscope Iris", className: "clinical-frame clinical-frame--iris" }, MicroscopeIrisFrame),
  frame_neural_synapse: renderedEntry({ kind: "frame", label: "Neural Synapse", className: "clinical-frame clinical-frame--synapse" }, NeuralSynapseFrame),
  frame_code_blue: renderedEntry({ kind: "frame", label: "Code Blue", className: "clinical-frame clinical-frame--code-blue" }, CodeBlueFrame),
  frame_operating_theatre: renderedEntry({ kind: "frame", label: "Operating Theatre", className: "clinical-frame clinical-frame--theatre" }, OperatingTheatreFrame),
  frame_cell_culture: renderedEntry({ kind: "frame", label: "Cell Culture", className: "clinical-frame clinical-frame--culture" }, CellCultureFrame),
  frame_cardiac_conduction: renderedEntry({ kind: "frame", label: "Cardiac Conduction", className: "clinical-frame clinical-frame--cardiac" }, CardiacConductionFrame),
  frame_radiology_contrast: renderedEntry({ kind: "frame", label: "Radiology Contrast", className: "clinical-frame clinical-frame--contrast" }, RadiologyContrastFrame),
  frame_the_resuscitator: renderedEntry({ kind: "frame", label: "The Resuscitator", className: "clinical-frame clinical-frame--resuscitator" }, TheResuscitatorFrame),
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
