"use client"

import { createElement, useRef, type ElementType } from "react"
import { getCosmeticPresentation } from "./registry"
import { useCosmeticMotion } from "./motion"
import type { CosmeticKind, CosmeticRendererProps } from "./types"

type WrapperProps = CosmeticRendererProps & { as?: ElementType }
const SIZE_CLASSES = { "store-preview": "", profile: "", lobby: "", leaderboard: "", compact: "" } as const

function CosmeticWrapper({ as = "div", kind, ...props }: WrapperProps & { kind: CosmeticKind }) {
  const ref = useRef<HTMLElement>(null)
  const presentation = getCosmeticPresentation(props.cosmeticId, kind)
  const Renderer = presentation.Renderer
  const stable = !props.cosmeticId || presentation.label === "Default cosmetic"
  const motionState = useCosmeticMotion(ref, props.reducedMotion ? "reduced" : (props.motionState ?? "static"))
  const className = ["cosmetic-surface", SIZE_CLASSES[props.size], presentation.className, props.className].filter(Boolean).join(" ")
  return createElement(as, {
    ref,
    className,
    "data-cosmetic-id": stable ? "default" : props.cosmeticId,
    "data-cosmetic-size": props.size,
    "data-interaction-state": props.interactionState ?? "idle",
    "data-active": props.active !== false,
    "data-motion-state": stable ? "static" : motionState,
    "data-player-score": props.playerScore,
    "data-player-rank": props.playerRank,
  }, <Renderer {...props}>{props.avatarImage ?? props.children}</Renderer>)
}

export const CosmeticAvatar = (props: WrapperProps) => <CosmeticWrapper {...props} kind="avatar" />
export const CosmeticFrame = (props: WrapperProps) => <CosmeticWrapper {...props} kind="frame" />
export const CosmeticHighlight = (props: WrapperProps) => <CosmeticWrapper {...props} kind="highlight" />

export function CosmeticTitle(props: WrapperProps) {
  const metadata = getCosmeticPresentation(props.cosmeticId, "title")
  return <CosmeticWrapper as="span" {...props} kind="title">{props.children ?? metadata.title ?? ""}</CosmeticWrapper>
}

export interface CosmeticLoadoutProps extends Omit<WrapperProps, "cosmeticId"> {
  avatarId?: string | null; frameId?: string | null; highlightId?: string | null; titleId?: string | null
}
export function CosmeticLoadout({ avatarId, frameId, highlightId, titleId, children, ...props }: CosmeticLoadoutProps) {
  return <CosmeticHighlight cosmeticId={highlightId} {...props}>
    <CosmeticFrame cosmeticId={frameId} {...props}>
      <CosmeticAvatar cosmeticId={avatarId} {...props}>{children}</CosmeticAvatar>
    </CosmeticFrame>
    {titleId && <CosmeticTitle cosmeticId={titleId} {...props} />}
  </CosmeticHighlight>
}

export function CosmeticPreviewStage(props: WrapperProps) {
  return <CosmeticWrapper {...props} kind="highlight" className={`relative isolate overflow-hidden ${props.className ?? ""}`} />
}
