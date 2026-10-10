"use client"

import { useEffect, useRef, useState } from "react"
import { Sun, Moon, Check, X } from "lucide-react"
import { useTheme } from "@/contexts/theme-context"
import { THEMES } from "@/lib/themes"

export function AppearanceModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { activeTheme, setActiveTheme, isGlassEnabled, setIsGlassEnabled } = useTheme()
  const [mode, setMode] = useState<"light" | "dark">("light")
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    setMode(THEMES.find(theme => theme.id === activeTheme)?.mode ?? "light")
  }, [open, activeTheme])
  useEffect(() => {
    if (!open) return
    const previousFocus = document.activeElement as HTMLElement | null
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    panel.current?.querySelector<HTMLButtonElement>("button")?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key !== "Tab") return
      const controls = panel.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)")
      if (!controls?.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; previousFocus?.focus() }
  }, [open, onClose])
  if (!open) return null
  return <div data-tutorial-anchor="appearance-modal" role="dialog" aria-modal="true" aria-labelledby="appearance-heading" className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-6">
    <button type="button" aria-label="Close appearance" onClick={onClose} className="absolute inset-0 bg-black/45" />
    <div ref={panel} className="relative flex max-h-[85dvh] w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-border bg-card text-card-foreground shadow-2xl">
      <header className="flex items-center justify-between border-b border-border px-4 py-3"><div><h2 id="appearance-heading" className="text-base font-bold">Appearance</h2><p className="mt-0.5 text-xs text-muted-foreground">Your theme, saved on this device.</p></div><button type="button" onClick={onClose} aria-label="Close" className="flex h-10 w-10 items-center justify-center rounded-xl hover:bg-muted"><X size={18}/></button></header>
      <div className="p-4 pb-2"><div className="grid grid-cols-2 gap-1 rounded-xl bg-muted p-1" aria-label="Theme categories">{(["light", "dark"] as const).map(group => <button key={group} type="button" aria-pressed={mode === group} onClick={() => setMode(group)} className={`flex min-h-10 items-center justify-center gap-2 rounded-lg text-sm font-semibold ${mode === group ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>{group === "light" ? <Sun size={16}/> : <Moon size={16}/>} {group === "light" ? "Light themes" : "Dark themes"}</button>)}</div></div>
      <div data-tutorial-anchor="appearance-theme-grid" className="grid grid-cols-2 gap-3 overflow-y-auto p-4 pt-2">{THEMES.filter(theme => theme.mode === mode).map(theme => <button key={theme.id} type="button" aria-pressed={activeTheme === theme.id} onClick={() => { setActiveTheme(theme.id); window.dispatchEvent(new CustomEvent("mednexus:tutorial-theme-selected", { detail: { themeId: theme.id } })) }} className={`min-w-0 overflow-hidden rounded-xl border text-left ${activeTheme === theme.id ? "border-primary ring-2 ring-primary/25" : "border-border hover:border-primary/50"}`}>
        <div className="relative flex h-16 items-end gap-1.5 p-2.5 sm:h-20" style={{ background: theme.swatch.bg }} aria-hidden="true"><div className="h-full w-4 rounded" style={{ background: theme.swatch.primary }}/><div className="flex h-full flex-1 flex-col justify-center gap-1.5 rounded-lg p-2" style={{ background: theme.swatch.surface }}><div className="h-1.5 w-3/4 rounded" style={{ background: theme.swatch.primary }}/><div className="h-1.5 w-1/2 rounded" style={{ background: theme.swatch.primary, opacity: .35 }}/></div>{activeTheme === theme.id && <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground"><Check size={12}/></span>}</div>
        <div className="p-2.5"><span className="block text-xs font-bold sm:text-sm">{theme.name}</span><span className="mt-1 block text-[11px] leading-snug text-muted-foreground">{theme.description}</span></div>
      </button>)}</div>
      <footer className="flex items-center justify-between gap-3 border-t border-border p-4"><div><p className="text-sm font-semibold">Liquid Glass</p><p className="text-xs text-muted-foreground">Frosted surfaces with your theme.</p></div><button type="button" role="switch" aria-checked={isGlassEnabled} aria-label="Liquid Glass" onClick={() => setIsGlassEnabled(!isGlassEnabled)} className={`relative h-7 w-12 shrink-0 rounded-full ${isGlassEnabled ? "bg-primary" : "bg-muted-foreground/30"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white ${isGlassEnabled ? "right-1" : "left-1"}`} /></button></footer>
    </div>
  </div>
}
