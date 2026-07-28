import type { CosmeticMotionState } from "../types"

export const FRAME_IDS = [
  "frame_vital_ring", "frame_surgical_steel", "frame_chart_grid", "frame_ct_gantry",
  "frame_microscope_iris", "frame_neural_synapse", "frame_code_blue", "frame_operating_theatre",
  "frame_cell_culture", "frame_cardiac_conduction", "frame_radiology_contrast", "frame_the_resuscitator",
] as const

export type ClinicalFrameId = (typeof FRAME_IDS)[number]
export type FrameGeometry = "ring" | "steel" | "grid" | "gantry" | "iris" | "synapse" | "code" | "theatre" | "culture" | "conduction" | "contrast" | "resuscitator"

export interface FrameStateDefinition {
  motion: "none" | "breathe" | "drift" | "scan" | "conduct" | "celebrate"
  intensity: number
  durationMs: number
}

export interface FrameDefinition {
  id: ClinicalFrameId
  name: string
  accessibleLabel: string
  geometry: FrameGeometry
  palette: readonly [string, string, string]
  states: Readonly<Record<CosmeticMotionState, FrameStateDefinition>>
}

const states = (durationMs: number): FrameDefinition["states"] => ({
  static: { motion: "none", intensity: 0, durationMs },
  ambient: { motion: "breathe", intensity: 0.38, durationMs },
  focused: { motion: "scan", intensity: 0.72, durationMs: Math.round(durationMs * .7) },
  celebrating: { motion: "celebrate", intensity: 1, durationMs: Math.round(durationMs * .42) },
  reduced: { motion: "none", intensity: 0, durationMs },
})

export const FRAME_DEFINITIONS: Readonly<Record<ClinicalFrameId, FrameDefinition>> = {
  frame_vital_ring: { id: "frame_vital_ring", name: "Vital Ring", accessibleLabel: "Vital Ring clinical monitor frame", geometry: "ring", palette: ["#67e8f9", "#06b6d4", "#164e63"], states: states(4800) },
  frame_surgical_steel: { id: "frame_surgical_steel", name: "Surgical Steel", accessibleLabel: "Brushed Surgical Steel frame", geometry: "steel", palette: ["#f8fafc", "#94a3b8", "#334155"], states: states(6200) },
  frame_chart_grid: { id: "frame_chart_grid", name: "Chart Grid", accessibleLabel: "Clinical chart grid frame", geometry: "grid", palette: ["#bae6fd", "#38bdf8", "#075985"], states: states(7200) },
  frame_ct_gantry: { id: "frame_ct_gantry", name: "CT Gantry", accessibleLabel: "CT scanner gantry frame", geometry: "gantry", palette: ["#e2e8f0", "#64748b", "#0f172a"], states: states(5400) },
  frame_microscope_iris: { id: "frame_microscope_iris", name: "Microscope Iris", accessibleLabel: "Microscope iris diaphragm frame", geometry: "iris", palette: ["#d8b4fe", "#7e22ce", "#2e1065"], states: states(6800) },
  frame_neural_synapse: { id: "frame_neural_synapse", name: "Neural Synapse", accessibleLabel: "Neural synapse frame", geometry: "synapse", palette: ["#f0abfc", "#a855f7", "#312e81"], states: states(4600) },
  frame_code_blue: { id: "frame_code_blue", name: "Code Blue", accessibleLabel: "Code Blue emergency frame", geometry: "code", palette: ["#dbeafe", "#2563eb", "#172554"], states: states(3600) },
  frame_operating_theatre: { id: "frame_operating_theatre", name: "Operating Theatre", accessibleLabel: "Operating theatre lamp frame", geometry: "theatre", palette: ["#ecfdf5", "#10b981", "#064e3b"], states: states(6400) },
  frame_cell_culture: { id: "frame_cell_culture", name: "Cell Culture", accessibleLabel: "Cell culture microscopy frame", geometry: "culture", palette: ["#fef3c7", "#f59e0b", "#7c2d12"], states: states(7600) },
  frame_cardiac_conduction: { id: "frame_cardiac_conduction", name: "Cardiac Conduction", accessibleLabel: "Cardiac conduction pathway frame", geometry: "conduction", palette: ["#fecdd3", "#e11d48", "#881337"], states: states(4200) },
  frame_radiology_contrast: { id: "frame_radiology_contrast", name: "Radiology Contrast", accessibleLabel: "Radiology contrast frame", geometry: "contrast", palette: ["#ffffff", "#a5b4fc", "#1e1b4b"], states: states(5800) },
  frame_the_resuscitator: { id: "frame_the_resuscitator", name: "The Resuscitator", accessibleLabel: "Defibrillator Resuscitator frame", geometry: "resuscitator", palette: ["#fef08a", "#f97316", "#7c2d12"], states: states(3200) },
}
