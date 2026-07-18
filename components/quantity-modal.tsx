"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { buildCocktail } from "@/lib/modules"
import { ShuffleIcon, ArrowRightIcon, LayersIcon, HashIcon, ZapIcon, SparklesIcon } from "@/components/icons"
import type { Question, QuizMode } from "@/lib/types"

interface QuantityModalProps {
  open: boolean
  label: string
  sublabel?: string
  questions: Question[]
  mode?: QuizMode
  onClose: () => void
  onStart: (questions: Question[], gamificationEnabled: boolean) => void
}

type Step = "setup" | "gamification"

const PRESETS = [10, 20, 50, 75, 100, 150] as const
type Tab = "quantity" | "range"

export function QuantityModal({ open, label, sublabel, questions, mode, onClose, onStart }: QuantityModalProps) {
  const [step, setStep] = useState<Step>("setup")
  const [pendingQuestions, setPendingQuestions] = useState<Question[] | null>(null)
  const [tab, setTab] = useState<Tab>("quantity")

  // — Quantity tab state —
  const [selectedPreset, setSelectedPreset] = useState<number | null>(null)
  const [customValue, setCustomValue] = useState("")
  const [useCustom, setUseCustom] = useState(false)

  // — Range tab state —
  const [rangeStart, setRangeStart] = useState("")
  const [rangeEnd, setRangeEnd] = useState("")

  const available = questions.length

  // ── Quantity helpers ──
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

  // "All" is only true when the dedicated "All" button is active (not a custom
  // value that happens to equal the total, nor a preset that equals it).
  const isAllSelected = !useCustom && selectedPreset === available && available > 0

  // ── Range helpers ──
  function getRangeSlice(): Question[] | null {
    const s = parseInt(rangeStart, 10)
    const e = parseInt(rangeEnd, 10)
    if (isNaN(s) || isNaN(e)) return null
    if (s < 1 || e > available || s > e) return null
    return questions.slice(s - 1, e)
  }

  // ── Start handlers ──
  function handleStart() {
    let result: Question[]
    if (tab === "quantity") {
      const qty = getQuantity()
      if (qty === null) return
      result = isAllSelected ? questions.slice(0, qty) : buildCocktail(questions, qty)
    } else {
      const slice = getRangeSlice()
      if (!slice || slice.length === 0) return
      result = slice
    }

    // Trial mode: intercept and show gamification prompt
    if (mode === "trial") {
      setPendingQuestions(result)
      setStep("gamification")
    } else {
      reset()
      onStart(result, false)
    }
  }

  function handleGamificationChoice(enabled: boolean) {
    if (!pendingQuestions) return
    const qs = pendingQuestions
    reset()
    onStart(qs, enabled)
  }

  function reset() {
    setStep("setup")
    setPendingQuestions(null)
    setSelectedPreset(null)
    setCustomValue("")
    setUseCustom(false)
    setRangeStart("")
    setRangeEnd("")
    setTab("quantity")
  }

  function handleClose() { reset(); onClose() }

  const qty = getQuantity()
  const rangeSlice = getRangeSlice()
  const canStart = tab === "quantity" ? (qty !== null && qty > 0) : (rangeSlice !== null && rangeSlice.length > 0)

  const startLabel = tab === "quantity"
    ? (qty !== null ? `Begin ${qty} Question${qty === 1 ? "" : "s"}` : "Begin Quiz")
    : (rangeSlice ? `Begin Q${rangeStart}–Q${rangeEnd} (${rangeSlice.length})` : "Begin Quiz")

  // ── Gamification prompt step ──
  if (step === "gamification") {
    const count = pendingQuestions?.length ?? 0
    return (
      <Modal open={open} onClose={handleClose} title="Enable Gamification?" widthClass="max-w-sm">
        <div className="flex flex-col items-center gap-6 py-2">
          {/* Icon badge */}
          <div className="relative flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-violet-500/20 via-primary/20 to-cyan-500/20 backdrop-blur-sm ring-1 ring-white/10">
            <ZapIcon size={38} className="text-primary drop-shadow-sm" />
            <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground shadow">
              <SparklesIcon size={10} />
            </span>
          </div>

          {/* Copy */}
          <div className="space-y-2 text-center">
            <p className="text-sm font-medium text-foreground leading-relaxed">
              Level up your <span className="font-semibold text-primary">{count}-question</span> session with streaks, milestone rewards, and cheer animations.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Prefer a distraction-free environment? Choose <span className="font-medium">No</span> for a clean, focused experience.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {["🔥 Streaks", "🏆 Milestones", "✨ Cheer Effects"].map((f) => (
              <span key={f} className="rounded-full border border-primary/20 bg-primary/8 px-3 py-1 text-xs font-medium text-primary">
                {f}
              </span>
            ))}
          </div>

          {/* Choice buttons */}
          <div className="grid w-full grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => handleGamificationChoice(false)}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl border border-border bg-card px-4 py-3 text-sm font-semibold text-foreground transition-all hover:border-border/60 hover:bg-muted active:scale-[0.97]"
            >
              No, focus mode
            </button>
            <button
              type="button"
              onClick={() => handleGamificationChoice(true)}
              className="flex min-h-14 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/30 transition-all hover:bg-primary/90 active:scale-[0.97]"
            >
              <ZapIcon size={14} />
              Yes, let&apos;s go!
            </button>
          </div>
        </div>
      </Modal>
    )
  }

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

        {/* Tab switcher */}
        <div className="flex rounded-xl border border-border bg-muted p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setTab("quantity")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "quantity" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ShuffleIcon size={12} />
            By Quantity
          </button>
          <button
            type="button"
            onClick={() => setTab("range")}
            className={`flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-semibold transition-all ${
              tab === "range" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <HashIcon size={12} />
            By Range
          </button>
        </div>

        {tab === "quantity" ? (
          <>
            {/* Preset buttons */}
            <div>
              <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Quick Select
              </p>
              <div className="grid grid-cols-3 gap-2">
                {PRESETS.map((n) => {
                  const enabled = n <= available
                  const active = !useCustom && selectedPreset === n
                  return (
                    <button
                      key={n}
                      type="button"
                      disabled={!enabled}
                      onClick={() => handlePreset(n)}
                      className={`rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all
                        ${active
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : enabled
                            ? "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                            : "border-border/40 bg-muted/30 text-muted-foreground/40 cursor-not-allowed"
                        }`}
                    >
                      {n}
                    </button>
                  )
                })}
                <button
                  type="button"
                  onClick={handleAll}
                  className={`col-span-3 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all
                    ${isAllSelected
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-card text-foreground hover:border-primary/40 hover:bg-muted"
                    }`}
                >
                  All ({available})
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
                placeholder={`Enter 1 – ${available}`}
                className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {isAllSelected ? (
                <>
                  <HashIcon size={13} />
                  <span>All questions selected — answered in their original order, no shuffle</span>
                </>
              ) : (
                <>
                  <ShuffleIcon size={13} />
                  <span>Questions will be randomly shuffled</span>
                </>
              )}
            </div>
          </>
        ) : (
          <>
            {/* Range mode */}
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Question Number Range
              </p>
              <p className="mb-3 text-xs text-muted-foreground">
                Select questions by their position in this set (1 – {available}). Questions are answered in order, not shuffled.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">Start #</label>
                  <input
                    type="number"
                    min={1}
                    max={available}
                    value={rangeStart}
                    onChange={(e) => setRangeStart(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="e.g. 1"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-medium text-muted-foreground">End #</label>
                  <input
                    type="number"
                    min={1}
                    max={available}
                    value={rangeEnd}
                    onChange={(e) => setRangeEnd(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder={`e.g. ${available}`}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
                  />
                </div>
              </div>

              {/* Range preview */}
              {rangeSlice !== null ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-emerald-200/80 bg-emerald-50/60 px-3 py-2.5 dark:border-emerald-800/40 dark:bg-emerald-900/20">
                  <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
                    ✓ {rangeSlice.length} question{rangeSlice.length !== 1 ? "s" : ""} selected (Q{rangeStart}–Q{rangeEnd})
                  </span>
                </div>
              ) : rangeStart && rangeEnd ? (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-rose-200/80 bg-rose-50/60 px-3 py-2.5 dark:border-rose-800/40 dark:bg-rose-900/20">
                  <span className="text-xs font-semibold text-rose-700 dark:text-rose-400">
                    Invalid range. Start must be ≤ End, both within 1–{available}.
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <HashIcon size={13} />
              <span>Questions answered in their original order — no shuffle</span>
            </div>
          </>
        )}

        {/* CTA */}
        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          className="flex min-h-14 w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <span>{startLabel}</span>
          <ArrowRightIcon size={15} />
        </button>
      </div>
    </Modal>
  )
}
