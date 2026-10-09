"use client"

import { useId } from "react"
import { Coins, Dices, Dice5, Flame, GraduationCap, Skull, Swords, Timer, Zap } from "lucide-react"

export type GameLauncherId = "rapid" | "sudden" | "timeatk" | "streak" | "double" | "clash" | "cohort" | "wager" | "djmulti"

const artwork = {
  rapid: { Icon: Zap, from: "#7c3aed", to: "#db2777", accent: "#fde68a" },
  sudden: { Icon: Skull, from: "#be123c", to: "#7c2d12", accent: "#fff1f2" },
  timeatk: { Icon: Timer, from: "#0369a1", to: "#0891b2", accent: "#cffafe" },
  streak: { Icon: Flame, from: "#c2410c", to: "#e11d48", accent: "#fef08a" },
  double: { Icon: Dice5, from: "#4338ca", to: "#7e22ce", accent: "#e9d5ff" },
  clash: { Icon: Swords, from: "#a21caf", to: "#4f46e5", accent: "#f5d0fe" },
  cohort: { Icon: GraduationCap, from: "#047857", to: "#0e7490", accent: "#ccfbf1" },
  wager: { Icon: Coins, from: "#92400e", to: "#c2410c", accent: "#fde68a" },
  djmulti: { Icon: Dices, from: "#5b21b6", to: "#1d4ed8", accent: "#bfdbfe" },
} as const

export function GameLauncherTile({ id, name, onSelect, bestLabel, best = 0 }: {
  id: GameLauncherId; name: string; onSelect: () => void; bestLabel?: string; best?: number
}) {
  const uniqueId = useId().replaceAll(":", "")
  const gradientId = `game-icon-${uniqueId}`
  const { Icon, from, to, accent } = artwork[id]
  return (
    <button type="button" onClick={onSelect} aria-label={`Play ${name}${id === "djmulti" ? " with friends" : ""}`}
      className="group flex min-w-0 flex-col items-center rounded-2xl px-1 py-2 text-center outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background">
      <span className="relative block aspect-square w-full max-w-32 overflow-hidden rounded-[26%] shadow-lg transition-transform duration-200 group-hover:-translate-y-1 group-active:scale-95 motion-reduce:transform-none sm:max-w-36">
        <svg viewBox="0 0 128 128" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <defs><linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1"><stop stopColor={from}/><stop offset="1" stopColor={to}/></linearGradient></defs>
          <rect width="128" height="128" fill={`url(#${gradientId})`}/>
          <circle cx="108" cy="12" r="68" fill="white" opacity=".08"/>
          <circle cx="10" cy="126" r="56" fill="black" opacity=".12"/>
          <circle cx="64" cy="64" r="44" fill="none" stroke="white" strokeOpacity=".13" strokeWidth="1"/>
          <path d="M17 29h10M22 24v10M102 93h10M107 88v10" stroke={accent} strokeOpacity=".65" strokeWidth="2" strokeLinecap="round"/>
          <circle cx="99" cy="28" r="3" fill={accent} opacity=".75"/>
          <circle cx="25" cy="99" r="2" fill="white" opacity=".5"/>
          <path d="M16 112h96" stroke="white" strokeOpacity=".12" strokeWidth="2"/>
        </svg>
        <span className="absolute inset-0 flex items-center justify-center">
          <Icon aria-hidden="true" className="h-[52%] w-[52%] drop-shadow-lg" style={{ color: accent }} strokeWidth={1.8}/>
        </span>
        <span className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-white/20"/>
        {id === "djmulti" && <span aria-hidden="true" className="absolute bottom-2 right-2 rounded-full bg-white/20 px-1.5 py-0.5 text-[9px] font-black text-white">VS</span>}
      </span>
      <span className="mt-3 w-full break-words text-xs font-bold leading-snug text-foreground sm:text-sm">{name}</span>
      {id === "djmulti" && <span className="mt-0.5 text-[10px] text-muted-foreground">With friends</span>}
      {best > 0 && bestLabel && <span className="mt-1 max-w-full text-[10px] leading-snug text-muted-foreground">{bestLabel}: <span className="font-semibold tabular-nums">{best.toLocaleString()}</span></span>}
    </button>
  )
}
