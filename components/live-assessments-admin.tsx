"use client"

import { useState, useEffect, useCallback } from "react"
import { useAdmin } from "@/contexts/admin-context"
import { getModules } from "@/lib/modules"
import type { LiveAssessment, AssessmentAnalytics } from "@/lib/types"
import {
  ClipboardListIcon, PlusIcon, TrashIcon, ClockIcon, UsersIcon,
  BarChart2Icon, LinkIcon, CheckIcon, XIcon, AlertTriangleIcon,
  RadioIcon, CopyIcon, RefreshCwIcon, ChevronDownIcon, TrophyIcon,
} from "@/components/icons"

// ── Create Assessment Modal ────────────────────────────────────────────────────
function CreateModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { adminToken } = useAdmin()
  const modules = getModules()
  const [form, setForm] = useState({
    title: "",
    moduleName: modules[0] ?? "",
    questionCount: "20",
    timeLimitMins: "30",
    triesAllowed: "1",
    passMark: "50",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  function set(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim() || !form.moduleName) { setError("Title and module are required."); return }
    setSaving(true)
    setError("")
    try {
      const res = await fetch("/api/assessments", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" },
        body: JSON.stringify({
          title: form.title.trim(),
          moduleName: form.moduleName,
          questionCount: Number(form.questionCount),
          timeLimitMins: Number(form.timeLimitMins),
          triesAllowed: Number(form.triesAllowed),
          passMark: Number(form.passMark),
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? "Failed to create."); return }
      onCreated()
      onClose()
    } catch {
      setError("Network error. Please try again.")
    } finally {
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
            <select className={inputCls} value={form.moduleName} onChange={(e) => set("moduleName", e.target.value)} required>
              {modules.length === 0 ? (
                <option value="">No modules available</option>
              ) : (
                modules.map((m) => <option key={m} value={m}>{m}</option>)
              )}
            </select>
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
          {error && (
            <div className="flex items-center gap-2 rounded-xl bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
              <AlertTriangleIcon size={13} /> {error}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={saving || modules.length === 0} className="flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-60">
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
  const { adminToken } = useAdmin()
  const [loading, setLoading] = useState(true)
  const [analytics, setAnalytics] = useState<AssessmentAnalytics & { uniqueParticipants: number; passMark: number; triesAllowed: number } | null>(null)
  const [recentAttempts, setRecentAttempts] = useState<Array<{ userName: string; isGuest: boolean; score: number; total: number; percentage: number; submittedAt: string }>>([])

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/assessments/${assessment.id}/analytics`, {
          headers: { "x-admin-token": adminToken ?? "" },
        })
        const data = await res.json()
        setAnalytics(data.analytics)
        setRecentAttempts(data.recentAttempts ?? [])
      } catch { /* swallow */ }
      finally { setLoading(false) }
    }
    load()
  }, [assessment.id, adminToken])

  function exportToPDF() {
    if (!analytics) return
    const passMark = analytics.passMark ?? 50
    const passRate = analytics.totalSubmitted
      ? Math.round((analytics.passCount / analytics.totalSubmitted) * 100)
      : 0
    const generatedAt = new Date().toLocaleString()

    const attemptsRows = recentAttempts.map((a) => {
      const passed = a.percentage >= passMark
      return `<tr>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${a.userName}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">
          <span style="font-size:10px;font-weight:600;text-transform:uppercase;padding:2px 7px;border-radius:9999px;background:${a.isGuest ? "#fef9c3" : "#eff6ff"};color:${a.isGuest ? "#a16207" : "#1d4ed8"};">
            ${a.isGuest ? "Guest" : "Registered"}
          </span>
        </td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;">${a.score}/${a.total}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #f3f4f6;font-weight:700;color:${passed ? "#059669" : "#dc2626"};">
          ${a.percentage}% ${passed ? "✓" : "✗"}
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
    .header { margin-bottom: 32px; border-bottom: 2px solid #e5e7eb; padding-bottom: 20px; }
    .header h1 { font-size: 22px; font-weight: 700; color: #111827; margin-bottom: 4px; }
    .header p { color: #6b7280; font-size: 12px; }
    .stats { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; margin-bottom: 32px; }
    .stat { border: 1px solid #e5e7eb; border-radius: 10px; padding: 16px; }
    .stat-label { font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; margin-bottom: 6px; }
    .stat-value { font-size: 26px; font-weight: 700; color: #111827; margin-bottom: 2px; }
    .stat-sub { font-size: 11px; color: #9ca3af; }
    .section-title { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.07em; color: #6b7280; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; }
    thead tr { background: #f9fafb; }
    th { text-align: left; padding: 8px 10px; font-size: 10px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #6b7280; border-bottom: 2px solid #e5e7eb; }
    td { font-size: 13px; color: #111827; vertical-align: middle; }
    .footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 11px; text-align: center; }
    @media print { body { padding: 24px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>${assessment.title}</h1>
    <p>Analytics Report &middot; Generated ${generatedAt} &middot; MedNexus</p>
  </div>

  <div class="stats">
    <div class="stat">
      <div class="stat-label">Total Submitted</div>
      <div class="stat-value">${analytics.totalSubmitted}</div>
      <div class="stat-sub">${analytics.uniqueParticipants} unique participant${analytics.uniqueParticipants === 1 ? "" : "s"}</div>
    </div>
    <div class="stat">
      <div class="stat-label">Average Score</div>
      <div class="stat-value">${analytics.averageScore}%</div>
      <div class="stat-sub">Pass mark: ${passMark}%</div>
    </div>
    <div class="stat">
      <div class="stat-label">Passed</div>
      <div class="stat-value" style="color:#059669;">${analytics.passCount}</div>
      <div class="stat-sub">${passRate}% pass rate</div>
    </div>
    <div class="stat">
      <div class="stat-label">Breakdown</div>
      <div class="stat-value" style="font-size:18px;">${analytics.registeredCount} reg · ${analytics.guestCount} guest</div>
      <div class="stat-sub">registered vs external guests</div>
    </div>
  </div>

  ${recentAttempts.length > 0 ? `
  <div class="section-title">Submissions (last ${recentAttempts.length})</div>
  <table>
    <thead>
      <tr>
        <th>Name</th>
        <th>Type</th>
        <th>Score</th>
        <th>Result</th>
      </tr>
    </thead>
    <tbody>${attemptsRows}</tbody>
  </table>` : "<p style=\"color:#9ca3af;text-align:center;padding:24px 0;\">No submissions recorded.</p>"}

  <div class="footer">MedNexus &mdash; Confidential &mdash; ${assessment.title}</div>
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

              {/* Recent attempts */}
              {recentAttempts.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">Recent Submissions</p>
                  <div className="rounded-xl border border-border overflow-hidden">
                    {recentAttempts.map((att, i) => (
                      <div key={i} className={`flex items-center gap-3 px-3 py-2.5 text-sm ${i < recentAttempts.length - 1 ? "border-b border-border/60" : ""}`}>
                        <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${att.percentage >= (analytics?.passMark ?? 50) ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-destructive/10 text-destructive"}`}>
                          {att.percentage >= (analytics?.passMark ?? 50) ? "✓" : "✗"}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{att.userName}
                            {att.isGuest && <span className="ml-1.5 text-[9px] font-bold uppercase bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">Guest</span>}
                          </p>
                        </div>
                        <span className={`text-sm font-bold tabular-nums ${att.percentage >= (analytics?.passMark ?? 50) ? "text-emerald-600" : "text-destructive"}`}>
                          {att.percentage}%
                        </span>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {att.score}/{att.total}
                        </span>
                      </div>
                    ))}
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
export function LiveAssessmentsAdmin() {
  const { adminToken } = useAdmin()
  const [assessments, setAssessments] = useState<LiveAssessment[]>([])
  const [loading, setLoading] = useState(true)
  const [createOpen, setCreateOpen] = useState(false)
  const [analyticsTarget, setAnalyticsTarget] = useState<LiveAssessment | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  const fetchAssessments = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/assessments", {
        headers: { "x-admin-token": adminToken ?? "" },
      })
      const data = await res.json()
      setAssessments(data.assessments ?? [])
    } catch {
      setAssessments([])
    } finally {
      setLoading(false)
    }
  }, [adminToken])

  useEffect(() => { fetchAssessments() }, [fetchAssessments])

  async function toggleStatus(asmt: LiveAssessment) {
    const newStatus = asmt.status === "live" ? "offline" : "live"
    await fetch(`/api/assessments/${asmt.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", "x-admin-token": adminToken ?? "" },
      body: JSON.stringify({ status: newStatus }),
    })
    fetchAssessments()
  }

  async function deleteAssessment(asmt: LiveAssessment) {
    if (!confirm(`Delete "${asmt.title}"? This also removes all attempts.`)) return
    await fetch(`/api/assessments/${asmt.id}`, {
      method: "DELETE",
      headers: { "x-admin-token": adminToken ?? "" },
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
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ClipboardListIcon size={20} className="text-amber-600" />
            Assessments
            <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Admin</span>
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create and manage live exams for your students</p>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={fetchAssessments} className="flex h-8 w-8 items-center justify-center rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors">
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

      {createOpen && <CreateModal onClose={() => setCreateOpen(false)} onCreated={fetchAssessments} />}
      {analyticsTarget && <AnalyticsModal assessment={analyticsTarget} onClose={() => setAnalyticsTarget(null)} />}
    </div>
  )
}
