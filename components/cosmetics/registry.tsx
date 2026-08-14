import type { ComponentType } from "react"
import type { CosmeticPresentationMetadata, CosmeticRendererProps } from "./types"
import {
  CardiacConductionFrame, CellCultureFrame, ChartGridFrame, CodeBlueFrame, CTGantryFrame,
  MicroscopeIrisFrame, NeuralSynapseFrame, OperatingTheatreFrame, RadiologyContrastFrame,
  SurgicalSteelFrame, TheResuscitatorFrame, VitalRingFrame,
  DNASequencerFrame, PharmacologyOrbitFrame, SurgicalDroneFrame, HoloAnatomyFrame,
} from "./frames"
import { AnatomyPlate, BloodFlow, MonitorSweep, NeuralField, PrescriptionLabel, RadiologyLightbox, SterileField, TriagePriority } from "./highlights"
import { AvatarImage } from "@/components/avatar-image"
import { ReactiveTitleRenderer } from "./titles"

function PresentationRenderer({ children, avatarImage }: CosmeticRendererProps) {
  return <>{avatarImage ?? children}</>
}

/** The registry is the only cosmetic-ID dispatch point; asset details stay in the manifest. */
function AvatarRenderer({ cosmeticId, children }: CosmeticRendererProps) {
  if (!cosmeticId) return <>{children}</>
  return <AvatarImage avatarId={cosmeticId} className="h-full w-full object-cover" fallback={typeof children === "string" ? children : undefined} />
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
  title_night_consult: renderedEntry({ kind: "title", label: "Night Consult", title: "Night Consult", className: "reactive-title" }, ReactiveTitleRenderer),
  title_diagnostician: renderedEntry({ kind: "title", label: "The Diagnostician", title: "The Diagnostician", className: "reactive-title" }, ReactiveTitleRenderer),
  title_anatomy_architect: renderedEntry({ kind: "title", label: "Anatomy Architect", title: "Anatomy Architect", className: "reactive-title" }, ReactiveTitleRenderer),
  title_code_commander: renderedEntry({ kind: "title", label: "Code Commander", title: "Code Commander", className: "reactive-title" }, ReactiveTitleRenderer),
  title_synapse_specialist: renderedEntry({ kind: "title", label: "Synapse Specialist", title: "Synapse Specialist", className: "reactive-title" }, ReactiveTitleRenderer),
  title_nexus_laureate: renderedEntry({ kind: "title", label: "Nexus Laureate", title: "Nexus Laureate", className: "reactive-title" }, ReactiveTitleRenderer),
  frame_gold: renderedEntry({ kind: "frame", label: "Golden Ratio precision frame", className: "clinical-frame clinical-frame--steel", legacy: true }, SurgicalSteelFrame),
  frame_neon: renderedEntry({ kind: "frame", label: "Vital Ring (Neon Pulse remaster)", className: "clinical-frame clinical-frame--vital", legacy: true }, VitalRingFrame),
  frame_fire: entry({ kind: "frame", label: "Fire frame", className: "cosmetic-frame cosmetic-frame--fire", legacy: true }),
  frame_legendary_diamond: renderedEntry({ kind: "frame", label: "Surgical Steel (Legendary Diamond remaster)", className: "clinical-frame clinical-frame--steel", legacy: true }, SurgicalSteelFrame),
  frame_legendary_biohazard: renderedEntry({ kind: "frame", label: "Containment Seal frame", className: "clinical-frame clinical-frame--ct", legacy: true }, CTGantryFrame),
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
  frame_dna_sequencer: renderedEntry({ kind: "frame", label: "DNA Sequencer", className: "clinical-frame clinical-frame--dna" }, DNASequencerFrame),
  frame_pharmacology_orbit: renderedEntry({ kind: "frame", label: "Pharmacology Orbit", className: "clinical-frame clinical-frame--pharmacology" }, PharmacologyOrbitFrame),
  frame_surgical_drone: renderedEntry({ kind: "frame", label: "Surgical Drone", className: "clinical-frame clinical-frame--drone" }, SurgicalDroneFrame),
  frame_holo_anatomy: renderedEntry({ kind: "frame", label: "Holo Anatomy", className: "clinical-frame clinical-frame--anatomy" }, HoloAnatomyFrame),
  highlight_neon: renderedEntry({ kind: "highlight", label: "Monitor Sweep", className: "clinical-highlight clinical-highlight--monitor", legacy: true }, MonitorSweep),
  highlight_gold: renderedEntry({ kind: "highlight", label: "Prescription Label", className: "clinical-highlight clinical-highlight--prescription", legacy: true }, PrescriptionLabel),
  highlight_amethyst: renderedEntry({ kind: "highlight", label: "Anatomy Plate", className: "clinical-highlight clinical-highlight--anatomy", legacy: true }, AnatomyPlate),
  highlight_legendary_crimson: renderedEntry({ kind: "highlight", label: "Triage Priority", className: "clinical-highlight clinical-highlight--triage", legacy: true }, TriagePriority),
  highlight_legendary_emerald: renderedEntry({ kind: "highlight", label: "Sterile Field", className: "clinical-highlight clinical-highlight--sterile", legacy: true }, SterileField),
  highlight_mythic_lightning: renderedEntry({ kind: "highlight", label: "Neural Field", className: "clinical-highlight clinical-highlight--neural", legacy: true }, NeuralField),
  highlight_mythic_void_walker: renderedEntry({ kind: "highlight", label: "Radiology Lightbox", className: "clinical-highlight clinical-highlight--radiology", legacy: true }, RadiologyLightbox),
  highlight_monitor_sweep: renderedEntry({ kind: "highlight", label: "Monitor Sweep", className: "clinical-highlight clinical-highlight--monitor" }, MonitorSweep),
  highlight_radiology_lightbox: renderedEntry({ kind: "highlight", label: "Radiology Lightbox", className: "clinical-highlight clinical-highlight--radiology" }, RadiologyLightbox),
  highlight_triage_priority: renderedEntry({ kind: "highlight", label: "Triage Priority", className: "clinical-highlight clinical-highlight--triage" }, TriagePriority),
  highlight_prescription_label: renderedEntry({ kind: "highlight", label: "Prescription Label", className: "clinical-highlight clinical-highlight--prescription" }, PrescriptionLabel),
  highlight_anatomy_plate: renderedEntry({ kind: "highlight", label: "Anatomy Plate", className: "clinical-highlight clinical-highlight--anatomy" }, AnatomyPlate),
  highlight_blood_flow: renderedEntry({ kind: "highlight", label: "Blood Flow", className: "clinical-highlight clinical-highlight--blood" }, BloodFlow),
  highlight_neural_field: renderedEntry({ kind: "highlight", label: "Neural Field", className: "clinical-highlight clinical-highlight--neural" }, NeuralField),
  highlight_sterile_field: renderedEntry({ kind: "highlight", label: "Sterile Field", className: "clinical-highlight clinical-highlight--sterile" }, SterileField),
  avatar_scrub_tech: renderedEntry({ kind: "avatar", label: "Scrub Tech avatar" }, AvatarRenderer),
  avatar_coffee_drip: renderedEntry({ kind: "avatar", label: "Coffee Drip avatar" }, AvatarRenderer),
  avatar_lab_rat: renderedEntry({ kind: "avatar", label: "Lab Rat avatar" }, AvatarRenderer),
  avatar_night_shift: renderedEntry({ kind: "avatar", label: "Night Shift avatar" }, AvatarRenderer),
  avatar_gold_steth: renderedEntry({ kind: "avatar", label: "Golden Stethoscope avatar" }, AvatarRenderer),
  avatar_plague_doctor: renderedEntry({ kind: "avatar", label: "Plague Doctor avatar" }, AvatarRenderer),
  avatar_cyber_surgeon: renderedEntry({ kind: "avatar", label: "Cyber Surgeon avatar" }, AvatarRenderer),
  avatar_ascended: renderedEntry({ kind: "avatar", label: "Ascended avatar" }, AvatarRenderer),
  avatar_marble: renderedEntry({ kind: "avatar", label: "Marble avatar" }, AvatarRenderer),
  avatar_vital_sign: renderedEntry({ kind: "avatar", label: "Vital Sign avatar" }, AvatarRenderer),
  avatar_pulse_runner: renderedEntry({ kind: "avatar", label: "Pulse Runner avatar" }, AvatarRenderer),
  avatar_neurocartographer: renderedEntry({ kind: "avatar", label: "Neurocartographer avatar" }, AvatarRenderer),
  avatar_robotic_surgery_fellow: renderedEntry({ kind: "avatar", label: "Robotic Surgery Fellow avatar" }, AvatarRenderer),
  avatar_nexus_laureate: renderedEntry({ kind: "avatar", label: "Nexus Laureate avatar" }, AvatarRenderer),
}

export function getCosmeticPresentation(id?: string | null, kind?: CosmeticPresentationMetadata["kind"]): RegistryEntry {
  const found = id ? COSMETIC_RENDERER_REGISTRY[id] : undefined
  if (found && (!kind || found.kind === kind)) return found
  return entry({ kind: kind ?? "avatar", label: "Default cosmetic" })
}
