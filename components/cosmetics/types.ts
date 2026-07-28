import type { ReactNode } from "react"

export type CosmeticSize = "store-preview" | "profile" | "lobby" | "leaderboard" | "compact"
export type CosmeticInteractionState = "idle" | "hovered" | "focused" | "selected" | "disabled"
export type CosmeticKind = "avatar" | "frame" | "highlight" | "title"

export interface CosmeticRendererProps {
  cosmeticId?: string | null
  size: CosmeticSize
  interactionState?: CosmeticInteractionState
  reducedMotion?: boolean
  active?: boolean
  playerScore?: number
  playerRank?: number | string
  children?: ReactNode
  avatarImage?: ReactNode
  className?: string
}

export interface CosmeticPresentationMetadata {
  kind: CosmeticKind
  label: string
  className?: string
  title?: string
  /** Legacy CSS is retained only so an already-owned cosmetic still renders. */
  legacy?: boolean
}
