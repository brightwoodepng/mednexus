"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useQuestions } from "@/contexts/questions-context"
import { useAdmin } from "@/contexts/admin-context"
import { PdfImportModal } from "@/components/pdf-import-modal"
import { WordImportModal } from "@/components/word-import-modal"
import type { Question, QuestionOption, ModuleStatus } from "@/lib/types"
import {
  TrashIcon, PencilIcon, PlusIcon, XIcon, CheckIcon, DatabaseIcon,
  RefreshCwIcon, AlertTriangleIcon, CheckSquareIcon, DownloadIcon,
  SearchIcon, ChevronDownIcon, ChevronRightIcon, LayersIcon, BookOpenIcon,
} from "@/components/icons"

// ─────────────────────────────────────────────────────────────────────────────
// Inline icons not yet in icons.tsx
// ─────────────────────────────────────────────────────────────────────────────
function UploadIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}
function WordIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="10" y2="13" /><line x1="8" y1="17" x2="14" y2="17" /><polyline points="8 9 10 13 12 9 14 13 16 9" />
    </svg>
  )
}
function EyeIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}
function SparkleIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  )
}
function FilterIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  )
}
function FolderIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// ConfirmDialog
// ─────────────────────────────────────────────────────────────────────────────
function ConfirmDialog({ title, message, confirmLabel, onConfirm, onCancel, danger }: {
  title: string; message: string; confirmLabel: string
  onConfirm: () => void; onCancel: () => void; danger?: boolean
}) {
  return (
    <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="glass-modal w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
            <AlertTriangleIcon size={20} />
          </div>
          <div>
            <h3 className="font-bold text-foreground">{title}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{message}</p>
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">Cancel</button>
          <button type="button" onClick={onConfirm} className={`rounded-xl px-4 py-2 text-sm font-medium text-white transition-colors ${danger ? "bg-destructive hover:bg-destructive/90" : "bg-primary hover:bg-primary/90"}`}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Save status pill
// ─────────────────────────────────────────────────────────────────────────────
type SaveStatus = "idle" | "saving" | "saved" | "error"
function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null
  const cfg = {
    saving: { label: "Saving…",  cls: "bg-muted text-muted-foreground border-border" },
    saved:  { label: "Saved ✓",  cls: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/40" },
    error:  { label: "Save failed", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  }[status]
  return <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${cfg.cls}`}>{cfg.label}</span>
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Form (Add / Edit)
// ─────────────────────────────────────────────────────────────────────────────
const EMPTY_FORM = {
  module: "", subject: "", vignette: "",
  optA: "", optB: "", optC: "", optD: "", optE: "",
  correctAnswer: "A",
  objective: "", details: "", incorrectReasoning: "",
}
type FormState = typeof EMPTY_FORM

function questionToForm(q: Question): FormState {
  const opts: Record<string, string> = {}
  for (const o of q.options) opts[`opt${o.id}`] = o.text
  return {
    module: q.module ?? "",
    subject: q.subject, vignette: q.vignette,
    optA: opts.optA ?? "", optB: opts.optB ?? "",
    optC: opts.optC ?? "", optD: opts.optD ?? "", optE: opts.optE ?? "",
    correctAnswer: q.correctAnswer ?? "",
    objective: q.explanation?.objective ?? "",
    details: q.explanation?.details ?? "",
    incorrectReasoning: q.explanation?.incorrectReasoning ?? "",
  }
}

function formToQuestion(f: FormState, id: string): Question {
  const options: QuestionOption[] = [
    { id: "A", text: f.optA }, { id: "B", text: f.optB },
    { id: "C", text: f.optC }, { id: "D", text: f.optD },
  ]
  if (f.optE.trim()) options.push({ id: "E", text: f.optE })
  // Normalize: an empty correctAnswer from the form means "not yet set" (draft).
  const correctAnswer = f.correctAnswer.trim() || null

  // Normalize: if every explanation field is blank, keep explanation as null
  // (preserves the draft semantic rather than storing an all-empty object).
  const objective = f.objective.trim()
  const details = f.details.trim()
  const incorrectReasoning = f.incorrectReasoning.trim()
  const explanation =
    objective || details || incorrectReasoning
      ? { objective, details, incorrectReasoning }
      : null

  const q: Question = {
    id, subject: f.subject.trim(), vignette: f.vignette.trim(), options,
    correctAnswer,
    explanation,
  }
  if (f.module.trim()) q.module = f.module.trim()
  return q
}

function QuestionForm({ initial, questionId, defaultModule, defaultSubject, adminToken, onSave, onCancel }: {
  initial?: Question; questionId: string; defaultModule: string; defaultSubject: string
  adminToken: string | null; onSave: (q: Question) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(
    initial ? questionToForm(initial) : { ...EMPTY_FORM, module: defaultModule, subject: defaultSubject }
  )
  function set(key: keyof FormState, val: string) { setForm((f) => ({ ...f, [key]: val })) }

  const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
  const labelCls = "block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1"

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!form.subject.trim() || !form.vignette.trim() || !form.optA.trim() || !form.optB.trim()) return; onSave(formToQuestion(form, questionId)) }} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Module <span className="normal-case font-normal">(optional)</span></label>
          <input className={inputCls} value={form.module} onChange={(e) => set("module", e.target.value)} placeholder="e.g. Level 400 Clinicals" />
        </div>
        <div>
          <label className={labelCls}>Discipline *</label>
          <input className={inputCls} value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Internal Medicine" required />
        </div>
      </div>
      <div>
        <label className={labelCls}>Clinical Vignette *</label>
        <textarea className={inputCls} rows={4} value={form.vignette} onChange={(e) => set("vignette", e.target.value)} placeholder="A 55-year-old man presents with…" required />
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["A", "B", "C", "D", "E"] as const).map((letter) => (
          <div key={letter}>
            <label className={labelCls}>Option {letter}{letter === "E" ? " (optional)" : " *"}</label>
            <input className={inputCls} value={form[`opt${letter}` as keyof FormState] as string} onChange={(e) => set(`opt${letter}` as keyof FormState, e.target.value)} placeholder={`Option ${letter}`} required={letter !== "E"} />
          </div>
        ))}
      </div>
      <div>
        <label className={labelCls}>Correct Answer</label>
        <div className="flex gap-2 flex-wrap">
          {["A", "B", "C", "D", "E"].map((l) => (
            <button key={l} type="button" onClick={() => set("correctAnswer", l)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold transition-colors ${form.correctAnswer === l ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:bg-muted"}`}
            >{l}</button>
          ))}
        </div>
      </div>
      <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Explanation</p>
        </div>
        <div>
          <label className={labelCls}>Objective</label>
          <input className={inputCls} value={form.objective} onChange={(e) => set("objective", e.target.value)} placeholder="What concept is tested?" />
        </div>
        <div>
          <label className={labelCls}>Why correct answer is right</label>
          <textarea className={inputCls} rows={2} value={form.details} onChange={(e) => set("details", e.target.value)} placeholder="Detailed explanation…" />
        </div>
        <div>
          <label className={labelCls}>Why distractors are wrong</label>
          <textarea className={inputCls} rows={2} value={form.incorrectReasoning} onChange={(e) => set("incorrectReasoning", e.target.value)} placeholder="Common misconceptions…" />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          <CheckIcon size={14} /> Save Question
        </button>
      </div>
    </form>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Hierarchy data types
// ─────────────────────────────────────────────────────────────────────────────
interface QItem { q: Question; isDraft: boolean }
interface DiscGroup { name: string; items: QItem[] }
interface ModGroup { name: string; disciplines: DiscGroup[]; total: number; draftCount: number; moduleStatus: ModuleStatus }

function getModuleKey(q: Question): string { return q.module?.trim() || q.subject }
function getModuleStatus(qs: Question[]): ModuleStatus { return qs[0]?.moduleStatus ?? "live" }

function buildHierarchy(live: Question[], drafts: Question[], search: string, filter: "all" | "live" | "draft"): ModGroup[] {
  const combined: QItem[] = [
    ...live.map((q) => ({ q, isDraft: false })),
    ...drafts.map((q) => ({ q, isDraft: true })),
  ]
  const q = search.trim().toLowerCase()
  const filtered = combined.filter(({ q: item, isDraft }) => {
    if (filter === "live" && isDraft) return false
    if (filter === "draft" && !isDraft) return false
    if (!q) return true
    const num = String(live.indexOf(item) + 1)
    return (
      item.vignette.toLowerCase().includes(q) ||
      item.subject.toLowerCase().includes(q) ||
      getModuleKey(item).toLowerCase().includes(q) ||
      num.includes(q) ||
      item.options.some((o) => o.text.toLowerCase().includes(q)) ||
      (item.explanation?.objective ?? "").toLowerCase().includes(q) ||
      (item.explanation?.details ?? "").toLowerCase().includes(q)
    )
  })

  const modMap = new Map<string, Map<string, QItem[]>>()
  for (const item of filtered) {
    const mod = getModuleKey(item.q)
    const disc = item.q.subject
    if (!modMap.has(mod)) modMap.set(mod, new Map())
    const dm = modMap.get(mod)!
    if (!dm.has(disc)) dm.set(disc, [])
    dm.get(disc)!.push(item)
  }

  return Array.from(modMap.entries())
    .map(([mod, dm]) => {
      const disciplines = Array.from(dm.entries()).map(([disc, items]) => ({ name: disc, items })).sort((a, b) => a.name.localeCompare(b.name))
      const total = disciplines.reduce((s, d) => s + d.items.length, 0)
      const draftCount = disciplines.reduce((s, d) => s + d.items.filter((i) => i.isDraft).length, 0)
      const allQs = disciplines.flatMap((d) => d.items.map((i) => i.q))
      const moduleStatus = getModuleStatus(allQs)
      return { name: mod, disciplines, total, draftCount, moduleStatus }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─────────────────────────────────────────────────────────────────────────────
// Review Drawer (slide-out from right)
// ─────────────────────────────────────────────────────────────────────────────
interface DrawerForm {
  module: string; subject: string; vignette: string
  optA: string; optB: string; optC: string; optD: string; optE: string
  correctAnswer: string
  objective: string; details: string; incorrectReasoning: string
}

function drawerFormFromQ(q: Question): DrawerForm {
  const opts: Record<string, string> = {}
  for (const o of q.options) opts[`opt${o.id}`] = o.text
  return {
    module: q.module ?? "",
    subject: q.subject,
    vignette: q.vignette,
    optA: opts.optA ?? "", optB: opts.optB ?? "",
    optC: opts.optC ?? "", optD: opts.optD ?? "", optE: opts.optE ?? "",
    correctAnswer: q.correctAnswer ?? "",
    objective: q.explanation?.objective ?? "",
    details: q.explanation?.details ?? "",
    incorrectReasoning: q.explanation?.incorrectReasoning ?? "",
  }
}

function drawerFormToQ(f: DrawerForm, original: Question): Question {
  const options: QuestionOption[] = [
    { id: "A", text: f.optA }, { id: "B", text: f.optB },
    { id: "C", text: f.optC }, { id: "D", text: f.optD },
  ]
  if (f.optE.trim()) options.push({ id: "E", text: f.optE })
  const correctAnswer = f.correctAnswer.trim() || null
  const objective = f.objective.trim()
  const details = f.details.trim()
  const incorrectReasoning = f.incorrectReasoning.trim()
  const explanation = objective || details || incorrectReasoning
    ? { objective, details, incorrectReasoning } : null
  return {
    ...original,
    module: f.module.trim() || undefined,
    subject: f.subject.trim(),
    vignette: f.vignette.trim(),
    options,
    correctAnswer,
    explanation,
  }
}

function ReviewDrawer({ item, onClose, onApprove, onSave }: {
  item: { q: Question; isDraft: boolean }
  onClose: () => void
  onApprove: (q: Question) => void
  onSave: (q: Question) => void
}) {
  const { q, isDraft } = item
  const [form, setForm] = useState<DrawerForm>(() => drawerFormFromQ(q))
  const [saving, setSaving] = useState(false)

  function set(key: keyof DrawerForm, val: string) { setForm((f) => ({ ...f, [key]: val })) }

  const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
  const labelCls = "block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1"

  const isDirty = JSON.stringify(form) !== JSON.stringify(drawerFormFromQ(q))
  const canApprove = form.vignette.trim() && form.optA.trim() && form.optB.trim() && form.correctAnswer.trim()

  async function handleApprove() {
    setSaving(true)
    const updated = drawerFormToQ(form, q)
    await onApprove(updated)
    setSaving(false)
    onClose()
  }

  async function handleSave() {
    setSaving(true)
    const updated = drawerFormToQ(form, q)
    await onSave(updated)
    setSaving(false)
    onClose()
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-foreground/30 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex w-full max-w-2xl flex-col bg-card border-l border-border shadow-2xl">
        {/* Header */}
        <div className="flex shrink-0 items-center justify-between border-b border-border px-6 py-4">
          <div className="flex items-center gap-2.5">
            {isDraft ? (
              <span className="flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Draft — Pending Review
              </span>
            ) : (
              <span className="flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[11px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" /> Live
              </span>
            )}
            <h2 className="text-base font-bold text-foreground">
              {isDraft ? "Review Question" : "Edit Question"}
            </h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
            <XIcon size={18} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* Meta row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Module</label>
              <input className={inputCls} value={form.module} onChange={(e) => set("module", e.target.value)} placeholder="e.g. Level 400 Clinicals" />
            </div>
            <div>
              <label className={labelCls}>Discipline *</label>
              <input className={inputCls} value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Internal Medicine" />
            </div>
          </div>

          {/* Context content preview */}
          {q.contextContent && (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-primary uppercase tracking-wide">
                <EyeIcon size={12} /> Shared Clinical Context
              </div>
              <div
                className="prose prose-sm max-w-none text-foreground text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: q.contextContent }}
              />
            </div>
          )}

          {/* Stem */}
          <div>
            <label className={labelCls}>Question Stem *</label>
            <textarea
              className={inputCls}
              rows={5}
              value={form.vignette}
              onChange={(e) => set("vignette", e.target.value)}
              placeholder="A 55-year-old man presents with…"
            />
          </div>

          {/* Options */}
          <div>
            <label className={labelCls}>Answer Options *</label>
            <div className="space-y-2">
              {(["A", "B", "C", "D", "E"] as const).map((letter) => (
                <div key={letter} className="flex items-center gap-2">
                  <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-xs font-bold border-2 transition-colors ${form.correctAnswer === letter ? "bg-primary border-primary text-primary-foreground" : "border-border text-muted-foreground"}`}>
                    {letter}
                  </span>
                  <input
                    className={inputCls}
                    value={form[`opt${letter}` as keyof DrawerForm] as string}
                    onChange={(e) => set(`opt${letter}` as keyof DrawerForm, e.target.value)}
                    placeholder={letter === "E" ? "Option E (optional)" : `Option ${letter} *`}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Correct answer */}
          <div>
            <label className={labelCls}>
              Correct Answer
              {!form.correctAnswer && (
                <span className="ml-2 normal-case font-normal text-amber-600">— required before approving</span>
              )}
            </label>
            <div className="flex gap-2 flex-wrap">
              {["A", "B", "C", "D", "E"].map((l) => (
                <button key={l} type="button" onClick={() => set("correctAnswer", form.correctAnswer === l ? "" : l)}
                  className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold transition-colors ${form.correctAnswer === l ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:bg-muted"}`}
                >{l}</button>
              ))}
              {form.correctAnswer && (
                <button type="button" onClick={() => set("correctAnswer", "")}
                  className="flex h-9 items-center rounded-xl border border-border px-3 text-xs text-muted-foreground hover:bg-muted transition-colors"
                >Clear</button>
              )}
            </div>
          </div>

          {/* Explanation */}
          <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
            <div className="flex items-center gap-1.5">
              <SparkleIcon size={12} />
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Explanation</p>
              {!form.objective && !form.details && (
                <span className="ml-1 text-[10px] font-medium text-amber-600 normal-case">not yet written</span>
              )}
            </div>
            <div>
              <label className={labelCls}>Objective</label>
              <input className={inputCls} value={form.objective} onChange={(e) => set("objective", e.target.value)} placeholder="What concept is tested?" />
            </div>
            <div>
              <label className={labelCls}>Why the correct answer is right</label>
              <textarea className={inputCls} rows={3} value={form.details} onChange={(e) => set("details", e.target.value)} placeholder="Detailed explanation of the correct answer…" />
            </div>
            <div>
              <label className={labelCls}>Why distractors are wrong</label>
              <textarea className={inputCls} rows={3} value={form.incorrectReasoning} onChange={(e) => set("incorrectReasoning", e.target.value)} placeholder="Common misconceptions and why each wrong option fails…" />
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-border bg-card px-6 py-4">
          {isDraft ? (
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">
                Close
              </button>
              <div className="flex-1" />
              <button
                type="button"
                disabled={!canApprove || saving}
                onClick={handleApprove}
                className="flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckIcon size={15} />
                {saving ? "Approving…" : "Approve & Make Live"}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">
                Cancel
              </button>
              <div className="flex-1" />
              <button
                type="button"
                disabled={!isDirty || saving}
                onClick={handleSave}
                className="flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <CheckIcon size={15} />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Card
// ─────────────────────────────────────────────────────────────────────────────
function QuestionCard({ item, questionNumber, isSelected, onToggle, onEdit, onDelete, onReview }: {
  item: QItem; questionNumber: number; isSelected: boolean
  onToggle: () => void; onEdit: () => void; onDelete: () => void; onReview: () => void
}) {
  const { q, isDraft } = item
  return (
    <div className={`flex items-start gap-3 border-b border-border/50 px-6 py-3.5 transition-colors last:border-b-0 ${isSelected ? "bg-primary/4" : "hover:bg-muted/30"} ${isDraft ? "bg-amber-50/40 dark:bg-amber-900/10" : ""}`}>
      <button type="button" onClick={onToggle}
        className={`mt-0.5 flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border-2 transition-colors ${isSelected ? "bg-primary border-primary text-primary-foreground" : "border-border hover:border-primary/40"}`}
        style={{ width: 18, height: 18 }}
      >
        {isSelected && <CheckIcon size={10} />}
      </button>

      <button type="button" onClick={onReview} className="flex-1 min-w-0 text-left">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Q{questionNumber}</span>
          {isDraft ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</span>
          ) : (
            <span className="flex items-center gap-0.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              <span className="h-1 w-1 rounded-full bg-emerald-500" /> Live
            </span>
          )}
          {q.correctAnswer && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{q.correctAnswer}</span>
          )}
          {!q.correctAnswer && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">No answer set</span>
          )}
          {!q.explanation && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">No explanation</span>
          )}
        </div>
        <p className="line-clamp-2 text-sm text-foreground">{q.vignette}</p>
        <div className="mt-1.5 flex flex-wrap gap-3">
          {q.options.map((o) => (
            <span key={o.id} className={`text-xs ${o.id === q.correctAnswer ? "font-semibold text-primary" : "text-muted-foreground"}`}>
              {o.id}. {o.text.slice(0, 28)}{o.text.length > 28 ? "…" : ""}
            </span>
          ))}
        </div>
      </button>

      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Edit in modal">
          <PencilIcon size={13} />
        </button>
        <button type="button" onClick={onDelete} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors" aria-label="Delete">
          <TrashIcon size={13} />
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Discipline Section
// ─────────────────────────────────────────────────────────────────────────────
function DisciplineSection({ group, moduleName, selectedIds, onToggleItem, onToggleAll, onEdit, onDelete, onAddQuestion, onReview, forceExpand, qOffset, isExpanded, onToggleExpand }: {
  group: DiscGroup; moduleName: string; selectedIds: Set<string>
  onToggleItem: (id: string) => void; onToggleAll: (ids: string[], select: boolean) => void
  onEdit: (q: Question, isDraft: boolean) => void; onDelete: (q: Question, isDraft: boolean) => void
  onReview: (q: Question, isDraft: boolean) => void
  onAddQuestion: (mod: string, disc: string) => void; forceExpand: boolean; qOffset: number
  isExpanded: boolean; onToggleExpand: () => void
}) {
  const ids = group.items.map((i) => i.q.id)
  const allSelected = ids.every((id) => selectedIds.has(id))
  const someSelected = ids.some((id) => selectedIds.has(id))
  const draftCount = group.items.filter((i) => i.isDraft).length

  return (
    <div className="border-b border-border/60 last:border-b-0">
      {/* Discipline header */}
      <div className="flex items-center gap-2 bg-muted/20 px-4 py-2.5">
        <button type="button" onClick={() => onToggleAll(ids, !allSelected)}
          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${allSelected ? "bg-primary border-primary text-primary-foreground" : someSelected ? "border-primary" : "border-border hover:border-primary/40"}`}
          style={{ width: 16, height: 16 }}
        >
          {allSelected ? <CheckIcon size={9} /> : someSelected ? <span style={{ width: 6, height: 2, background: "currentColor", borderRadius: 1, display: "block" }} /> : null}
        </button>
        <button type="button" onClick={onToggleExpand} className="flex items-center gap-1.5 min-w-0">
          {isExpanded ? <ChevronDownIcon size={13} className="text-muted-foreground" /> : <ChevronRightIcon size={13} className="text-muted-foreground" />}
          <BookOpenIcon size={13} className="text-muted-foreground shrink-0" />
          <span className="text-sm font-medium text-foreground truncate">{group.name}</span>
        </button>
        <div className="ml-1 flex items-center gap-1.5 shrink-0">
          <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">{group.items.length}Q</span>
          {draftCount > 0 && (
            <span className="rounded-full bg-amber-100/80 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{draftCount} draft</span>
          )}
        </div>
        <button type="button" onClick={() => onAddQuestion(moduleName, group.name)}
          className="ml-auto flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors shrink-0"
        >
          <PlusIcon size={11} /> Add
        </button>
      </div>

      {/* Questions */}
      {(isExpanded || forceExpand) && (
        <div>
          {group.items.map((item, i) => (
            <QuestionCard
              key={item.q.id}
              item={item}
              questionNumber={qOffset + i + 1}
              isSelected={selectedIds.has(item.q.id)}
              onToggle={() => onToggleItem(item.q.id)}
              onEdit={() => onEdit(item.q, item.isDraft)}
              onDelete={() => onDelete(item.q, item.isDraft)}
              onReview={() => onReview(item.q, item.isDraft)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Status Badge & Picker
// ─────────────────────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<ModuleStatus, { label: string; cls: string; dotCls: string }> = {
  live:    { label: "Live",    cls: "bg-emerald-100 text-emerald-700 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400 dark:border-emerald-800/40", dotCls: "bg-emerald-500" },
  draft:   { label: "Draft",  cls: "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400 dark:border-amber-800/40",          dotCls: "bg-amber-500"   },
  offline: { label: "Offline", cls: "bg-muted text-muted-foreground border-border",                                                                             dotCls: "bg-muted-foreground" },
}

function ModuleStatusPicker({ status, onChange }: { status: ModuleStatus; onChange: (s: ModuleStatus) => void }) {
  const [open, setOpen] = useState(false)
  const cfg = STATUS_CONFIG[status]
  return (
    <div className="relative">
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v) }}
        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold transition-colors cursor-pointer ${cfg.cls}`}
        title="Change module status"
      >
        <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${cfg.dotCls}`} />
        {cfg.label}
        <ChevronDownIcon size={9} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute left-0 top-full z-20 mt-1 w-28 rounded-xl border border-border bg-card shadow-lg overflow-hidden">
            {(["live", "draft", "offline"] as ModuleStatus[]).map((s) => {
              const c = STATUS_CONFIG[s]
              return (
                <button key={s} type="button"
                  onClick={(e) => { e.stopPropagation(); onChange(s); setOpen(false) }}
                  className={`flex w-full items-center gap-2 px-3 py-2 text-[12px] font-medium transition-colors hover:bg-muted ${status === s ? "opacity-60 cursor-default" : ""}`}
                >
                  <span className={`h-2 w-2 rounded-full shrink-0 ${c.dotCls}`} />
                  {c.label}
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Section
// ─────────────────────────────────────────────────────────────────────────────
function ModuleSection({ group, selectedIds, onToggleItem, onToggleAll, onEdit, onDelete, onAddQuestion, onReview, onRename, onDeleteModule, onSetStatus, forceExpand, isExpanded, onToggleExpand }: {
  group: ModGroup; selectedIds: Set<string>
  onToggleItem: (id: string) => void; onToggleAll: (ids: string[], select: boolean) => void
  onEdit: (q: Question, isDraft: boolean) => void; onDelete: (q: Question, isDraft: boolean) => void
  onReview: (q: Question, isDraft: boolean) => void
  onAddQuestion: (mod: string, disc: string) => void; onRename: (mod: string) => void
  onDeleteModule: (mod: string) => void; onSetStatus: (mod: string, status: ModuleStatus) => void
  forceExpand: boolean; isExpanded: boolean; onToggleExpand: () => void
}) {
  const [expandedDisc, setExpandedDisc] = useState<string | null>(null)
  const allIds = group.disciplines.flatMap((d) => d.items.map((i) => i.q.id))
  const allSelected = allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
  const someSelected = allIds.some((id) => selectedIds.has(id))

  // Compute question offset per discipline for sequential numbering
  let qOffset = 0

  return (
    <div className="border-b-2 border-border">
      {/* Module header */}
      <div className="flex items-center gap-2.5 bg-muted/50 px-4 py-3">
        <button type="button" onClick={() => onToggleAll(allIds, !allSelected)}
          className={`flex shrink-0 items-center justify-center rounded border-2 transition-colors ${allSelected ? "bg-primary border-primary text-primary-foreground" : someSelected ? "border-primary" : "border-border hover:border-primary/40"}`}
          style={{ width: 18, height: 18 }}
        >
          {allSelected ? <CheckIcon size={10} /> : someSelected ? <span style={{ width: 8, height: 2, background: "currentColor", borderRadius: 1, display: "block" }} /> : null}
        </button>
        <button type="button" onClick={onToggleExpand} className="flex items-center gap-2 min-w-0">
          {isExpanded ? <ChevronDownIcon size={15} className="text-muted-foreground" /> : <ChevronRightIcon size={15} className="text-muted-foreground" />}
          <FolderIcon size={15} />
          <span className="font-bold text-foreground truncate">{group.name}</span>
        </button>
        <div className="ml-1 flex items-center gap-1.5 shrink-0">
          <ModuleStatusPicker status={group.moduleStatus} onChange={(s) => onSetStatus(group.name, s)} />
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{group.disciplines.length} disc</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{group.total}Q</span>
          {group.draftCount > 0 && (
            <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{group.draftCount} draft</span>
          )}
        </div>
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => onRename(group.name)} className="rounded-lg border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors">Rename</button>
          <button type="button" onClick={() => onDeleteModule(group.name)} className="rounded-lg border border-destructive/30 bg-destructive/10 px-2.5 py-1 text-[11px] font-medium text-destructive hover:bg-destructive/20 transition-colors">Delete</button>
        </div>
      </div>

      {/* Disciplines */}
      {(isExpanded || forceExpand) && (
        <div className="pl-6">
          {group.disciplines.map((disc) => {
            const discIsExpanded = forceExpand || expandedDisc === disc.name
            const section = (
              <DisciplineSection
                key={disc.name}
                group={disc}
                moduleName={group.name}
                selectedIds={selectedIds}
                onToggleItem={onToggleItem}
                onToggleAll={onToggleAll}
                onEdit={onEdit}
                onDelete={onDelete}
                onReview={onReview}
                onAddQuestion={onAddQuestion}
                forceExpand={forceExpand}
                qOffset={qOffset}
                isExpanded={discIsExpanded}
                onToggleExpand={() => setExpandedDisc(expandedDisc === disc.name ? null : disc.name)}
              />
            )
            qOffset += disc.items.length
            return section
          })}
          <div className="p-3">
            <button type="button" onClick={() => onAddQuestion(group.name, "")}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-border py-2 text-xs font-medium text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
            >
              <PlusIcon size={13} /> Add question to this module
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main QuestionEditor
// ─────────────────────────────────────────────────────────────────────────────
type FilterMode = "all" | "live" | "draft"

interface EditTarget { question: Question | null; moduleName: string; disciplineName: string; isDraft: boolean }

export function QuestionEditor() {
  const { questions, addQuestion, updateQuestion, deleteQuestion, deleteAllQuestions, resetToDefault, saveToDb } = useQuestions()
  const { adminToken } = useAdmin()

  // Draft questions (imported from PDF/Word but not yet committed to DB)
  const [draftQuestions, setDraftQuestions] = useState<Question[]>([])

  // Selection (bulk operations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // UI state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [drawerTarget, setDrawerTarget] = useState<{ q: Question; isDraft: boolean } | null>(null)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [wordImportOpen, setWordImportOpen] = useState(false)
  const [expandedModule, setExpandedModule] = useState<string | null>(null)

  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [confirm, setConfirm] = useState<{ title: string; message: string; confirmLabel: string; action: () => void; danger?: boolean } | null>(null)
  const [renameTarget, setRenameTarget] = useState<{ moduleName: string } | null>(null)
  const [renameValue, setRenameValue] = useState("")

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)
  const jsonInputRef = useRef<HTMLInputElement>(null)

  // Auto-save to DB on question changes
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    if (!adminToken) return
    setSaveStatus("saving")
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      const ok = await saveToDb(questions, adminToken)
      setSaveStatus(ok ? "saved" : "error")
      setTimeout(() => setSaveStatus("idle"), 3000)
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [questions, adminToken, saveToDb])

  const hierarchy = useMemo(
    () => buildHierarchy(questions, draftQuestions, searchQuery, filterMode),
    [questions, draftQuestions, searchQuery, filterMode]
  )

  const totalLive = questions.length
  const totalDrafts = draftQuestions.length
  const totalModules = useMemo(() => new Set(questions.map(getModuleKey)).size, [questions])
  const isSearching = searchQuery.trim().length > 0

  // ── Selection helpers ──
  function toggleItem(id: string) {
    setSelectedIds((prev) => { const next = new Set(prev); if (next.has(id)) next.delete(id); else next.add(id); return next })
  }
  function toggleAll(ids: string[], select: boolean) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (select) ids.forEach((id) => next.add(id)); else ids.forEach((id) => next.delete(id))
      return next
    })
  }
  function clearSelection() { setSelectedIds(new Set()) }

  // ── Edit/Add ──
  function openEdit(q: Question, isDraft: boolean) {
    setEditTarget({ question: q, moduleName: getModuleKey(q), disciplineName: q.subject, isDraft })
  }
  function openAdd(moduleName: string, disciplineName: string) {
    setEditTarget({ question: null, moduleName, disciplineName, isDraft: false })
  }

  function handleSaveQuestion(saved: Question) {
    if (!editTarget) return
    if (editTarget.question === null) {
      // New question — always adds as live
      addQuestion(saved)
    } else if (editTarget.isDraft) {
      // Edit an existing draft
      setDraftQuestions((prev) => prev.map((d) => d.id === editTarget.question!.id ? saved : d))
    } else {
      updateQuestion(saved)
    }
    setEditTarget(null)
  }

  // ── Delete ──
  function handleDeleteQuestion(q: Question, isDraft: boolean) {
    setConfirm({
      title: "Delete this question?",
      message: `"${q.vignette.slice(0, 80)}${q.vignette.length > 80 ? "…" : ""}"`,
      confirmLabel: "Delete", danger: true,
      action: () => {
        if (isDraft) setDraftQuestions((prev) => prev.filter((d) => d.id !== q.id))
        else deleteQuestion(q.id)
        selectedIds.delete(q.id)
        setSelectedIds(new Set(selectedIds))
      },
    })
  }

  function handleDeleteModule(moduleName: string) {
    const count = hierarchy.find((m) => m.name === moduleName)?.total ?? 0
    setConfirm({
      title: `Delete module "${moduleName}"?`,
      message: `This will permanently delete all ${count} question${count !== 1 ? "s" : ""} in this module.`,
      confirmLabel: "Delete Module", danger: true,
      action: () => {
        // Delete live questions in this module
        questions.filter((q) => getModuleKey(q) === moduleName).forEach((q) => deleteQuestion(q.id))
        // Delete drafts in this module
        setDraftQuestions((prev) => prev.filter((q) => getModuleKey(q) !== moduleName))
        clearSelection()
      },
    })
  }

  // ── Bulk operations ──
  function handleBulkDelete() {
    setConfirm({
      title: `Delete ${selectedIds.size} selected question${selectedIds.size !== 1 ? "s" : ""}?`,
      message: "This cannot be undone.",
      confirmLabel: "Delete All Selected", danger: true,
      action: () => {
        // Split selected into live and draft
        const liveIds = new Set(questions.map((q) => q.id))
        selectedIds.forEach((id) => {
          if (liveIds.has(id)) deleteQuestion(id)
          else setDraftQuestions((prev) => prev.filter((d) => d.id !== id))
        })
        clearSelection()
      },
    })
  }

  function handleMakeLive() {
    const draftIds = new Set(draftQuestions.map((d) => d.id))
    const toMakeLive = [...selectedIds].filter((id) => draftIds.has(id))
    if (toMakeLive.length === 0) return
    const toSave = draftQuestions.filter((d) => toMakeLive.includes(d.id))
    toSave.forEach((q) => addQuestion(q))
    setDraftQuestions((prev) => prev.filter((d) => !toMakeLive.includes(d.id)))
    setSelectedIds((prev) => { const next = new Set(prev); toMakeLive.forEach((id) => next.delete(id)); return next })
  }

  function handleMakeAllLive() {
    draftQuestions.forEach((q) => addQuestion(q))
    setDraftQuestions([])
    clearSelection()
  }

  // ── Module rename ──
  function startRename(moduleName: string) { setRenameTarget({ moduleName }); setRenameValue(moduleName) }
  function commitRename() {
    if (!renameTarget || !renameValue.trim() || renameValue.trim() === renameTarget.moduleName) { setRenameTarget(null); return }
    const oldName = renameTarget.moduleName
    const newName = renameValue.trim()
    // Update live questions
    questions.filter((q) => getModuleKey(q) === oldName).forEach((q) => updateQuestion({ ...q, module: newName }))
    // Update drafts
    setDraftQuestions((prev) => prev.map((q) => getModuleKey(q) === oldName ? { ...q, module: newName } : q))
    setRenameTarget(null)
  }

  // ── Export JSON ──
  function handleExportJSON() {
    const date = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a"); a.href = url; a.download = `mednexus-questions-${date}.json`; a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (jsonInputRef.current) jsonInputRef.current.value = ""
    if (!file) return
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(parsed)) throw new Error("File must contain a JSON array.")
        if (parsed.length === 0) throw new Error("The file contains no questions.")
        const invalid = parsed.find((q: any) => typeof q.vignette !== "string" || !Array.isArray(q.options))
        if (invalid) throw new Error("One or more questions have an invalid format.")

        // Compute which modules will be overwritten vs added
        const importedModules = new Set(parsed.map((q: any) => (q.module?.trim() || q.subject) as string))
        const existingModuleNames = new Set(questions.map(getModuleKey))
        const overwritten = [...importedModules].filter((m) => existingModuleNames.has(m))
        const added = [...importedModules].filter((m) => !existingModuleNames.has(m))

        const summaryParts: string[] = []
        if (overwritten.length > 0) summaryParts.push(`Overwrite ${overwritten.length} existing module${overwritten.length !== 1 ? "s" : ""} (${overwritten.join(", ")})`)
        if (added.length > 0) summaryParts.push(`Add ${added.length} new module${added.length !== 1 ? "s" : ""} (${added.join(", ")})`)

        setConfirm({
          title: `Import ${parsed.length} question${parsed.length !== 1 ? "s" : ""}?`,
          message: summaryParts.join(". ") + ". All other existing modules will be kept.",
          confirmLabel: "Import", danger: false,
          action: async () => {
            if (!adminToken) return
            // Ensure all imported questions have IDs
            for (const q of parsed) { if (!q.id) q.id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
            // Upsert: keep existing questions not in imported modules, add/replace imported modules
            const kept = questions.filter((q) => !importedModules.has(getModuleKey(q)))
            const merged = [...kept, ...parsed]
            await saveToDb(merged, adminToken)
          },
        })
      } catch (err) {
        alert(err instanceof Error ? err.message : "Invalid JSON file.")
      }
    }
    reader.readAsText(file)
  }

  // ── Module status ──
  function handleSetModuleStatus(moduleName: string, status: ModuleStatus) {
    questions.filter((q) => getModuleKey(q) === moduleName).forEach((q) => updateQuestion({ ...q, moduleStatus: status }))
  }

  // ── Draft import from PDF or Word ──
  function handleDraftImport(imported: Question[]) {
    setDraftQuestions((prev) => [...prev, ...imported])
    setFilterMode("draft")
  }

  // ── Review drawer handlers ──
  function openReview(q: Question, isDraft: boolean) {
    setDrawerTarget({ q, isDraft })
  }

  function handleDrawerApprove(updated: Question) {
    addQuestion(updated)
    setDraftQuestions((prev) => prev.filter((d) => d.id !== updated.id))
    setDrawerTarget(null)
  }

  function handleDrawerSave(updated: Question) {
    updateQuestion(updated)
    setDrawerTarget(null)
  }

  // ── Counts for selected ──
  const selectedDraftCount = useMemo(() => {
    const draftIdSet = new Set(draftQuestions.map((d) => d.id))
    return [...selectedIds].filter((id) => draftIdSet.has(id)).length
  }, [selectedIds, draftQuestions])

  // ── Modules that are fully selected (all their questions checked) ──
  const selectedModules = useMemo(() => {
    return hierarchy.filter((m) => {
      const allIds = m.disciplines.flatMap((d) => d.items.map((i) => i.q.id))
      return allIds.length > 0 && allIds.every((id) => selectedIds.has(id))
    })
  }, [hierarchy, selectedIds])

  // ── Bulk module status ──
  function handleBulkSetModuleStatus(status: ModuleStatus) {
    selectedModules.forEach((m) => handleSetModuleStatus(m.name, status))
    clearSelection()
  }

  const emptyState = hierarchy.length === 0 && totalLive === 0 && totalDrafts === 0

  return (
    <div className="mx-auto flex max-w-7xl flex-col" style={{ height: "calc(100vh - 9rem)" }}>
      {/* ── Sticky Header ── */}
      <div className="shrink-0 rounded-t-2xl border border-border bg-card shadow-sm">
        {/* Top bar */}
        <div className="flex items-center gap-2 px-4 py-3">
          {/* Left: filter */}
          <div className="relative shrink-0">
            <select
              value={filterMode}
              onChange={(e) => setFilterMode(e.target.value as FilterMode)}
              className="h-9 appearance-none rounded-xl border border-border bg-muted pl-8 pr-3 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40 cursor-pointer"
            >
              <option value="all">All ({totalLive + totalDrafts})</option>
              <option value="live">Live ({totalLive})</option>
              <option value="draft">Drafts ({totalDrafts})</option>
            </select>
            <div className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground">
              <FilterIcon size={13} />
            </div>
          </div>

          {/* Center: search */}
          <div className="relative flex-1">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground" />
            <input
              type="search"
              placeholder="Search by question text, number, discipline, or module…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-9 w-full rounded-xl border border-border bg-background pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
            />
            {searchQuery && (
              <button type="button" onClick={() => setSearchQuery("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <XIcon size={13} />
              </button>
            )}
          </div>

          {/* Right: actions */}
          <div className="flex shrink-0 items-center gap-1.5">
            <SaveStatusPill status={saveStatus} />
            <button type="button" onClick={() => setPdfImportOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <UploadIcon size={13} /> Import PDF
            </button>
            <button
              type="button"
              onClick={() => setWordImportOpen(true)}
              className="flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors dark:border-blue-800/40 dark:bg-blue-900/20 dark:text-blue-400"
            >
              <WordIcon size={13} />
              Import Word
            </button>
            <button type="button" onClick={() => jsonInputRef.current?.click()}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors"
            >
              <UploadIcon size={13} /> Import JSON
            </button>
            <button type="button" onClick={handleExportJSON} disabled={totalLive === 0}
              className="flex items-center gap-1.5 rounded-xl border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground hover:bg-muted transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <DownloadIcon size={13} /> Export JSON
            </button>
            <input ref={jsonInputRef} type="file" accept=".json,application/json" className="hidden" onChange={handleImportJSON} />
            {totalDrafts > 0 && (
              <button type="button" onClick={handleMakeAllLive}
                className="flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400"
              >
                <CheckIcon size={13} /> Make All Live ({totalDrafts})
              </button>
            )}
            <button type="button" onClick={() => openAdd("", "")}
              className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
            >
              <PlusIcon size={13} /> Add Question
            </button>
          </div>
        </div>

        {/* Stats bar */}
        <div className="flex items-center gap-4 border-t border-border px-4 py-2">
          <div className="flex items-center gap-1.5">
            <DatabaseIcon size={13} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{totalLive} live · {totalModules} module{totalModules !== 1 ? "s" : ""}</span>
          </div>
          {totalDrafts > 0 && (
            <span className="rounded-full bg-amber-100/80 px-2 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">{totalDrafts} draft{totalDrafts !== 1 ? "s" : ""} pending</span>
          )}
          <button type="button" onClick={() => setConfirm({ title: "Reset to defaults?", message: "This discards all edits and restores the original question bank.", confirmLabel: "Reset", danger: true, action: () => { resetToDefault(); setDraftQuestions([]); clearSelection() } })}
            className="ml-auto flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCwIcon size={11} /> Reset
          </button>
        </div>

        {/* Bulk action bar */}
        {selectedIds.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 border-t border-border bg-primary/5 px-4 py-2.5">
            <span className="text-xs font-semibold text-foreground">{selectedIds.size} selected</span>

            {/* Module bulk status — shown when ≥1 whole module is checked */}
            {selectedModules.length > 0 && (
              <>
                <span className="text-[10px] text-muted-foreground border-l border-border pl-2">
                  {selectedModules.length} module{selectedModules.length !== 1 ? "s" : ""}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">Set status:</span>
                <button type="button" onClick={() => handleBulkSetModuleStatus("live")}
                  className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" /> Live
                </button>
                <button type="button" onClick={() => handleBulkSetModuleStatus("draft")}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 transition-colors dark:border-amber-800/40 dark:bg-amber-900/20 dark:text-amber-400"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500 shrink-0" /> Draft
                </button>
                <button type="button" onClick={() => handleBulkSetModuleStatus("offline")}
                  className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-semibold text-muted-foreground hover:bg-muted/80 transition-colors"
                >
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground shrink-0" /> Offline
                </button>
                <span className="border-l border-border h-4 self-center" />
              </>
            )}

            {selectedDraftCount > 0 && (
              <button type="button" onClick={handleMakeLive}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                <CheckIcon size={12} /> Make Live ({selectedDraftCount})
              </button>
            )}
            <button type="button" onClick={handleBulkDelete}
              className="flex items-center gap-1.5 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
            >
              <TrashIcon size={12} /> Delete Selected
            </button>
            <button type="button" onClick={clearSelection} className="ml-auto rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors">
              <XIcon size={12} />
            </button>
          </div>
        )}
      </div>

      {/* ── Scrollable tree ── */}
      <div className="flex-1 overflow-y-auto rounded-b-2xl border border-t-0 border-border bg-card">
        {emptyState ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
              <DatabaseIcon size={28} />
            </div>
            <div>
              <p className="font-semibold text-foreground">No questions yet</p>
              <p className="mt-1 text-sm text-muted-foreground">Add a question or import from PDF to get started</p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => setPdfImportOpen(true)} className="flex items-center gap-1.5 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">
                <UploadIcon size={14} /> Import PDF
              </button>
              <button type="button" onClick={() => openAdd("", "")} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors">
                <PlusIcon size={14} /> Add Question
              </button>
            </div>
          </div>
        ) : hierarchy.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <SearchIcon size={28} className="text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No questions match your search or filter.</p>
            <button type="button" onClick={() => { setSearchQuery(""); setFilterMode("all") }} className="text-xs text-primary hover:underline">Clear filters</button>
          </div>
        ) : (
          hierarchy.map((mod) => (
            <ModuleSection
              key={mod.name}
              group={mod}
              selectedIds={selectedIds}
              onToggleItem={toggleItem}
              onToggleAll={toggleAll}
              onEdit={openEdit}
              onDelete={handleDeleteQuestion}
              onReview={openReview}
              onAddQuestion={openAdd}
              onRename={startRename}
              onDeleteModule={handleDeleteModule}
              onSetStatus={handleSetModuleStatus}
              forceExpand={isSearching}
              isExpanded={isSearching || expandedModule === mod.name}
              onToggleExpand={() => setExpandedModule(expandedModule === mod.name ? null : mod.name)}
            />
          ))
        )}
      </div>

      {/* ── Edit / Add modal ── */}
      {editTarget !== null && (
        <div className="glass-modal-overlay fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm p-4 pt-8 pb-8">
          <div className="glass-modal w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
            <div className="glass-modal-header flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="font-bold text-foreground">{editTarget.question ? "Edit Question" : "Add New Question"}</h3>
                {editTarget.isDraft && <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">Editing Draft</span>}
              </div>
              <button type="button" onClick={() => setEditTarget(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                <XIcon size={18} />
              </button>
            </div>
            <div className="p-6">
              <QuestionForm
                initial={editTarget.question ?? undefined}
                questionId={editTarget.question?.id ?? `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`}
                defaultModule={editTarget.moduleName}
                defaultSubject={editTarget.disciplineName}
                adminToken={adminToken}
                onSave={handleSaveQuestion}
                onCancel={() => setEditTarget(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── PDF import modal ── */}
      {pdfImportOpen && (
        <PdfImportModal
          defaultModule=""
          onImport={handleDraftImport}
          onClose={() => setPdfImportOpen(false)}
        />
      )}

      {/* ── Word import modal ── */}
      {wordImportOpen && (
        <WordImportModal
          defaultModule=""
          onImport={handleDraftImport}
          onClose={() => setWordImportOpen(false)}
        />
      )}

      {/* ── Rename module dialog ── */}
      {renameTarget && (
        <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="glass-modal w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4">
            <h3 className="font-bold text-foreground">Rename Module</h3>
            <p className="text-sm text-muted-foreground">All questions in "{renameTarget.moduleName}" will be updated.</p>
            <input
              autoFocus
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && renameValue.trim()) commitRename() }}
              placeholder="New module name"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setRenameTarget(null)} className="rounded-xl px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">Cancel</button>
              <button type="button" disabled={!renameValue.trim() || renameValue.trim() === renameTarget.moduleName} onClick={commitRename}
                className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckIcon size={14} /> Rename
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Confirm dialog ── */}
      {confirm && (
        <ConfirmDialog
          {...confirm}
          onConfirm={() => { confirm.action(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ── Review drawer ── */}
      {drawerTarget && (
        <ReviewDrawer
          item={drawerTarget}
          onClose={() => setDrawerTarget(null)}
          onApprove={handleDrawerApprove}
          onSave={handleDrawerSave}
        />
      )}
    </div>
  )
}
