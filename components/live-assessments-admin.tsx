"use client"

import { useState, useEffect, useCallback } from "react"
import type { LiveAssessment, AssessmentAnalytics } from "@/lib/types"
import { gradingModeLabel, type AssessmentGradingMode } from "@/lib/assessment-grading"
import {
  ClipboardListIcon, PlusIcon, TrashIcon, ClockIcon, UsersIcon,
  BarChart2Icon, LinkIcon, CheckIcon, XIcon, AlertTriangleIcon,
  RadioIcon, CopyIcon, RefreshCwIcon, ChevronDownIcon, TrophyIcon, ChevronLeftIcon,
} from "@/components/icons"

// ── Create Assessment Modal ────────────────────────────────────────────────────
type AssessmentDefaults = { questionCount: number; timeLimitMins: number; triesAllowed: number; passMark: number }
type AssessmentModuleOption = { name: string; eligibleQuestionCount: number }
const FALLBACK_DEFAULTS: AssessmentDefaults = { questionCount: 10, timeLimitMins: 30, triesAllowed: 1, passMark: 50 }

async function readJsonResponse(response: Response): Promise<Record<string, unknown>> {
  const text = await response.text()
  if (!text.trim()) return {}
  try { return JSON.parse(text) as Record<string, unknown> }
  catch { return {} }
}

function CreateModal({ onClose, onCreated, defaults, modules, optionsLoading, optionsError, onRetryOptions }: {
  onClose: () => void
  onCreated: (result: { requestedQuestionCount: number; actualQuestionCount: number }) => void
  defaults: AssessmentDefaults
  modules: AssessmentModuleOption[]
  optionsLoading: boolean
  optionsError: string
  onRetryOptions: () => void
}) {
  const [form, setForm] = useState({
    title: "",
    moduleName: modules[0]?.name ?? "",
    questionCount: String(defaults.questionCount),
    timeLimitMins: String(defaults.timeLimitMins),
    triesAllowed: String(defaults.triesAllowed),
    passMark: String(defaults.passMark),
    gradingMode: "standard" as AssessmentGradingMode,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")
  const selectedModule = modules.find(module => module.name === form.moduleName)
  const requestedCount = Math.max(1, Number(form.questionCount) || defaults.questionCount)
  const actualCount = Math.min(requestedCount, selectedModule?.eligibleQuestionCount ?? 0)

  useEffect(() => {
    if (!modules.length) return
    setForm(current => modules.some(module => module.name === current.moduleName)
      ? current
      : { ...current, moduleName: modules[0].name })
  }, [modules])

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.moduleName) { setError("Title and module are required."); return }
    setSaving(true)
    setError("")
    const controller = new AbortController()
    const timeout = window.setTimeout(() => controller.abort(), 30_000)
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          moduleName: form.moduleName,
          questionCount: Number(form.questionCount),
          timeLimitMins: Number(form.timeLimitMins),
          triesAllowed: Number(form.triesAllowed),
          passMark: Number(form.passMark),
          gradingMode: form.gradingMode,
        }),
        signal: controller.signal,
      })
      const data = await readJsonResponse(res)
      if (!res.ok) { setError(typeof data.error === "string" ? data.error : `Unable to create the assessment (${res.status}). Please retry.`); return }
      onCreated({
        requestedQuestionCount: Number(data.requestedQuestionCount ?? requestedCount),
        actualQuestionCount: Number(data.actualQuestionCount ?? actualCount),
      })
      onClose()
    } catch (cause) {
      setError(cause instanceof DOMException && cause.name === "AbortError"
        ? "Creation took too long. Refresh the assessment list before retrying so you do not create a duplicate."
        : "The assessment could not be created. Check your connection and try again.")
    } finally {
      window.clearTimeout(timeout)
      setSaving(false)
    }
  }

  const inputCls = "w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
  const labelCls = "block text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1"

  return (
    <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="glass-modal w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl overflow-hidden">
        <div className="glass-modal-header flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="font-bold text-foreground">New Assessment</h2>
          <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            <XIcon size={15} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className={labelCls}>Title *</label>
            <input className={inputCls} value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Mid-Semester Clinical Exam" required />
          </div>
          <div>
            <label className={labelCls}>Module *</label>
            <select className={inputCls} value={form.moduleName} onChange={(e) => set("moduleName", e.target.value)} required disabled={optionsLoading || modules.length === 0}>
              {optionsLoading && <option value="">Loading current modules…</option>}
              {!optionsLoading && modules.length === 0 && <option value="">No eligible modules available</option>}
              {modules.map(module => <option key={module.name} value={module.name}>{module.name} ({module.eligibleQuestionCount})</option>)}
            </select>
            {optionsError ? <div role="alert" className="mt-2 flex items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-xs text-destructive"><span>{optionsError}</span><button type="button" onClick={onRetryOptions} className="shrink-0 font-semibold underline">Retry</button></div>
              : selectedModule && <p className="mt-1 text-xs text-muted-foreground">{selectedModule.eligibleQuestionCount} eligible questions · this assessment will use {actualCount}.</p>}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Questions</label>
              <input type="number" min="1" max="200" className={inputCls} value={form.questionCount} onChange={(e) => set("questionCount", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Time (minutes)</label>
              <input type="number" min="5" max="300" className={inputCls} value={form.timeLimitMins} onChange={(e) => set("timeLimitMins", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Tries allowed</label>
              <input type="number" min="1" max="10" className={inputCls} value={form.triesAllowed} onChange={(e) => set("triesAllowed", e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Pass mark (%)</label>
              <input type="number" min="1" max="100" className={inputCls} value={form.passMark} onChange={(e) => set("passMark", e.target.value)} />
            </div>
          </div>
          <div>
            <label className={labelCls} htmlFor="assessment-grading">Grading</label>
            <select id="assessment-grading" className={inputCls} value={form.gradingMode} onChange={(e) => set("gradingMode", e.target.value)}>
              <option value="standard">Standard (+1 correct, 0 wrong, 0 unanswered)</option>
              <option value="negative">Negative (+1 correct, −1 wrong, 0 unanswered)</option>
            </select>
            <p className="mt-1 text-xs text-muted-foreground">The grading rule is locked after the first submission.</p>
          </div>
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              <AlertTriangleIcon size={13} /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || optionsLoading || modules.length === 0 || actualCount === 0} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
              {saving ? "Creating…" : <><CheckIcon size={13} /> Create</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Analytics Modal ────────────────────────────────────────────────────────────
function AnalyticsModal({
  assessment,
  onClose,
}: { assessment: LiveAssessment; onClose: () => void }) {
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AssessmentAnalytics & { uniqueParticipants: number; passMark: number; triesAllowed: number; gradingMode: AssessmentGradingMode; failCount: number; highestScore: number; lowestScore: number; medianScore: number } | null>(null)
  const [recentAttempts, setRecentAttempts] = useState<Array<{ userName: string; isGuest: boolean; score: number; total: number; percentage: number; submittedAt: string }>>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/${assessment.id}/analytics`)
        const data = await res.json()
        setAnalytics(data.analytics)
        setRecentAttempts(data.recentAttempts ?? [])
      } catch { /* swallow */ }
      finally { setLoading(false) }
    }
    load()
  }, [assessment.id])

  function exportToPDF() {
    if (!analytics) return

    const passMark = analytics.passMark ?? 50
    const generatedAt = new Date().toLocaleString()

    // ── Sort all submissions high → low by raw score integer ─────────────────
    const sorted = [...recentAttempts].sort((a, b) => b.score - a.score)

    // ── Calculate statistics from the full submission set ────────────────────
    const totalSubmissions = sorted.length
    const passed = sorted.filter((a) => a.percentage >= passMark)
    const failed = sorted.filter((a) => a.percentage < passMark)
    const passCount = passed.length
    const failCount = failed.length
    const passRate = totalSubmissions ? Math.round((passCount / totalSubmissions) * 100) : 0
    const failRate = 100 - passRate

    const percentages = sorted.map((a) => a.percentage)
    const avgScore = percentages.length
      ? Math.round(percentages.reduce((s, v) => s + v, 0) / percentages.length)
      : 0
    const highestScore = percentages.length ? Math.max(...percentages) : 0
    const lowestScore = percentages.length ? Math.min(...percentages) : 0

    const pctSorted = [...percentages].sort((a, b) => a - b)
    const mid = Math.floor(pctSorted.length / 2)
    const medianScore = pctSorted.length === 0 ? 0
      : pctSorted.length % 2 === 0 ? Math.round((pctSorted[mid - 1] + pctSorted[mid]) / 2)
      : pctSorted[mid]

    // Score distribution buckets (0-49, 50-69, 70-84, 85-100)
    const buckets = [
      { label: "0–49%",   count: percentages.filter((p) => p < 50).length, color: "#dc2626" },
      { label: "50–69%",  count: percentages.filter((p) => p >= 50 && p < 70).length, color: "#d97706" },
      { label: "70–84%",  count: percentages.filter((p) => p >= 70 && p < 85).length, color: "#2563eb" },
      { label: "85–100%", count: percentages.filter((p) => p >= 85).length, color: "#059669" },
    ]
    const bucketBars = buckets.map((b) => {
      const width = totalSubmissions ? Math.round((b.count / totalSubmissions) * 100) : 0
      return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
        <span style="width:52px;font-size:10px;color:#6b7280;text-align:right;flex-shrink:0;">${b.label}</span>
        <div style="flex:1;background:#f3f4f6;border-radius:4px;height:14px;overflow:hidden;">
          <div style="height:100%;background:${b.color};border-radius:4px;width:${width}%;"></div>
        </div>
        <span style="width:28px;font-size:10px;font-weight:600;color:${b.color};flex-shrink:0;">${b.count}</span>
      </div>`
    }).join("")

    // ── Rank column — same rank for tied raw scores ──────────────────────────
    let rank = 0
    let lastScore = -1
    const attemptsRows = sorted.map((a, idx) => {
      if (a.score !== lastScore) { rank = idx + 1; lastScore = a.score }
      const pct = a.percentage
      const pass = pct >= passMark
      const rowBg = idx % 2 === 0 ? "#fff" : "#f9fafb"
      return `<tr style="background:${rowBg};">
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-weight:600;color:#6b7280;text-align:center;">${rank}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;">${a.userName}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;padding:2px 7px;border-radius:9999px;background:${a.isGuest ? "#fef9c3" : "#eff6ff"};color:${a.isGuest ? "#a16207" : "#1d4ed8"};">
            ${a.isGuest ? "Guest" : "Registered"}
          </span>
        </td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;">${a.score}/${a.total}</td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-weight:700;color:${pass ? "#059669" : "#dc2626"};">
          ${pct}%
        </td>
        <td style="padding:7px 10px;border-bottom:1px solid #f3f4f6;font-weight:700;color:${pass ? "#059669" : "#dc2626"};">
          ${pass ? "✓ Pass" : "✗ Fail"}
        </td>
      </tr>`
    }).join("")

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>Analytics — ${assessment.title}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif; color: #111827; padding: 48px; background: #fff; font-size: 13px; }
    .header { margin-bottom: 28px; border-bottom: 2px solid #e5e7eb; padding-bottom: 18px; display: flex; justify-content: space-between; align-items: flex-end; }
    .header h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 4px; }
    .header p { color: #6b7280; font-size: 11px; }
    .header .badge { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; padding: 4px 10px; border-radius: 9999px; background: #f3f4f6; color: #374151; white-space: nowrap; }
    .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stats-grid-2 { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; }
    .stat-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 6px; }
    .stat-value { font-size: 24px; font-weight: 700; color: #111827; line-height: 1; margin-bottom: 3px; }
    .stat-sub { font-size: 10px; color: #9ca3af; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #9ca3af; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1px solid #f3f4f6; }
    .distribution { background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 10px; padding: 14px 16px; margin-bottom: 24px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f9fafb; }
    th { text-align: left; padding: 8px 10px; font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 2px solid #e5e7eb; }
    th.center { text-align: center; }
    td { font-size: 12px; color: #111827; vertical-align: middle; }
    .footer { margin-top: 28px; padding-top: 14px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 10px; text-align: center; }
    @media print { body { padding: 24px; } .stats-grid { grid-template-columns: repeat(4, 1fr); } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${assessment.title}</h1>
      <p>Analytics Report &middot; Generated ${generatedAt} &middot; MedNexus</p>
      <p>Grading: ${gradingModeLabel(assessment.gradingMode)}</p>
    </div>
    <div class="badge">Pass mark: ${passMark}%</div>
  </div>

  <!-- Row 1: Volume & outcome stats -->
  <div class="stats-grid">
    <div class="stat">
      <div class="stat-label">Total Submissions</div>
      <div class="stat-value">${totalSubmissions}</div>
      <div class="stat-sub">${analytics.uniqueParticipants} unique participant${analytics.uniqueParticipants === 1 ? "" : "s"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Passed</div>
      <div class="stat-value" style="color:#059669;">${passCount}</div>
      <div class="stat-sub">${passRate}% pass rate</div>
    </div>
    <div class="stat">
      <div class="stat-label">Failed</div>
      <div class="stat-value" style="color:#dc2626;">${failCount}</div>
      <div class="stat-sub">${failRate}% fail rate</div>
    </div>
    <div class="stat">
      <div class="stat-label">Participants</div>
      <div class="stat-value" style="font-size:16px;padding-top:4px;">${analytics.registeredCount} reg<br/>${analytics.guestCount} guest</div>
      <div class="stat-sub">registered vs guest</div>
    </div>
  </div>

  <!-- Row 2: Score stats -->
  <div class="stats-grid-2">
    <div class="stat">
      <div class="stat-label">Average Score</div>
      <div class="stat-value">${avgScore}%</div>
      <div class="stat-sub">across all submissions</div>
    </div>
    <div class="stat">
      <div class="stat-label">Median Score</div>
      <div class="stat-value">${medianScore}%</div>
      <div class="stat-sub">50th percentile</div>
    </div>
    <div class="stat">
      <div class="stat-label">Highest Score</div>
      <div class="stat-value" style="color:#059669;">${highestScore}%</div>
      <div class="stat-sub">top result</div>
    </div>
    <div class="stat">
      <div class="stat-label">Lowest Score</div>
      <div class="stat-value" style="color:#dc2626;">${lowestScore}%</div>
      <div class="stat-sub">bottom result</div>
    </div>
  </div>

  <!-- Score distribution -->
  ${totalSubmissions > 0 ? `
  <div class="section">
    <div class="section-title">Score Distribution</div>
    <div class="distribution">
      ${bucketBars}
    </div>
  </div>` : ""}

  <!-- All submissions sorted high → low -->
  <div class="section">
    <div class="section-title">All Submissions — sorted highest to lowest score (${totalSubmissions} total)</div>
    ${sorted.length > 0 ? `
    <table>
      <thead>
        <tr>
          <th class="center" style="width:40px;">Rank</th>
          <th>Name</th>
          <th>Type</th>
          <th>Score</th>
          <th>%</th>
          <th>Result</th>
        </tr>
      </thead>
      <tbody>${attemptsRows}</tbody>
    </table>` : "<p style=\"color:#9ca3af;text-align:center;padding:24px 0;\">No submissions recorded.</p>"}
  </div>

  <div class="footer">MedNexus &mdash; Confidential &mdash; ${assessment.title} &mdash; ${totalSubmissions} submission${totalSubmissions === 1 ? "" : "s"}</div>
</body>
</html>`

    const w = window.open("", "_blank")
    if (w) {
      w.document.write(html)
      w.document.close()
      setTimeout(() => w.print(), 400)
    }
  }

  return (
    <div className="glass-modal-overlay fixed inset-0 z-50 flex items-center justify-center bg-foreground/40 backdrop-blur-sm p-4">
      <div className="glass-modal w-full max-w-lg rounded-2xl bg-card border border-border shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="glass-modal-header flex items-center justify-between border-b border-border px-5 py-4 shrink-0">
          <div>
            <h2 className="font-bold text-foreground">Analytics</h2>
            <p className="text-xs text-muted-foreground truncate max-w-72">{assessment.title}</p>
          </div>
          <div className="flex items-center gap-2">
            {analytics && analytics.totalSubmitted > 0 && (
              <button
                type="button"
                onClick={exportToPDF}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                title="Export to PDF"
              >
                <BarChart2Icon size={11} /> Export PDF
              </button>
            )}
            <button type="button" onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted transition-colors">
              <XIcon size={15} />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {loading ? (
            <div className="flex flex-col gap-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}
            </div>
          ) : analytics ? (
            <>
              {/* Summary stats */}
              <p className="text-xs text-muted-foreground">Grading: {gradingModeLabel(analytics.gradingMode ?? assessment.gradingMode)}</p>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Submitted", value: String(analytics.totalSubmitted), sub: `${analytics.uniqueParticipants} unique participants` },
                  { label: "Average Score", value: `${analytics.averageScore}%`, sub: `Pass mark: ${analytics.passMark}%` },
                  { label: "Passed", value: String(analytics.passCount), sub: analytics.totalSubmitted ? `${Math.round((analytics.passCount / analytics.totalSubmitted) * 100)}% pass rate` : "–" },
                  { label: "Participants", value: `${analytics.registeredCount} reg · ${analytics.guestCount} guest`, sub: "registered vs external" },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="rounded-xl border border-border bg-muted/30 p-3">
                    <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
                    <p className="mt-1 text-lg font-bold text-foreground">{value}</p>
                    <p className="text-[11px] text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>

              {/* All submissions sorted high → low */}
              {recentAttempts.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
                    All Submissions — highest to lowest
                  </p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    {[...recentAttempts].sort((a, b) => b.score - a.score).map((att, i, arr) => {
                      const pass = att.percentage >= (analytics?.passMark ?? 50)
                      return (
                        <div key={i} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${i < arr.length - 1 ? "border-b border-border/60" : ""}`}>
                          <span className="w-5 shrink-0 text-center text-[10px] font-bold text-muted-foreground tabular-nums">{i + 1}</span>
                          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${pass ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                            {pass ? "✓" : "✗"}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-foreground truncate">{att.userName}
                              {att.isGuest && <span className="ml-1.5 text-[9px] font-bold uppercase bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">Guest</span>}
                            </p>
                          </div>
                          <span className={`text-sm font-bold tabular-nums ${pass ? "text-emerald-600" : "text-destructive"}`}>
                            {att.percentage}%
                          </span>
                          <span className="text-xs text-muted-foreground shrink-0">
                            {att.score}/{att.total}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {analytics.totalSubmitted === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <TrophyIcon size={28} className="mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No submissions yet.</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-8">Failed to load analytics.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Admin Component ───────────────────────────────────────────────────────
export function LiveAssessmentsAdmin({ onBack }: { onBack?: () => void }) {
  const [assessments, setAssessments] = useState<LiveAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [analyticsTarget, setAnalyticsTarget] = useState<LiveAssessment | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [defaults, setDefaults] = useState<AssessmentDefaults>(FALLBACK_DEFAULTS)
  const [moduleOptions, setModuleOptions] = useState<AssessmentModuleOption[]>([])
  const [optionsLoading, setOptionsLoading] = useState(true)
  const [optionsError, setOptionsError] = useState("")
  const [creationNotice, setCreationNotice] = useState("")

  const fetchAssessments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/assessments")
      const data = await res.json()
      setAssessments(data.assessments ?? [])
      if (data.defaults) setDefaults(data.defaults)
    } catch {
      setAssessments([])
    } finally {
      setLoading(false)
    }
  }, [])

  const fetchModuleOptions = useCallback(async () => {
    setOptionsLoading(true)
    setOptionsError("")
    try {
      const response = await fetch("/api/assessments/options")
      const body = await readJsonResponse(response)
      if (!response.ok || !Array.isArray(body.modules)) {
        throw new Error(typeof body.error === "string" ? body.error : "Unable to load current modules.")
      }
      setModuleOptions(body.modules as AssessmentModuleOption[])
    } catch (cause) {
      setModuleOptions([])
      setOptionsError(cause instanceof Error ? cause.message : "Unable to load current modules.")
    } finally {
      setOptionsLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchAssessments()
    void fetchModuleOptions()
  }, [fetchAssessments, fetchModuleOptions])

  const handleCreated = useCallback((result: { requestedQuestionCount: number; actualQuestionCount: number }) => {
    setCreationNotice(result.actualQuestionCount < result.requestedQuestionCount
      ? `Assessment created with all ${result.actualQuestionCount} eligible questions available.`
      : `Assessment created with ${result.actualQuestionCount} questions.`)
    void fetchAssessments()
    void fetchModuleOptions()
  }, [fetchAssessments, fetchModuleOptions])

  async function toggleStatus(asmt: LiveAssessment) {
    const newStatus = asmt.status === "live" ? "offline" : "live"
    await fetch(`/api/assessments/${asmt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchAssessments()
  }

  async function deleteAssessment(asmt: LiveAssessment) {
    if (!confirm(`Delete "${asmt.title}"? This also removes all attempts.`)) return
    await fetch(`/api/assessments/${asmt.id}?confirm=true`, {
      method: "DELETE",
    })
    fetchAssessments()
  }

  function copyLink(asmt: LiveAssessment) {
    const url = `${window.location.origin}/exam/${asmt.shareToken}`
    navigator.clipboard.writeText(url).catch(() => {})
    setCopiedId(asmt.id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
              title="Back to editor"
            >
              <ChevronLeftIcon size={16} />
            </button>
          )}
          <div>
            <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
              <ClipboardListIcon size={20} className="text-amber-600" />
              Assessments
              <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Admin</span>
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">Create and manage live exams for your students</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" aria-label="Refresh assessments and modules" onClick={() => { void fetchAssessments(); void fetchModuleOptions() }} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCwIcon size={14} />
          </button>
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            <PlusIcon size={14} /> New Assessment
          </button>
        </div>
      </div>

      {creationNotice && <div role="status" className="flex items-center justify-between gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300"><span>{creationNotice}</span><button type="button" onClick={() => setCreationNotice("")} aria-label="Dismiss creation message" className="font-bold">×</button></div>}

      {loading ? (
        <div className="flex flex-col gap-3">
          {[1, 2].map((i) => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}
        </div>
      ) : assessments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <ClipboardListIcon size={28} />
          </div>
          <div>
            <p className="font-semibold text-foreground">No assessments yet</p>
            <p className="mt-1 text-sm text-muted-foreground">Create your first assessment to get started.</p>
          </div>
          <button type="button" onClick={() => setCreateOpen(true)} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm">
            <PlusIcon size={14} /> Create Assessment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {assessments.map((asmt) => (
            <div key={asmt.id} className="rounded-2xl border border-border bg-card overflow-hidden">
              <div className="p-5">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {/* Status toggle */}
                      <button
                        type="button"
                        onClick={() => toggleStatus(asmt)}
                        className={`flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                          asmt.status === "live"
                            ? "border-emerald-300 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:border-emerald-800/40 dark:bg-emerald-900/30 dark:text-emerald-400"
                            : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                        title={`Click to set ${asmt.status === "live" ? "offline" : "live"}`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${asmt.status === "live" ? "bg-emerald-500 animate-pulse" : "bg-muted-foreground"}`} />
                        {asmt.status === "live" ? "Live" : "Offline"}
                        <ChevronDownIcon size={9} />
                      </button>
                      <span className="text-xs text-muted-foreground">{asmt.moduleName}</span>
                    </div>
                    <h3 className="font-bold text-foreground">{asmt.title}</h3>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span>{asmt.questionCount}Q</span>
                      <span className="flex items-center gap-1"><ClockIcon size={10} /> {asmt.timeLimitMins} min</span>
                      <span>{asmt.triesAllowed} tr{asmt.triesAllowed === 1 ? "y" : "ies"}</span>
                      <span><TrophyIcon size={10} className="inline mr-0.5" /> Pass: {asmt.passMark}%</span>
                      <span>{gradingModeLabel(asmt.gradingMode)}</span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex shrink-0 items-center gap-1.5 flex-wrap justify-end">
                    <button
                      type="button"
                      onClick={() => copyLink(asmt)}
                      title="Copy shareable link"
                      className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        copiedId === asmt.id
                          ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800/40 dark:bg-emerald-900/20 dark:text-emerald-400"
                          : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                      }`}
                    >
                      {copiedId === asmt.id ? <><CheckIcon size={11} /> Copied!</> : <><CopyIcon size={11} /> Copy Link</>}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAnalyticsTarget(asmt)}
                      className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/80 transition-colors"
                    >
                      <BarChart2Icon size={11} /> Analytics
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteAssessment(asmt)}
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors"
                    >
                      <TrashIcon size={12} />
                    </button>
                  </div>
                </div>

                {/* Shareable link preview */}
                {asmt.status === "live" && (
                  <div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/50 border border-border px-3 py-2">
                    <LinkIcon size={11} className="text-muted-foreground shrink-0" />
                    <code className="flex-1 text-[11px] text-muted-foreground truncate">
                      {typeof window !== "undefined" ? window.location.origin : ""}/exam/{asmt.shareToken}
                    </code>
                    <button type="button" onClick={() => copyLink(asmt)} className="shrink-0 text-[10px] font-medium text-primary hover:underline">
                      {copiedId === asmt.id ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {createOpen && <CreateModal defaults={defaults} modules={moduleOptions} optionsLoading={optionsLoading} optionsError={optionsError} onRetryOptions={() => void fetchModuleOptions()} onClose={() => setCreateOpen(false)} onCreated={handleCreated} />}
      {analyticsTarget && <AnalyticsModal assessment={analyticsTarget} onClose={() => setAnalyticsTarget(null)} />}
    </div>
  )
}
