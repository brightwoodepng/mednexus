import type { HTMLAttributes, ReactNode } from "react"

export type CosmeticSize = "store-preview" | "profile" | "lobby" | "leaderboard" | "compact"
export type CosmeticInteractionState = "idle" | "hovered" | "focused" | "selected" | "disabled"
/** Shared cosmetic motion vocabulary. `focused` is the full interactive treatment. */
export type CosmeticMotionState = "static" | "ambient" | "focused" | "celebrating" | "reduced"
export type CosmeticKind = "avatar" | "frame" | "highlight" | "title"

export interface CosmeticRendererProps {
  cosmeticId?: string | null
  size: CosmeticSize
  interactionState?: CosmeticInteractionState
  reducedMotion?: boolean
  /** Call sites must opt into motion; cosmetics are static by default. */
  motionState?: CosmeticMotionState
  active?: boolean
  playerScore?: number
  playerRank?: number | string
  children?: ReactNode
  avatarImage?: ReactNode
  className?: string
  /** Native attributes belong to the cosmetic's outer semantic element. */
  wrapperProps?: HTMLAttributes<HTMLElement> & { type?: "button" | "submit" | "reset" }
}

export interface CosmeticPresentationMetadata {
  kind: CosmeticKind
  label: string
  className?: string
  title?: string
  /** Legacy CSS is retained only so an already-owned cosmetic still renders. */
  legacy?: boolean
}
