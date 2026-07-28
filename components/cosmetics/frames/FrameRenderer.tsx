import { useId, type ReactNode } from "react"
import type { CosmeticRendererProps } from "../types"
import { FRAME_DEFINITIONS, type ClinicalFrameId, type FrameDefinition } from "./definitions"
import "./frames.css"

const orbitDots = [0, 60, 120, 180, 240, 300]

function Geometry({ definition }: { definition: FrameDefinition }) {
  const gradientId = `clinical-frame-${useId().replaceAll(":", "")}`
  const [light, accent, dark] = definition.palette
  const common = { fill: "none", stroke: `url(#${gradientId})`, strokeLinecap: "round" as const }
  return <svg className="clinical-frame__svg" viewBox="0 0 100 100" aria-hidden="true" focusable="false">
    <defs><linearGradient id={gradientId} x1="12" y1="8" x2="88" y2="92"><stop stopColor={light}/><stop offset=".48" stopColor={accent}/><stop offset="1" stopColor={dark}/></linearGradient></defs>
    {(definition.geometry === "ring" || definition.geometry === "contrast") && <><circle {...common} cx="50" cy="50" r="47" strokeWidth="5"/><path className="clinical-frame__signal" {...common} strokeWidth="2.2" d="M5 51h16l5-9 7 20 8-28 8 17h46"/></>}
    {definition.geometry === "steel" && <><circle {...common} cx="50" cy="50" r="47" strokeWidth="7"/><circle cx="50" cy="50" r="42" fill="none" stroke={light} strokeOpacity=".45"/><path {...common} strokeWidth="1.5" d="M20 17l5 6m50-6-5 6M17 78l7-6m59 6-7-6"/></>}
    {definition.geometry === "grid" && <><rect {...common} x="4" y="4" width="92" height="92" rx="22" strokeWidth="4"/><path {...common} strokeWidth="1" opacity=".6" d="M20 5v90M35 3v94M65 3v94M80 5v90M5 20h90M3 35h94M3 65h94M5 80h90"/></>}
    {definition.geometry === "gantry" && <><circle {...common} cx="50" cy="50" r="47" strokeWidth="8"/><path {...common} strokeWidth="3" d="M16 20h15M69 20h15M16 80h15M69 80h15"/><circle cx="50" cy="8" r="2.5" fill={accent}/></>}
    {definition.geometry === "iris" && <>{orbitDots.map((angle, i) => <path key={angle} {...common} className="clinical-frame__blade" strokeWidth="5" d="M50 3c18 4 29 16 34 31-13-8-28-6-39 3-3-14-1-25 5-34Z" transform={`rotate(${angle} 50 50)`} opacity={.5 + i * .07}/>)}</>}
    {definition.geometry === "synapse" && <>{orbitDots.map(angle => <g key={angle} transform={`rotate(${angle} 50 50)`}><path {...common} strokeWidth="2" d="M50 2v17l-7 8m7-8 8 8"/><circle cx="50" cy="3" r="3" fill={accent}/><circle cx="43" cy="27" r="2" fill={light}/></g>)}</>}
    {definition.geometry === "code" && <><rect {...common} x="4" y="4" width="92" height="92" rx="18" strokeWidth="5"/><path className="clinical-frame__signal" {...common} strokeWidth="3" d="M5 52h18l5-12 8 25 9-38 10 25h40"/><path stroke={light} strokeWidth="2" d="M50 7v10M45 12h10M50 83v10M45 88h10"/></>}
    {definition.geometry === "theatre" && <>{orbitDots.map(angle => <g key={angle} transform={`rotate(${angle} 50 50)`}><ellipse {...common} strokeWidth="3" cx="50" cy="10" rx="10" ry="7"/><circle cx="50" cy="10" r="3" fill={light}/></g>)}<circle {...common} cx="50" cy="50" r="35" strokeWidth="2"/></>}
    {definition.geometry === "culture" && <><circle {...common} cx="50" cy="50" r="47" strokeWidth="4"/>{orbitDots.map((angle, i) => <g key={angle} transform={`rotate(${angle + i * 9} 50 50)`}><circle cx="50" cy={8 + i % 2 * 7} r={3 + i % 3} fill={i % 2 ? accent : light} opacity=".8"/><circle cx="48" cy={7 + i % 2 * 7} r="1" fill={dark}/></g>)}</>}
    {definition.geometry === "conduction" && <><path {...common} strokeWidth="5" d="M50 4C22 4 5 22 5 50s17 46 45 46 45-18 45-46S78 4 50 4Z"/><path className="clinical-frame__signal" {...common} strokeWidth="2.5" d="M14 27c17-12 26 4 36 23s22 33 37 20"/><circle cx="15" cy="27" r="4" fill={light}/><circle cx="50" cy="50" r="4" fill={accent}/><circle cx="87" cy="70" r="4" fill={light}/></>}
    {definition.geometry === "resuscitator" && <><rect {...common} x="4" y="4" width="92" height="92" rx="24" strokeWidth="6"/><path className="clinical-frame__signal" {...common} strokeWidth="3" d="M5 55h22l7-17 9 30 11-40 10 27h31"/><path fill={accent} d="m53 6-10 17h8l-5 13 15-20h-9l6-10Z"/></>}
  </svg>
}

export function ClinicalFrameRenderer({ definition, children, avatarImage }: CosmeticRendererProps & { definition: FrameDefinition }) {
  return <><span className="clinical-frame__content">{avatarImage ?? children}</span><span className="clinical-frame__geometry"><Geometry definition={definition}/></span></>
}

function renderer(id: ClinicalFrameId) {
  const Component = (props: CosmeticRendererProps) => <ClinicalFrameRenderer {...props} definition={FRAME_DEFINITIONS[id]}/>
  Component.displayName = `${FRAME_DEFINITIONS[id].name.replaceAll(" ", "")}FrameRenderer`
  return Component
}

export const VitalRingFrame = renderer("frame_vital_ring")
export const SurgicalSteelFrame = renderer("frame_surgical_steel")
export const ChartGridFrame = renderer("frame_chart_grid")
export const CTGantryFrame = renderer("frame_ct_gantry")
export const MicroscopeIrisFrame = renderer("frame_microscope_iris")
export const NeuralSynapseFrame = renderer("frame_neural_synapse")
export const CodeBlueFrame = renderer("frame_code_blue")
export const OperatingTheatreFrame = renderer("frame_operating_theatre")
export const CellCultureFrame = renderer("frame_cell_culture")
export const CardiacConductionFrame = renderer("frame_cardiac_conduction")
export const RadiologyContrastFrame = renderer("frame_radiology_contrast")
export const TheResuscitatorFrame = renderer("frame_the_resuscitator")
