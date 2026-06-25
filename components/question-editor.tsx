"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useQuestions } from "@/contexts/questions-context"
import { useAdmin } from "@/contexts/admin-context"
import { PdfImportModal } from "@/components/pdf-import-modal"
import type { Question, QuestionOption } from "@/lib/types"
import {
  TrashIcon, PencilIcon, PlusIcon, XIcon, CheckIcon, DatabaseIcon,
  RefreshCwIcon, AlertTriangleIcon, CheckSquareIcon, DownloadIcon,
  SearchIcon, ChevronDownIcon, ChevronRightIcon, LayersIcon, BookOpenIcon,
  SparklesIcon,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
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
    correctAnswer: q.correctAnswer,
    objective: q.explanation.objective,
    details: q.explanation.details,
    incorrectReasoning: q.explanation.incorrectReasoning,
  }
}

function formToQuestion(f: FormState, id: string): Question {
  const options: QuestionOption[] = [
    { id: "A", text: f.optA }, { id: "B", text: f.optB },
    { id: "C", text: f.optC }, { id: "D", text: f.optD },
  ]
  if (f.optE.trim()) options.push({ id: "E", text: f.optE })
  const q: Question = {
    id, subject: f.subject.trim(), vignette: f.vignette.trim(), options,
    correctAnswer: f.correctAnswer,
    explanation: { objective: f.objective.trim(), details: f.details.trim(), incorrectReasoning: f.incorrectReasoning.trim() },
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
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceError, setEnhanceError] = useState("")

  function set(key: keyof FormState, val: string) { setForm((f) => ({ ...f, [key]: val })) }

  async function handleEnhance() {
    if (!form.vignette.trim() || !form.optA.trim() || !form.optB.trim()) {
      setEnhanceError("Fill in the vignette and answer choices first."); return
    }
    setEnhancing(true); setEnhanceError("")
    try {
      const options = ["A", "B", "C", "D", "E"]
        .map((l) => ({ id: l, text: form[`opt${l}` as keyof FormState] as string }))
        .filter((o) => o.text.trim())
      const res = await fetch("/api/enhance-question", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" },
        body: JSON.stringify({ vignette: form.vignette, options, correctAnswer: form.correctAnswer, subject: form.subject }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setForm((f) => ({ ...f, objective: data.explanation.objective ?? f.objective, details: data.explanation.details ?? f.details, incorrectReasoning: data.explanation.incorrectReasoning ?? f.incorrectReasoning }))
    } catch (err: any) {
      setEnhanceError(err.message ?? "Enhancement failed.")
    } finally { setEnhancing(false) }
  }

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
          <button type="button" onClick={handleEnhance} disabled={enhancing}
            className="flex items-center gap-1.5 rounded-lg bg-primary/10 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enhancing ? <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg> : <SparklesIcon size={12} />}
            {enhancing ? "Enhancing…" : "AI Enhance"}
          </button>
        </div>
        {enhanceError && <p className="text-xs text-destructive flex items-center gap-1"><AlertTriangleIcon size={11} /> {enhanceError}</p>}
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
interface ModGroup { name: string; disciplines: DiscGroup[]; total: number; draftCount: number }

function getModuleKey(q: Question): string { return q.module?.trim() || q.subject }

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
      item.explanation.objective.toLowerCase().includes(q) ||
      item.explanation.details.toLowerCase().includes(q)
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
      return { name: mod, disciplines, total, draftCount }
    })
    .sort((a, b) => a.name.localeCompare(b.name))
}

// ─────────────────────────────────────────────────────────────────────────────
// Question Card
// ─────────────────────────────────────────────────────────────────────────────
function QuestionCard({ item, questionNumber, isSelected, onToggle, onEdit, onDelete }: {
  item: QItem; questionNumber: number; isSelected: boolean
  onToggle: () => void; onEdit: () => void; onDelete: () => void
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

      <div className="flex-1 min-w-0">
        <div className="mb-1 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Q{questionNumber}</span>
          {isDraft && (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">Draft</span>
          )}
          <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold text-primary">{q.correctAnswer}</span>
        </div>
        <p className="line-clamp-2 text-sm text-foreground">{q.vignette}</p>
        <div className="mt-1.5 flex flex-wrap gap-3">
          {q.options.map((o) => (
            <span key={o.id} className={`text-xs ${o.id === q.correctAnswer ? "font-semibold text-primary" : "text-muted-foreground"}`}>
              {o.id}. {o.text.slice(0, 28)}{o.text.length > 28 ? "…" : ""}
            </span>
          ))}
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        <button type="button" onClick={onEdit} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors" aria-label="Edit">
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
function DisciplineSection({ group, moduleName, selectedIds, onToggleItem, onToggleAll, onEdit, onDelete, onAddQuestion, forceExpand, qOffset, isExpanded, onToggleExpand }: {
  group: DiscGroup; moduleName: string; selectedIds: Set<string>
  onToggleItem: (id: string) => void; onToggleAll: (ids: string[], select: boolean) => void
  onEdit: (q: Question, isDraft: boolean) => void; onDelete: (q: Question, isDraft: boolean) => void
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
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Module Section
// ─────────────────────────────────────────────────────────────────────────────
function ModuleSection({ group, selectedIds, onToggleItem, onToggleAll, onEdit, onDelete, onAddQuestion, onRename, onDeleteModule, forceExpand, isExpanded, onToggleExpand }: {
  group: ModGroup; selectedIds: Set<string>
  onToggleItem: (id: string) => void; onToggleAll: (ids: string[], select: boolean) => void
  onEdit: (q: Question, isDraft: boolean) => void; onDelete: (q: Question, isDraft: boolean) => void
  onAddQuestion: (mod: string, disc: string) => void; onRename: (mod: string) => void
  onDeleteModule: (mod: string) => void; forceExpand: boolean
  isExpanded: boolean; onToggleExpand: () => void
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

  // Draft questions (imported from PDF but not yet committed to DB)
  const [draftQuestions, setDraftQuestions] = useState<Question[]>([])

  // Selection (bulk operations)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // UI state
  const [searchQuery, setSearchQuery] = useState("")
  const [filterMode, setFilterMode] = useState<FilterMode>("all")
  const [editTarget, setEditTarget] = useState<EditTarget | null>(null)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
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
        setConfirm({
          title: `Import ${parsed.length} question${parsed.length !== 1 ? "s" : ""}?`,
          message: "This will replace your entire current question bank. Existing questions will be lost.",
          confirmLabel: "Import & Replace", danger: true,
          action: async () => {
            if (!adminToken) return
            for (const q of parsed) { if (!q.id) q.id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
            await saveToDb(parsed, adminToken)
          },
        })
      } catch (err) {
        alert(err instanceof Error ? err.message : "Invalid JSON file.")
      }
    }
    reader.readAsText(file)
  }

  // ── Draft import from PDF ──
  function handlePdfImport(imported: Question[]) {
    setDraftQuestions((prev) => [...prev, ...imported])
    setFilterMode("draft") // Switch to draft view so they see what was imported
  }

  // ── Counts for selected ──
  const selectedDraftCount = useMemo(() => {
    const draftIdSet = new Set(draftQuestions.map((d) => d.id))
    return [...selectedIds].filter((id) => draftIdSet.has(id)).length
  }, [selectedIds, draftQuestions])

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
              onAddQuestion={openAdd}
              onRename={startRename}
              onDeleteModule={handleDeleteModule}
              forceExpand={isSearching}
              isExpanded={isSearching || expandedModule === mod.name}
              onToggleExpand={() => setExpandedModule(expandedModule === mod.name ? null : mod.name)}
            />
          ))
        )}
      </div>

      {/* ── Edit / Add modal ── */}
      {editTarget !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm p-4 pt-8 pb-8">
          <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
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
          onImport={handlePdfImport}
          onClose={() => setPdfImportOpen(false)}
        />
      )}

      {/* ── Rename module dialog ── */}
      {renameTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card shadow-2xl p-6 space-y-4">
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
    </div>
  )
}
