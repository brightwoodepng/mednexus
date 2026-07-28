"use client"

import { useState, type CSSProperties, type PointerEvent } from "react"
import { AvatarImage } from "@/components/avatar-image"
import { STORE_ITEMS, TITLE_LABELS } from "@/lib/economy"
import { CosmeticHighlight } from "./cosmetics"
import { getCosmeticPresentation } from "./registry"
import type { CosmeticMotionState, CosmeticSize } from "./types"

export type CosmeticPreviewContext = "profile" | "lobby" | "leaderboard" | "winner" | "compact"
type PreviewBackground = "dark" | "light"

const CONTEXTS: { id: CosmeticPreviewContext; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "lobby", label: "Lobby" },
  { id: "leaderboard", label: "Leaderboard" },
  { id: "winner", label: "Winner reveal" },
  { id: "compact", label: "Compact mobile" },
]
const STATES: { id: Exclude<CosmeticMotionState, "static" | "reduced">; label: string }[] = [
  { id: "ambient", label: "Ambient" },
  { id: "focused", label: "Focused" },
  { id: "celebrating", label: "Celebrating" },
]

export interface CosmeticPreviewStageProps {
  avatarId?: string | null
  frameId?: string | null
  highlightId?: string | null
  titleId?: string | null
  displayName: string
}

function behaviorCopy(state: CosmeticMotionState, reducedMotion: boolean, context: CosmeticPreviewContext) {
  if (reducedMotion) return "Static when reduced motion is enabled"
  if (context === "winner" || state === "celebrating") return "Activates during winner reveals"
  if (state === "focused") return "Follows your pointer in previews"
  return "Reacts when you answer correctly"
}

export function CosmeticPreviewStage({ avatarId, frameId, highlightId, titleId, displayName }: CosmeticPreviewStageProps) {
  const [context, setContext] = useState<CosmeticPreviewContext>("leaderboard")
  const [background, setBackground] = useState<PreviewBackground>("dark")
  const [motionState, setMotionState] = useState<Exclude<CosmeticMotionState, "static" | "reduced">>("focused")
  const [reducedMotion, setReducedMotion] = useState(false)

  const avatar = avatarId ? STORE_ITEMS.find(item => item.id === avatarId) : undefined
  const frame = frameId ? STORE_ITEMS.find(item => item.id === frameId) : undefined
  const title = titleId ? STORE_ITEMS.find(item => item.id === titleId) : undefined
  const frameClass = frame ? getCosmeticPresentation(frame.id).className ?? "" : ""
  const isLight = background === "light"
  const effectiveMotion: CosmeticMotionState = reducedMotion ? "reduced" : motionState
  const size: CosmeticSize = context === "compact" ? "compact" : context === "winner" ? "leaderboard" : context

  function updatePointer(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion || motionState !== "focused") return
    const bounds = event.currentTarget.getBoundingClientRect()
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
    event.currentTarget.style.setProperty("--preview-pointer-x", `${x * 7}px`)
    event.currentTarget.style.setProperty("--preview-pointer-y", `${y * 7}px`)
  }

  function resetPointer(event: PointerEvent<HTMLDivElement>) {
    event.currentTarget.style.setProperty("--preview-pointer-x", "0px")
    event.currentTarget.style.setProperty("--preview-pointer-y", "0px")
  }

  const person = (
    <div className={`flex items-center ${context === "profile" ? "flex-col text-center" : "gap-3"}`}>
      <div
        className={`relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br ${avatar?.gradient ?? "from-cyan-500 to-violet-600"} ${frameClass} ${context === "profile" || context === "winner" ? "h-20 w-20 rounded-3xl" : context === "compact" ? "h-10 w-10 rounded-xl" : "h-14 w-14 rounded-2xl"}`}
        style={{ transform: "translate(var(--preview-pointer-x, 0), var(--preview-pointer-y, 0))", transition: "transform 180ms ease-out" }}
      >
        {avatar?.imagePath ? <AvatarImage avatarId={avatar.id} fallback={avatar.icon} eager className="h-full w-full object-cover" /> : <span className="text-2xl">{avatar?.icon ?? "🧑‍⚕️"}</span>}
      </div>
      <div className={context === "profile" ? "mt-3" : "min-w-0"}>
        <div className={`flex flex-wrap items-center ${context === "profile" ? "justify-center" : ""} gap-2`}>
          <span className={`${context === "winner" ? "text-xl" : "text-sm"} truncate font-extrabold`}>{displayName}</span>
          {title && <span className={`rounded-full bg-gradient-to-r ${title.gradient} px-2.5 py-1 text-[10px] font-extrabold text-white`}>{TITLE_LABELS[title.id] ?? title.name}</span>}
        </div>
        <p className={`mt-1 text-xs ${isLight ? "text-slate-500" : "text-slate-300"}`}>
          {context === "profile" ? "Clinical challenger · Level 18" : context === "lobby" ? "Ready to play" : context === "winner" ? "Round champion" : "9,840 points"}
        </p>
      </div>
    </div>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(240px,.65fr)]">
      <div
        className={`relative flex min-h-[260px] touch-none select-none items-center justify-center overflow-hidden rounded-2xl border p-5 transition-colors ${isLight ? "border-slate-200 bg-slate-100 text-slate-950" : "border-white/15 bg-slate-950 text-white"}`}
        style={{ "--preview-pointer-x": "0px", "--preview-pointer-y": "0px" } as CSSProperties}
        onPointerMove={updatePointer}
        onPointerLeave={resetPointer}
        data-preview-context={context}
        aria-label={`${CONTEXTS.find(item => item.id === context)?.label} cosmetic preview`}
      >
        <div className={`pointer-events-none absolute inset-0 ${isLight ? "bg-[radial-gradient(circle_at_50%_20%,white,transparent_55%)]" : "bg-[radial-gradient(circle_at_50%_20%,rgba(139,92,246,.28),transparent_55%)]"}`} />
        <CosmeticHighlight cosmeticId={highlightId} size={size} motionState={effectiveMotion} reducedMotion={reducedMotion} className={`relative w-full max-w-xl rounded-2xl border p-4 ${isLight ? "border-slate-300 bg-white/75" : "border-white/15 bg-white/5"}`}>
          {context === "leaderboard" && <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? "text-slate-500" : "text-slate-300"}`}>Leaderboard · Rank 1</p>}
          {context === "winner" && <p className="mb-4 text-center text-[10px] font-black uppercase tracking-[0.3em] text-amber-400">Winner reveal</p>}
          {context === "lobby" && <p className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${isLight ? "text-slate-500" : "text-slate-300"}`}>Game lobby · 4/4 ready</p>}
          {person}
          {context === "leaderboard" && <span className="absolute right-4 top-1/2 text-sm font-black text-emerald-500">+720</span>}
        </CosmeticHighlight>
      </div>

      <div className="flex min-h-[260px] flex-col rounded-2xl border border-white/10 bg-white/5 p-4">
        <fieldset>
          <legend className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Context</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {CONTEXTS.map(option => <button key={option.id} type="button" aria-pressed={context === option.id} onClick={() => setContext(option.id)} className={`min-h-9 rounded-full px-3 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 ${context === option.id ? "bg-white text-slate-950" : "bg-white/5 text-slate-300 ring-1 ring-inset ring-white/15 hover:bg-white/10"}`}>{option.label}</button>)}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Appearance</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {(["light", "dark"] as PreviewBackground[]).map(option => <button key={option} type="button" aria-pressed={background === option} onClick={() => setBackground(option)} className={`min-h-10 rounded-xl text-xs font-bold capitalize ring-1 ring-inset transition-colors ${background === option ? "bg-violet-500 text-white ring-violet-400" : "bg-white/5 text-slate-300 ring-white/15"}`}>{option}</button>)}
          </div>
        </fieldset>
        <fieldset className="mt-4">
          <legend className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Behavior</legend>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {STATES.map(option => <button key={option.id} type="button" disabled={reducedMotion} aria-pressed={motionState === option.id} onClick={() => setMotionState(option.id)} className={`min-h-9 rounded-full px-3 text-[11px] font-bold transition-colors disabled:opacity-40 ${motionState === option.id ? "bg-violet-500 text-white" : "bg-white/5 text-slate-300 ring-1 ring-inset ring-white/15"}`}>{option.label}</button>)}
          </div>
        </fieldset>
        <label className="mt-4 flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/10 px-3 text-xs font-bold text-slate-200">
          Reduced-motion preview
          <input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} className="h-4 w-4 accent-violet-500" />
        </label>
        <p aria-live="polite" className="mt-auto pt-4 text-xs font-semibold text-violet-200">{behaviorCopy(effectiveMotion, reducedMotion, context)}</p>
      </div>
    </div>
  )
}
