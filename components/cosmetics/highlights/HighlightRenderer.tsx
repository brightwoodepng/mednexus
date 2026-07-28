import type { CosmeticRendererProps } from "../types"
import "./highlights.css"

export type ClinicalHighlightVariant =
  | "monitor-sweep" | "radiology-lightbox" | "triage-priority" | "prescription-label"
  | "anatomy-plate" | "blood-flow" | "neural-field" | "sterile-field"

/**
 * Highlight artwork lives in peripheral, aria-hidden layers. The content is
 * always painted last so names, scores, badges, privacy marks, and frames keep
 * their native contrast and stacking order.
 */
export function HighlightRenderer({ children, avatarImage, size, playerRank }: CosmeticRendererProps & { variant: ClinicalHighlightVariant }) {
  return <>
    <span className="clinical-highlight__surface" aria-hidden="true" />
    <span className="clinical-highlight__edge" aria-hidden="true" />
    <span className="clinical-highlight__signal" aria-hidden="true" />
    <span className="clinical-highlight__content">{avatarImage ?? children}</span>
    {playerRank && <span className="sr-only">Rank {playerRank}</span>}
    {size === "compact" && <span className="clinical-highlight__compact-mark" aria-hidden="true" />}
  </>
}

function renderer(variant: ClinicalHighlightVariant, displayName: string) {
  const Component = (props: CosmeticRendererProps) => <HighlightRenderer {...props} variant={variant} />
  Component.displayName = `${displayName.replaceAll(" ", "")}Highlight`
  return Component
}

export const MonitorSweep = renderer("monitor-sweep", "Monitor Sweep")
export const RadiologyLightbox = renderer("radiology-lightbox", "Radiology Lightbox")
export const TriagePriority = renderer("triage-priority", "Triage Priority")
export const PrescriptionLabel = renderer("prescription-label", "Prescription Label")
export const AnatomyPlate = renderer("anatomy-plate", "Anatomy Plate")
export const BloodFlow = renderer("blood-flow", "Blood Flow")
export const NeuralField = renderer("neural-field", "Neural Field")
export const SterileField = renderer("sterile-field", "Sterile Field")
