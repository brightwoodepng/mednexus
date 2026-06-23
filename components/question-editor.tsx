"use client"

import { useState, useMemo, useEffect, useRef, useCallback } from "react"
import { useQuestions } from "@/contexts/questions-context"
import { useAdmin } from "@/contexts/admin-context"
import { PdfImportModal } from "@/components/pdf-import-modal"
import type { Question, QuestionOption } from "@/lib/types"
import {
  TrashIcon,
  PencilIcon,
  PlusIcon,
  XIcon,
  CheckIcon,
  BookOpenIcon,
  DatabaseIcon,
  RefreshCwIcon,
  AlertTriangleIcon,
  CheckSquareIcon,
  DownloadIcon,
} from "@/components/icons"

function UploadFileIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" x2="12" y1="3" y2="15" />
    </svg>
  )
}

function SparklesIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .963L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z" />
    </svg>
  )
}

// ── Confirm Dialog ───────────────────────────────────────────────────────────
function ConfirmDialog({
  title, message, confirmLabel, onConfirm, onCancel, danger,
}: {
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

// ── Rename Module Dialog ─────────────────────────────────────────────────────
function RenameModuleDialog({
  currentName, onRename, onCancel,
}: {
  currentName: string; onRename: (name: string) => void; onCancel: () => void
}) {
  const [value, setValue] = useState(currentName)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="w-full max-w-sm rounded-2xl bg-card border border-border shadow-2xl p-6 space-y-4">
        <div>
          <h3 className="font-bold text-foreground">Rename Module</h3>
          <p className="mt-1 text-sm text-muted-foreground">All questions in this module will be updated.</p>
        </div>
        <input
          autoFocus
          className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/40"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && value.trim()) onRename(value.trim()) }}
          placeholder="Module name"
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">Cancel</button>
          <button
            type="button"
            disabled={!value.trim() || value.trim() === currentName}
            onClick={() => { if (value.trim()) onRename(value.trim()) }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <CheckIcon size={14} />
            Rename
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Question Form (Add / Edit) ───────────────────────────────────────────────
const EMPTY_FORM = {
  subject: "", vignette: "",
  optA: "", optB: "", optC: "", optD: "", optE: "",
  correctAnswer: "A",
  objective: "", details: "", incorrectReasoning: "",
}
type FormState = typeof EMPTY_FORM

function questionToForm(q: Question): FormState {
  const opts: Record<string, string> = {}
  for (const o of q.options) opts[`opt${o.id}`] = o.text
  return {
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
  return {
    id, subject: f.subject.trim(), vignette: f.vignette.trim(), options,
    correctAnswer: f.correctAnswer,
    explanation: {
      objective: f.objective.trim(),
      details: f.details.trim(),
      incorrectReasoning: f.incorrectReasoning.trim(),
    },
  }
}

function QuestionForm({
  initial, questionId, defaultSubject, adminToken, onSave, onCancel,
}: {
  initial?: Question; questionId: string; defaultSubject: string
  adminToken: string | null; onSave: (q: Question) => void; onCancel: () => void
}) {
  const [form, setForm] = useState<FormState>(
    initial ? questionToForm(initial) : { ...EMPTY_FORM, subject: defaultSubject }
  )
  const [enhancing, setEnhancing] = useState(false)
  const [enhanceError, setEnhanceError] = useState("")

  function set(key: keyof FormState, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.subject.trim() || !form.vignette.trim() || !form.optA.trim() || !form.optB.trim()) return
    onSave(formToQuestion(form, questionId))
  }

  async function handleEnhance() {
    if (!form.vignette.trim() || !form.optA.trim() || !form.optB.trim()) {
      setEnhanceError("Fill in the vignette and answer choices first.")
      return
    }
    setEnhancing(true)
    setEnhanceError("")
    try {
      const options = ["A", "B", "C", "D", "E"]
        .map((l) => ({ id: l, text: form[`opt${l}` as keyof FormState] as string }))
        .filter((o) => o.text.trim())
      const res = await fetch("/api/enhance-question", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" },
        body: JSON.stringify({
          vignette: form.vignette,
          options,
          correctAnswer: form.correctAnswer,
          subject: form.subject,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed")
      setForm((f) => ({
        ...f,
        objective: data.explanation.objective ?? f.objective,
        details: data.explanation.details ?? f.details,
        incorrectReasoning: data.explanation.incorrectReasoning ?? f.incorrectReasoning,
      }))
    } catch (err: any) {
      setEnhanceError(err.message ?? "Enhancement failed. Try again.")
    } finally {
      setEnhancing(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
  const labelCls = "block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1"

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label className={labelCls}>Module / Subject *</label>
        <input className={inputCls} value={form.subject} onChange={(e) => set("subject", e.target.value)} placeholder="e.g. Cardiology" required />
      </div>

      <div>
        <label className={labelCls}>Clinical Vignette *</label>
        <textarea className={inputCls} rows={5} value={form.vignette} onChange={(e) => set("vignette", e.target.value)} placeholder="A 55-year-old man presents with…" required />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {(["A", "B", "C", "D", "E"] as const).map((letter) => {
          const key = `opt${letter}` as keyof FormState
          return (
            <div key={letter}>
              <label className={labelCls}>Option {letter}{letter === "E" ? " (optional)" : " *"}</label>
              <input className={inputCls} value={form[key]} onChange={(e) => set(key, e.target.value)} placeholder={`Option ${letter} text`} required={letter !== "E"} />
            </div>
          )
        })}
      </div>

      <div>
        <label className={labelCls}>Correct Answer *</label>
        <div className="flex gap-2 flex-wrap">
          {["A", "B", "C", "D", "E"].map((letter) => (
            <button key={letter} type="button" onClick={() => set("correctAnswer", letter)}
              className={`flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-bold transition-colors ${form.correctAnswer === letter ? "bg-primary text-primary-foreground border-primary shadow-sm" : "border-border text-muted-foreground hover:bg-muted"}`}
            >
              {letter}
            </button>
          ))}
        </div>
      </div>

      {/* Explanation section with AI Enhance button */}
      <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Explanation</p>
          <button
            type="button"
            onClick={handleEnhance}
            disabled={enhancing}
            className="flex items-center gap-1.5 rounded-lg bg-violet-500/10 border border-violet-400/40 px-3 py-1.5 text-xs font-semibold text-violet-700 dark:text-violet-400 hover:bg-violet-500/20 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {enhancing ? (
              <svg className="animate-spin" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
            ) : (
              <SparklesIcon size={13} />
            )}
            {enhancing ? "Enhancing…" : "AI Enhance"}
          </button>
        </div>

        {enhanceError && (
          <p className="text-xs text-destructive flex items-center gap-1.5">
            <AlertTriangleIcon size={12} /> {enhanceError}
          </p>
        )}

        <div>
          <label className={labelCls}>Objective</label>
          <input className={inputCls} value={form.objective} onChange={(e) => set("objective", e.target.value)} placeholder="What concept is being tested?" />
        </div>
        <div>
          <label className={labelCls}>Why correct answer is right</label>
          <textarea className={inputCls} rows={3} value={form.details} onChange={(e) => set("details", e.target.value)} placeholder="Detailed explanation…" />
        </div>
        <div>
          <label className={labelCls}>Why distractors are wrong</label>
          <textarea className={inputCls} rows={2} value={form.incorrectReasoning} onChange={(e) => set("incorrectReasoning", e.target.value)} placeholder="Common misconceptions…" />
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-foreground border border-border hover:bg-muted transition-colors">Cancel</button>
        <button type="submit" className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
          <CheckIcon size={15} />
          Save Question
        </button>
      </div>
    </form>
  )
}

// ── Save status pill ────────────────────────────────────────────────────────
type SaveStatus = "idle" | "saving" | "saved" | "error"
function SaveStatusPill({ status }: { status: SaveStatus }) {
  if (status === "idle") return null
  const cfg = {
    saving: { label: "Saving to cloud…", cls: "bg-amber-100 text-amber-700 border-amber-300" },
    saved:  { label: "Saved to cloud ✓",  cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
    error:  { label: "Save failed — try again", cls: "bg-destructive/10 text-destructive border-destructive/30" },
  }[status]
  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${cfg.cls}`}>
      {cfg.label}
    </span>
  )
}

// ── Main Question Editor ─────────────────────────────────────────────────────
export function QuestionEditor() {
  const { questions, addQuestion, updateQuestion, deleteQuestion, deleteQuestionsBySubject, deleteModule, deleteAllQuestions, resetToDefault, saveToDb } = useQuestions()
  const { adminToken } = useAdmin()

  const [selectedSubject, setSelectedSubject] = useState<string | null>(null)
  const [bulkMode, setBulkMode] = useState(false)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [editingQuestion, setEditingQuestion] = useState<Question | "new" | null>(null)
  const [pdfImportOpen, setPdfImportOpen] = useState(false)
  const [renameOpen, setRenameOpen] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>("idle")
  const [importError, setImportError] = useState("")
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isFirstRender = useRef(true)
  const jsonInputRef = useRef<HTMLInputElement>(null)
  const [confirm, setConfirm] = useState<{
    title: string; message: string; confirmLabel: string; action: () => void; danger?: boolean
  } | null>(null)

  // Auto-save to DB (debounced 800ms) whenever questions array changes
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

  const subjects = useMemo(() => Array.from(new Set(questions.map((q) => q.subject))).sort(), [questions])
  const moduleQuestions = useMemo(
    () => (selectedSubject ? questions.filter((q) => q.subject === selectedSubject) : []),
    [questions, selectedSubject],
  )

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  function selectAll() { setSelected(new Set(moduleQuestions.map((q) => q.id))) }
  function clearSelection() { setSelected(new Set()) }
  function exitBulkMode() { setBulkMode(false); clearSelection() }

  // Rename module — updates subject on all questions in the module
  const handleRenameModule = useCallback((newName: string) => {
    if (!selectedSubject || newName === selectedSubject) return
    moduleQuestions.forEach((q) => updateQuestion({ ...q, subject: newName }))
    setSelectedSubject(newName)
    setRenameOpen(false)
  }, [selectedSubject, moduleQuestions, updateQuestion])

  function handleDeleteSelected() {
    if (selected.size === 0) return
    setConfirm({
      title: "Delete selected questions?",
      message: `This will permanently delete ${selected.size} question${selected.size === 1 ? "" : "s"} from "${selectedSubject}".`,
      confirmLabel: "Delete", danger: true,
      action: () => {
        selected.forEach((id) => deleteQuestion(id))
        clearSelection()
        if (moduleQuestions.length === selected.size) { setSelectedSubject(null); exitBulkMode() }
      },
    })
  }

  function handleDeleteAllQuestions() {
    if (!selectedSubject) return
    setConfirm({
      title: "Delete all questions in this module?",
      message: `This will permanently delete all ${moduleQuestions.length} question${moduleQuestions.length === 1 ? "" : "s"} in "${selectedSubject}".`,
      confirmLabel: "Delete All Questions", danger: true,
      action: () => { deleteQuestionsBySubject(selectedSubject); setSelectedSubject(null); exitBulkMode() },
    })
  }

  function handleDeleteModule() {
    if (!selectedSubject) return
    setConfirm({
      title: `Delete module "${selectedSubject}"?`,
      message: `This will permanently remove all ${moduleQuestions.length} question${moduleQuestions.length === 1 ? "" : "s"} and the module from the dashboard.`,
      confirmLabel: "Delete Module", danger: true,
      action: () => { deleteModule(selectedSubject); setSelectedSubject(null); exitBulkMode() },
    })
  }

  function handleDeleteSingleQuestion(q: Question) {
    setConfirm({
      title: "Delete this question?",
      message: `"${q.vignette.slice(0, 80)}${q.vignette.length > 80 ? "…" : ""}"`,
      confirmLabel: "Delete", danger: true,
      action: () => { deleteQuestion(q.id); if (moduleQuestions.length === 1) setSelectedSubject(null) },
    })
  }

  function handleResetToDefault() {
    setConfirm({
      title: "Reset to default questions?",
      message: "This will discard all your edits and restore the original built-in question bank.",
      confirmLabel: "Reset", danger: true,
      action: () => { resetToDefault(); setSelectedSubject(null); exitBulkMode() },
    })
  }

  function handleExportJSON() {
    const date = new Date().toISOString().slice(0, 10)
    const blob = new Blob([JSON.stringify(questions, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `mednexus-questions-${date}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleImportJSON(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!jsonInputRef.current) return
    jsonInputRef.current.value = ""
    if (!file) return
    setImportError("")
    const reader = new FileReader()
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string)
        if (!Array.isArray(parsed)) throw new Error("File must contain a JSON array of questions.")
        if (parsed.length === 0) throw new Error("The file contains no questions.")
        const invalid = parsed.find(
          (q) => typeof q.vignette !== "string" || !Array.isArray(q.options) || typeof q.correctAnswer !== "string"
        )
        if (invalid) throw new Error("One or more questions have an invalid format.")
        setConfirm({
          title: `Import ${parsed.length} question${parsed.length !== 1 ? "s" : ""}?`,
          message: "This will replace your current question bank with the imported file. Your existing questions will be lost.",
          confirmLabel: "Import",
          danger: true,
          action: async () => {
            if (!adminToken) return
            for (const q of parsed) {
              if (!q.id) q.id = `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
            }
            await saveToDb(parsed, adminToken)
            setSelectedSubject(null)
            exitBulkMode()
          },
        })
      } catch (err) {
        setImportError(err instanceof Error ? err.message : "Invalid JSON file.")
      }
    }
    reader.readAsText(file)
  }

  function generateId(): string { return `q-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` }
  const totalQuestions = questions.length

  return (
    <div className="mx-auto max-w-7xl">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <DatabaseIcon size={20} />
          </div>
          <div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-bold tracking-tight">Question Editor</h1>
              <SaveStatusPill status={saveStatus} />
            </div>
            <p className="text-sm text-muted-foreground">{totalQuestions} question{totalQuestions !== 1 ? "s" : ""} · {subjects.length} module{subjects.length !== 1 ? "s" : ""} · synced for all users</p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button type="button" onClick={handleResetToDefault} className="flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCwIcon size={15} />
            Reset to Default
          </button>
          <button
            type="button"
            onClick={handleExportJSON}
            disabled={questions.length === 0}
            title="Download all questions as a JSON file"
            className="flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors shadow-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <DownloadIcon size={15} />
            Export JSON
          </button>
          <input
            ref={jsonInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportJSON}
          />
          <button
            type="button"
            onClick={() => jsonInputRef.current?.click()}
            title="Upload a previously exported JSON file"
            className="flex items-center gap-2 rounded-xl border border-emerald-400/50 bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-700 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors shadow-sm"
          >
            <UploadFileIcon />
            Import JSON
          </button>
          <button type="button" onClick={() => setPdfImportOpen(true)} className="flex items-center gap-2 rounded-xl border border-violet-400/50 bg-violet-500/10 px-4 py-2 text-sm font-medium text-violet-700 dark:text-violet-400 hover:bg-violet-500/20 transition-colors shadow-sm">
            <UploadFileIcon />
            Import PDF
          </button>
          <button type="button" onClick={() => { setSelectedSubject(selectedSubject ?? subjects[0] ?? ""); setEditingQuestion("new") }}
            className="flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <PlusIcon size={15} />
            Add Question
          </button>
        </div>
      </div>

      {importError && (
        <div className="mb-4 flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <AlertTriangleIcon size={15} />
          {importError}
          <button type="button" onClick={() => setImportError("")} className="ml-auto text-destructive/60 hover:text-destructive">
            <XIcon size={14} />
          </button>
        </div>
      )}
      <div className="flex gap-4 h-[calc(100vh-14rem)]">
        {/* Module sidebar */}
        <aside className="hidden w-56 shrink-0 flex-col gap-1 overflow-y-auto rounded-2xl border border-border bg-card p-3 shadow-sm sm:flex">
          <p className="px-2 pb-2 text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">Modules</p>
          {subjects.length === 0 && <p className="px-2 text-xs text-muted-foreground italic">No modules yet</p>}
          {subjects.map((subject) => {
            const count = questions.filter((q) => q.subject === subject).length
            const active = selectedSubject === subject
            return (
              <button key={subject} type="button" onClick={() => { setSelectedSubject(subject); exitBulkMode() }}
                className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${active ? "bg-primary text-primary-foreground font-semibold shadow-sm" : "text-foreground hover:bg-muted"}`}
              >
                <span className="truncate">{subject}</span>
                <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${active ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {count}
                </span>
              </button>
            )
          })}
        </aside>

        {/* Main content panel */}
        <div className="flex flex-1 flex-col gap-0 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
          {!selectedSubject ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-8">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                <BookOpenIcon size={28} />
              </div>
              <div>
                <p className="font-semibold text-foreground">Select a module to edit</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {subjects.length > 0 ? "Choose a module from the left panel" : "Add a question to create your first module"}
                </p>
              </div>
              {/* Mobile module list */}
              <div className="mt-4 flex flex-col gap-2 w-full max-w-xs sm:hidden">
                {subjects.map((subject) => {
                  const count = questions.filter((q) => q.subject === subject).length
                  return (
                    <button key={subject} type="button" onClick={() => setSelectedSubject(subject)}
                      className="flex items-center justify-between rounded-xl border border-border bg-muted/50 px-4 py-3 text-sm font-medium hover:bg-muted transition-colors"
                    >
                      <span>{subject}</span>
                      <span className="text-muted-foreground">{count}q</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <>
              {/* Module header */}
              <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className="min-w-0">
                    <h2 className="font-bold text-foreground truncate">{selectedSubject}</h2>
                    <p className="text-xs text-muted-foreground">{moduleQuestions.length} question{moduleQuestions.length !== 1 ? "s" : ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setRenameOpen(true)}
                    title="Rename module"
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    <PencilIcon size={13} />
                  </button>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button type="button"
                    onClick={() => { if (bulkMode) exitBulkMode(); else setBulkMode(true) }}
                    className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-medium transition-colors ${bulkMode ? "bg-primary text-primary-foreground shadow-sm" : "border border-border text-muted-foreground hover:bg-muted"}`}
                  >
                    <CheckSquareIcon size={14} />
                    {bulkMode ? "Exit Bulk" : "Bulk Edit"}
                  </button>
                  <button type="button" onClick={() => setEditingQuestion("new")}
                    className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
                  >
                    <PlusIcon size={14} />
                    Add
                  </button>
                </div>
              </div>

              {/* Bulk action bar */}
              {bulkMode && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border bg-destructive/5 px-5 py-3">
                  <span className="text-xs font-medium text-muted-foreground mr-1">{selected.size} selected</span>
                  <button type="button" onClick={selected.size === moduleQuestions.length ? clearSelection : selectAll}
                    className="rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted transition-colors"
                  >
                    {selected.size === moduleQuestions.length ? "Deselect All" : "Select All"}
                  </button>
                  {selected.size > 0 && (
                    <button type="button" onClick={handleDeleteSelected}
                      className="flex items-center gap-1.5 rounded-lg bg-destructive/10 border border-destructive/30 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <TrashIcon size={12} />
                      Delete Selected ({selected.size})
                    </button>
                  )}
                  <div className="ml-auto flex gap-2">
                    <button type="button" onClick={handleDeleteAllQuestions}
                      className="flex items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-1.5 text-xs font-semibold text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <TrashIcon size={12} />
                      Delete All Questions
                    </button>
                    <button type="button" onClick={handleDeleteModule}
                      className="flex items-center gap-1.5 rounded-lg bg-destructive px-3 py-1.5 text-xs font-semibold text-white hover:bg-destructive/90 transition-colors shadow-sm"
                    >
                      <TrashIcon size={12} />
                      Delete Module
                    </button>
                  </div>
                </div>
              )}

              {/* Question list */}
              <div className="flex-1 overflow-y-auto divide-y divide-border">
                {moduleQuestions.length === 0 && (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <p className="text-sm text-muted-foreground">No questions in this module.</p>
                    <button type="button" onClick={() => setEditingQuestion("new")}
                      className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                    >
                      <PlusIcon size={14} />
                      Add First Question
                    </button>
                  </div>
                )}
                {moduleQuestions.map((q, i) => (
                  <div key={q.id}
                    className={`flex items-start gap-4 px-5 py-4 transition-colors ${bulkMode && selected.has(q.id) ? "bg-primary/5" : "hover:bg-muted/40"}`}
                  >
                    {bulkMode && (
                      <button type="button" onClick={() => toggleSelect(q.id)}
                        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 transition-colors ${selected.has(q.id) ? "bg-primary border-primary text-primary-foreground" : "border-border"}`}
                      >
                        {selected.has(q.id) && <CheckIcon size={11} />}
                      </button>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Q{i + 1}</span>
                        <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">{q.correctAnswer}</span>
                      </div>
                      <p className="text-sm text-foreground line-clamp-2">{q.vignette}</p>
                      <div className="mt-1.5 flex gap-3 flex-wrap">
                        {q.options.map((o) => (
                          <span key={o.id} className={`text-xs ${o.id === q.correctAnswer ? "font-semibold text-emerald-700" : "text-muted-foreground"}`}>
                            {o.id}. {o.text.slice(0, 30)}{o.text.length > 30 ? "…" : ""}
                          </span>
                        ))}
                      </div>
                    </div>
                    {!bulkMode && (
                      <div className="flex shrink-0 items-center gap-1.5">
                        <button type="button" onClick={() => setEditingQuestion(q)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                          aria-label="Edit question"
                        >
                          <PencilIcon size={15} />
                        </button>
                        <button type="button" onClick={() => handleDeleteSingleQuestion(q)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                          aria-label="Delete question"
                        >
                          <TrashIcon size={15} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Edit / Add modal */}
      {editingQuestion !== null && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 backdrop-blur-sm p-4 pt-8 pb-8">
          <div className="w-full max-w-2xl rounded-2xl bg-card border border-border shadow-2xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <div>
                <h3 className="font-bold text-foreground">{editingQuestion === "new" ? "Add New Question" : "Edit Question"}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">Use <span className="font-semibold text-violet-600">AI Enhance</span> to auto-generate explanation from your vignette.</p>
              </div>
              <button type="button" onClick={() => setEditingQuestion(null)} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted transition-colors">
                <XIcon size={18} />
              </button>
            </div>
            <div className="p-6">
              <QuestionForm
                initial={editingQuestion === "new" ? undefined : editingQuestion}
                questionId={editingQuestion === "new" ? generateId() : (editingQuestion as Question).id}
                defaultSubject={selectedSubject ?? ""}
                adminToken={adminToken}
                onSave={(q) => {
                  if (editingQuestion === "new") {
                    addQuestion(q)
                    if (!selectedSubject) setSelectedSubject(q.subject)
                  } else {
                    updateQuestion(q)
                    if (q.subject !== selectedSubject) setSelectedSubject(q.subject)
                  }
                  setEditingQuestion(null)
                }}
                onCancel={() => setEditingQuestion(null)}
              />
            </div>
          </div>
        </div>
      )}

      {/* PDF import modal */}
      {pdfImportOpen && (
        <PdfImportModal
          defaultModule={selectedSubject ?? ""}
          onImport={(importedQuestions) => {
            importedQuestions.forEach((q) => addQuestion(q))
            if (importedQuestions.length > 0 && !selectedSubject) setSelectedSubject(importedQuestions[0].subject)
          }}
          onClose={() => setPdfImportOpen(false)}
        />
      )}

      {/* Rename module dialog */}
      {renameOpen && selectedSubject && (
        <RenameModuleDialog
          currentName={selectedSubject}
          onRename={handleRenameModule}
          onCancel={() => setRenameOpen(false)}
        />
      )}

      {/* Confirm dialog */}
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
