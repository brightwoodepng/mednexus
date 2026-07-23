"use client"

import { useEffect, useRef, useState } from "react"
import { BookOpenIcon, CheckIcon, ChevronDownIcon, LockKeyholeIcon, ScrollTextIcon, StethoscopeIcon } from "lucide-react"
import { STUDY_HUBS, type StudyHubId } from "@/components/study-hub-switcher"
import { useTheme } from "@/contexts/theme-context"

function HubIcon({ hub, size = 16 }: { hub: StudyHubId; size?: number }) {
  if (hub === "osce-hub") return <StethoscopeIcon size={size} aria-hidden />
  if (hub === "theory-vault") return <ScrollTextIcon size={size} aria-hidden />
  return <BookOpenIcon size={size} aria-hidden />
}

/**
 * Compact sidebar dropdown for switching study hubs.
 * Driven entirely from the STUDY_HUBS registry — no options hard-coded here.
 */
export function StudyHubDropdown({
  activeHub,
  onSelect,
  onAfterSelect,
}: {
  activeHub: StudyHubId
  onSelect: (hub: StudyHubId) => void
  /** Called after a hub is selected (e.g. close mobile drawer) */
  onAfterSelect?: () => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const { isGlassEnabled } = useTheme()

  const activeHubDef = STUDY_HUBS.find((h) => h.id === activeHub)!

  // Close on click outside
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handler)
    return () => document.removeEventListener("mousedown", handler)
  }, [open])

  // Close on Escape
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
    ? "glass-card hover:glass-pill-active"
    : "border border-sidebar-border bg-sidebar-accent/50 hover:bg-sidebar-accent"

  const menuCls = isGlassEnabled
    ? "glass-card"
    : "border border-sidebar-border bg-card shadow-lg"

  const rowHoverCls = isGlassEnabled ? "hover:glass-pill-active" : "hover:bg-sidebar-accent"

  return (
    <div ref={ref} className="relative w-full">
      {/* ── Trigger ─────────────────────────────────────────────── */}
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring ${triggerCls}`}
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary/15 text-sidebar-primary">
          <HubIcon hub={activeHub} size={15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-xs font-semibold leading-tight text-sidebar-foreground">
            {activeHubDef.name}
          </span>
          <span className="mt-0.5 block text-[10px] leading-tight text-sidebar-foreground/55">
            Switch study workspace
          </span>
        </span>
        <ChevronDownIcon
          size={14}
          className={`shrink-0 text-sidebar-foreground/50 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {/* ── Dropdown menu ───────────────────────────────────────── */}
      {open && (
        <div role="menu" className={`mt-1.5 w-full overflow-hidden rounded-xl ${menuCls}`}>
          {STUDY_HUBS.map((hub) => {
            const active = hub.id === activeHub
            return (
              <button
                key={hub.id}
                role="menuitem"
                type="button"
                disabled={!hub.available}
                onClick={() => hub.available && handleSelect(hub.id)}
                aria-disabled={!hub.available}
                aria-label={!hub.available ? `${hub.name} — coming soon` : hub.name}
                className={`flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring disabled:cursor-not-allowed ${
                  active
                    ? "bg-sidebar-primary/10 text-sidebar-foreground"
                    : hub.available
                      ? `text-sidebar-foreground ${rowHoverCls}`
                      : "text-sidebar-foreground/40"
                }`}
              >
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${
                    active
                      ? "bg-sidebar-primary/20 text-sidebar-primary"
                      : hub.available
                        ? "bg-sidebar-primary/10 text-sidebar-primary"
                        : "bg-muted text-muted-foreground"
                  }`}
                >
                  {hub.available ? (
                    <HubIcon hub={hub.id} size={13} />
                  ) : (
                    <LockKeyholeIcon size={12} aria-hidden />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-xs font-semibold leading-tight">{hub.name}</span>
                  <span className="mt-0.5 block text-[10px] leading-tight text-sidebar-foreground/50">
                    {hub.description}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {active && <CheckIcon size={13} className="text-sidebar-primary" aria-hidden />}
                  {!hub.available && (
                    <span className="rounded-full border border-sidebar-border bg-background/50 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-sidebar-foreground/50">
                      Soon
                    </span>
                  )}
                </span>
              </button>
            )
          })}
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
