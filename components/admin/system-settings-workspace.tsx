"use client"

import { useCallback, useEffect, useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, Clock3, Database, History, Loader2, RotateCcw, Save, Server } from "lucide-react"

type Settings = {
  registrationEnabled: boolean
  guestAccessEnabled: boolean
  registrationApprovalMode: "verified_index" | "manual"
  maintenanceEnabled: boolean
  maintenanceMessage: string
  assessmentDefaultQuestionCount: number
  assessmentDefaultTimeLimitMins: number
  assessmentDefaultTriesAllowed: number
  assessmentDefaultPassMark: number
  theoryDefaultSetSize: number
  updatedAt: string | null
}

const sections = [
  { title: "Access", description: "Control new registrations and temporary guest accounts." },
  { title: "Maintenance", description: "Pause learner workspaces without interrupting sign-in, administrators, or live token assessments." },
  { title: "Assessment Defaults", description: "Defaults used when an administrator creates a new assessment." },
  { title: "Theory Defaults", description: "Default capacity for newly created Theory sets." },
]

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
    className={`relative h-7 w-12 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${checked ? "bg-primary" : "bg-muted-foreground/30"}`}>
    <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-transform ${checked ? "translate-x-6" : "translate-x-1"}`} />
  </button>
}

export function SystemSettingsWorkspace() {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [current, setCurrent] = useState<Settings | null>(null)
  const [health, setHealth] = useState<{ database: string; responseTimeMs: number; schemaVersion: string; checkedAt: string } | null>(null)
  const [audit, setAudit] = useState<Array<{ action: string; createdAt: string; actorId: string }>>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState("")

  const load = useCallback(async () => {
    setLoading(true); setMessage("")
    try { const response = await fetch("/api/admin/settings", { cache: "no-store" }); const body = await response.json().catch(() => ({})); if (!response.ok) throw new Error(body.error || "Unable to load settings"); setSettings(body.settings); setCurrent(body.settings); setHealth(body.health); setAudit(body.audit ?? []) }
    catch (error) { setMessage(error instanceof Error ? error.message : "Unable to load settings") }
    finally { setLoading(false) }
  }, [])
  useEffect(() => { void load() }, [load])

  async function save() {
    if (!settings) return
    const highImpact = settings.maintenanceEnabled || !settings.registrationEnabled || !settings.guestAccessEnabled
    if (highImpact && !window.confirm("This change affects learner access. Apply it now?")) return
    setSaving(true)
    setMessage("")
    try {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH", headers: { "content-type": "application/json" },
        body: JSON.stringify({ ...settings, confirm: true }),
      })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Settings were not changed")
      setSettings(body.settings)
      setCurrent(body.settings)
      setMessage("Settings saved. The active platform configuration is now updated.")
      window.setTimeout(() => void load(), 400)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Settings were not changed")
    } finally { setSaving(false) }
  }

  if (loading) return <div className="flex min-h-56 items-center justify-center"><Loader2 className="animate-spin text-primary" /></div>
  if (!settings) return <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-5 text-sm text-destructive"><p>{message || "Settings are unavailable."}</p><button onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-lg border border-destructive/30 px-4 font-bold"><RotateCcw size={15}/>Retry</button></div>

  const inputClass = "h-10 w-full rounded-lg border border-border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
  const dirty = JSON.stringify(settings) !== JSON.stringify(current)
  const errors = [
    settings.maintenanceEnabled && !settings.maintenanceMessage.trim() ? "Add a learner-facing maintenance message." : "",
    settings.assessmentDefaultPassMark < 1 || settings.assessmentDefaultPassMark > 100 ? "Pass mark must be between 1 and 100." : "",
    settings.theoryDefaultSetSize < 15 || settings.theoryDefaultSetSize > 20 ? "Theory set size must be between 15 and 20." : "",
  ].filter(Boolean)
  return <div className="max-w-5xl space-y-5">
    <div><p className="text-sm font-semibold tracking-wide text-primary">SYSTEM</p><h1 className="mt-2 text-3xl font-bold">System Settings</h1><p className="mt-2 text-sm text-muted-foreground">Server-enforced platform controls. Changes are atomic and recorded in the audit trail.</p></div>

    <section className="rounded-xl border border-border bg-card p-5">
      <h2 className="font-semibold">{sections[0].title}</h2><p className="mt-1 text-sm text-muted-foreground">{sections[0].description}</p>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <label className="flex items-center justify-between rounded-lg border border-border p-4"><span><span className="block text-sm font-medium">Registration</span><span className="text-xs text-muted-foreground">Allow creation of new student accounts</span></span><Toggle label="Registration enabled" checked={settings.registrationEnabled} onChange={(value) => setSettings({ ...settings, registrationEnabled: value })} /></label>
        <label className="flex items-center justify-between rounded-lg border border-border p-4"><span><span className="block text-sm font-medium">Guest access</span><span className="text-xs text-muted-foreground">Allow creation of temporary accounts</span></span><Toggle label="Guest access enabled" checked={settings.guestAccessEnabled} onChange={(value) => setSettings({ ...settings, guestAccessEnabled: value })} /></label>
        <label className="sm:col-span-2"><span className="mb-1.5 block text-sm font-medium">Registration approval</span><select className={inputClass} value={settings.registrationApprovalMode} onChange={(event) => setSettings({ ...settings, registrationApprovalMode: event.target.value as Settings["registrationApprovalMode"] })}><option value="verified_index">Auto-approve verified institutional index numbers</option><option value="manual">Require approval for every registration</option></select></label>
      </div>
    </section>

    <section className={`rounded-xl border p-5 ${settings.maintenanceEnabled ? "border-amber-400/50 bg-amber-50/50 dark:bg-amber-950/20" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-4"><div><h2 className="font-semibold">{sections[1].title}</h2><p className="mt-1 text-sm text-muted-foreground">{sections[1].description}</p></div><Toggle label="Maintenance enabled" checked={settings.maintenanceEnabled} onChange={(value) => setSettings({ ...settings, maintenanceEnabled: value })} /></div>
      <label className="mt-4 block"><span className="mb-1.5 block text-sm font-medium">Learner-facing message</span><textarea className="min-h-24 w-full rounded-lg border border-border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50" maxLength={500} value={settings.maintenanceMessage} onChange={(event) => setSettings({ ...settings, maintenanceMessage: event.target.value })} /></label>
    </section>

    <section className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">{sections[2].title}</h2><p className="mt-1 text-sm text-muted-foreground">{sections[2].description}</p><div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[["Questions", "assessmentDefaultQuestionCount", 1, 200], ["Minutes", "assessmentDefaultTimeLimitMins", 1, 360], ["Attempts", "assessmentDefaultTriesAllowed", 1, 20], ["Pass mark (%)", "assessmentDefaultPassMark", 1, 100]].map(([label, key, min, max]) => <label key={String(key)}><span className="mb-1.5 block text-sm font-medium">{label}</span><input type="number" min={Number(min)} max={Number(max)} className={inputClass} value={settings[key as keyof Settings] as number} onChange={(event) => setSettings({ ...settings, [key]: Number(event.target.value) })} /></label>)}
    </div></section>

    <section className="rounded-xl border border-border bg-card p-5"><h2 className="font-semibold">{sections[3].title}</h2><p className="mt-1 text-sm text-muted-foreground">{sections[3].description}</p><label className="mt-4 block max-w-xs"><span className="mb-1.5 block text-sm font-medium">Default set size</span><input type="number" min={15} max={20} className={inputClass} value={settings.theoryDefaultSetSize} onChange={(event) => setSettings({ ...settings, theoryDefaultSetSize: Number(event.target.value) })} /></label></section>

    <section className="space-y-3"><div><h2 className="font-semibold">Operational overview</h2><p className="mt-1 text-sm text-muted-foreground">Live platform diagnostics for administrators.</p></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <div className="rounded-xl border border-border bg-card p-4"><Database size={18} className="text-emerald-500"/><p className="mt-3 text-xs text-muted-foreground">Database</p><p className="mt-1 font-bold capitalize text-emerald-600">{health?.database ?? "Unknown"}</p></div>
      <div className="rounded-xl border border-border bg-card p-4"><Activity size={18} className="text-primary"/><p className="mt-3 text-xs text-muted-foreground">Response time</p><p className="mt-1 font-bold">{health ? `${health.responseTimeMs} ms` : "—"}</p></div>
      <div className="rounded-xl border border-border bg-card p-4"><Server size={18} className="text-primary"/><p className="mt-3 text-xs text-muted-foreground">Schema version</p><p className="mt-1 truncate text-sm font-bold" title={health?.schemaVersion}>{health?.schemaVersion ?? "—"}</p></div>
      <div className="rounded-xl border border-border bg-card p-4"><Clock3 size={18} className="text-primary"/><p className="mt-3 text-xs text-muted-foreground">Server checked</p><p className="mt-1 text-sm font-bold">{health?.checkedAt ? new Date(health.checkedAt).toLocaleString() : "—"}</p></div>
    </div></section>

    <section className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-2"><History size={18} className="text-primary"/><h2 className="font-semibold">Recent settings activity</h2></div>{audit.length?<div className="mt-4 divide-y divide-border">{audit.map((item,index)=><div key={`${item.createdAt}-${index}`} className="flex items-center justify-between gap-3 py-3 text-sm"><span className="capitalize">{item.action.replaceAll("_", " ")}</span><time className="text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString()}</time></div>)}</div>:<p className="mt-3 text-sm text-muted-foreground">No recent settings changes.</p>}</section>

    {errors.length>0&&<div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"><b>Review these settings:</b><ul className="mt-2 list-disc pl-5">{errors.map(error=><li key={error}>{error}</li>)}</ul></div>}

    <div className="sticky bottom-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
      <span className="flex items-center gap-2 text-xs text-muted-foreground">{message ? <CheckCircle2 size={15} className="text-emerald-500" /> : <AlertTriangle size={15} />}{message || (dirty ? "Unsaved changes" : settings.updatedAt ? `Last updated ${new Date(settings.updatedAt).toLocaleString()}` : "Using platform defaults")}</span>
      <div className="flex gap-2"><button type="button" disabled={!dirty||saving} onClick={()=>current&&setSettings({...current})} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border px-4 text-sm font-semibold disabled:opacity-40"><RotateCcw size={15}/>Reset to current</button><button type="button" disabled={saving||!dirty||errors.length>0} onClick={save} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}Save Settings</button></div>
    </div>
  </div>
}
