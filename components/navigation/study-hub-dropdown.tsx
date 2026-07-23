"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpenIcon, ChevronDownIcon, LockKeyholeIcon, ScrollTextIcon, StethoscopeIcon } from "lucide-react"
import { STUDY_HUBS, type StudyHubId } from "@/components/study-hub-switcher"
import { useTheme } from "@/contexts/theme-context"

function HubIcon({ hub, size = 16 }: { hub: StudyHubId; size?: number }) {
  if (hub === "osce-hub") return <StethoscopeIcon size={size} aria-hidden />
  if (hub === "theory-vault") return <ScrollTextIcon size={size} aria-hidden />
  return <BookOpenIcon size={size} aria-hidden />
}

/**
 * Compact header-bar trigger + floating overlay dropdown for switching study hubs.
 * The menu is position:absolute so it overlays sidebar content without pushing it down.
 * Parent must have position:relative and must NOT have overflow:hidden.
 */
export function StudyHubDropdown({
  activeHub,
  onSelect,
  onAfterSelect,
}: {
  activeHub: StudyHubId
  onSelect: (hub: StudyHubId) => void
  onAfterSelect?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { isGlassEnabled } = useTheme()

  const activeHubDef = STUDY_HUBS.find((h) => h.id === activeHub)!

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  useEffect(() => {
    if (!open) return
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("keydown", handler)
    return () => document.removeEventListener("keydown", handler)
  }, [open])

  function handleSelect(id: StudyHubId) {
    onSelect(id)
    setOpen(false)
    onAfterSelect?.()
  }

  const triggerCls = isGlassEnabled
    ? "hover:glass-pill-active"
    : "hover:bg-sidebar-accent"

  const menuCls = isGlassEnabled
    ? "glass-card"
    : "border border-sidebar-border bg-card shadow-xl"

  const rowHoverCls = isGlassEnabled ? "hover:glass-pill-active" : "hover:bg-sidebar-accent"

  return (
    <div ref={ref} className="relative min-w-0 flex-1">
      {/* ── Trigger (compact, fits in header bar) ── */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${triggerCls}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
          <HubIcon hub={activeHub} size={18} />
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-sidebar-foreground">
          {activeHubDef.name}
        </span>
        <ChevronDownIcon
          size={13}
          className={`shrink-0 text-sidebar-foreground/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {/* ── Floating overlay menu ── */}
      {open && (
        <div
          role="menu"
          className={`absolute left-0 right-0 top-full z-50 mt-1.5 overflow-hidden rounded-xl ${menuCls}`}
        >
          {STUDY_HUBS.filter((hub) => hub.id !== activeHub).map((hub) => (
            <button
              key={hub.id}
              role="menuitem"
              type="button"
              disabled={!hub.available}
              onClick={() => hub.available && handleSelect(hub.id)}
              aria-disabled={!hub.available}
              aria-label={!hub.available ? `${hub.name} — coming soon` : hub.name}
              className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:cursor-not-allowed ${
                hub.available
                  ? `text-sidebar-foreground ${rowHoverCls}`
                  : "text-sidebar-foreground/40"
              }`}
            >
              <span className={`shrink-0 ${hub.available ? "text-sidebar-foreground" : "text-muted-foreground"}`}>
                {hub.available ? <HubIcon hub={hub.id} size={18} /> : <LockKeyholeIcon size={18} aria-hidden />}
              </span>
              <span className="min-w-0 flex-1 leading-tight">{hub.name}</span>
              {!hub.available && (
                <span className="shrink-0 rounded-full border border-sidebar-border bg-background/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sidebar-foreground/50">
                  Soon
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

/**
 * Icon-only variant for the collapsed sidebar.
 * Shows the current hub icon; clicking expands the sidebar so the full dropdown is accessible.
 */
export function StudyHubDropdownIcon({
  activeHub,
  onExpand,
}: {
  activeHub: StudyHubId
  onExpand: () => void
}) {
  const { isGlassEnabled } = useTheme()
  const activeHubDef = STUDY_HUBS.find((h) => h.id === activeHub)!

  return (
    <button
      type="button"
      onClick={onExpand}
      title={activeHubDef.name}
      aria-label={`Current hub: ${activeHubDef.name} — expand sidebar to switch`}
      className={`flex h-9 w-9 items-center justify-center rounded-xl text-sidebar-primary transition-colors ${
        isGlassEnabled ? "glass-pill-hover" : "border border-sidebar-border hover:bg-sidebar-accent"
      }`}
    >
      <HubIcon hub={activeHub} size={16} />
    </button>
  )
}
