"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { buildCocktail } from "@/lib/modules"
import { ShuffleIcon, ArrowRightIcon, LayersIcon } from "@/components/icons"
import type { Question } from "@/lib/types"

interface QuantityModalProps {
  open: boolean
  label: string          // Display label (module or discipline name)
  sublabel?: string      // Optional sub-label (e.g. module name when discipline is shown)
  questions: Question[]  // Available question pool (un-shuffled)
  onClose: () => void
  onStart: (questions: Question[]) => void
}

const PRESETS = [10, 20, 50] as const

export function QuantityModal({ open, label, sublabel, questions, onClose, onStart }: QuantityModalProps) {
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState("")
  const [useCustom, setUseCustom] = useState(false)

  const available = questions.length

  function handlePreset(n: number) {
    if (n > available) return
    setUseCustom(false)
    setSelectedPreset(n === selectedPreset ? null : n)
    setCustomValue("")
  }

  function handleAll() {
    setUseCustom(false)
    setSelectedPreset(available)
    setCustomValue("")
  }

  function handleCustomChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value.replace(/[^0-9]/g, "")
    setCustomValue(v)
    setUseCustom(true)
    setSelectedPreset(null)
  }

  function getQuantity(): number | null {
    if (useCustom) {
      const n = parseInt(customValue, 10)
      if (!isNaN(n) && n > 0) return Math.min(n, available)
      return null
    }
    if (selectedPreset !== null) return Math.min(selectedPreset, available)
    return null
  }

  function handleStart() {
    const qty = getQuantity()
    if (qty === null) return
    const cocktail = buildCocktail(questions, qty)
    reset()
    onStart(cocktail)
  }

  function reset() {
    setSelectedPreset(null)
    setCustomValue("")
    setUseCustom(false)
  }

  function handleClose() {
    reset()
    onClose()
  }

  const qty = getQuantity()
  const canStart = qty !== null && qty > 0

  return (
    <Modal open={open} onClose={handleClose} title={label} widthClass="max-w-md">
      <div className="space-y-5">
        {/* Context pill */}
        <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2.5">
          <LayersIcon size={14} className="shrink-0 text-muted-foreground" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">
              {sublabel ? (
                <><span className="font-medium text-foreground">{sublabel}</span> · {label}</>
              ) : (
                <span className="font-medium text-foreground">{label}</span>
              )}
            </p>
          </div>
          <span className="ml-auto shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
            {available} total
          </span>
        </div>

        {/* Preset buttons */}
        <div>
          <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Quick Select
          </p>
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((n) => {
              const enabled = n <= available
              const active = !useCustom && selectedPreset === n
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!enabled}
                  onClick={() => handlePreset(n)}
                  className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all
                    ${active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : enabled
                        ? "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                        : "border-border/40 bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                    }`}
                >
                  {n} Q
                </button>
              )
            })}
            <button
              type="button"
              onClick={handleAll}
              className={`flex-1 rounded-xl border px-4 py-2.5 text-sm font-semibold transition-all
                ${!useCustom && selectedPreset === available && available > 0
                  ? "border-primary bg-primary text-primary-foreground shadow-sm"
                  : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Custom quantity */}
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Custom Quantity
          </p>
          <input
            type="number"
            min={1}
            max={available}
            value={customValue}
            onChange={handleCustomChange}
            placeholder={`1 – ${available}`}
            className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
          />
        </div>

        {/* Shuffle note */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <ShuffleIcon size={13} />
          <span>Questions will be randomly shuffled</span>
        </div>

        {/* CTA */}
        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>Begin {qty !== null ? `${qty} Question${qty === 1 ? "" : "s"}` : "Quiz"}</span>
          <ArrowRightIcon size={15} />
        </button>
      </div>
    </Modal>
  )
}
