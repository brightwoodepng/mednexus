"use client"

import { Modal } from "@/components/ui/modal"
import { useTheme } from "@/contexts/theme-context"
import { THEMES } from "@/lib/themes"
import { CheckIcon } from "@/components/icons"

interface ThemeModalProps {
  open: boolean
  onClose: () => void
}

export function ThemeModal({ open, onClose }: ThemeModalProps) {
  const { theme, setTheme } = useTheme()

  const light = THEMES.filter((t) => t.mode === "light")
  const dark = THEMES.filter((t) => t.mode === "dark")

  return (
    <Modal open={open} onClose={onClose} title="Choose a Theme" widthClass="max-w-2xl">
      <p className="mb-6 text-sm text-muted-foreground">
        Themes apply instantly and are remembered on this device.
      </p>

      <ThemeGroup label="☀️  Light" themes={light} active={theme} onSelect={setTheme} />
      <ThemeGroup label="🌙  Dark" themes={dark} active={theme} onSelect={setTheme} />
    </Modal>
  )
}

function ThemeGroup({
  label,
  themes,
  active,
  onSelect,
}: {
  label: string
  themes: typeof THEMES
  active: string
  onSelect: (id: (typeof THEMES)[0]["id"]) => void
}) {
  return (
    <div className="mb-6">
      <p className="mb-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {themes.map((t) => {
          const isActive = active === t.id
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onSelect(t.id)}
              className={`group flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "border-border hover:border-primary/40 hover:bg-muted/40"
              }`}
            >
              {/* Color swatch */}
              <div
                className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border border-border shadow-sm"
                style={{ background: t.swatch.bg }}
              >
                {/* Simulated card */}
                <div
                  className="absolute left-2 top-2 h-6 w-9 rounded-lg shadow-sm"
                  style={{ background: t.swatch.surface }}
                />
                {/* Primary chip */}
                <div
                  className="absolute bottom-2 right-2 h-5 w-5 rounded-full shadow"
                  style={{ background: t.swatch.primary }}
                />
                {/* Color stripe */}
                <div
                  className="absolute bottom-0 left-0 right-0 h-1"
                  style={{ background: t.swatch.primary }}
                />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-semibold">{t.name}</h3>
                  {isActive && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">
                      <CheckIcon size={10} /> On
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground text-pretty leading-snug">{t.description}</p>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
