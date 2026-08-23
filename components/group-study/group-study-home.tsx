"use client"

import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Clock3, Plus, Users, X } from "lucide-react"
import { multiplayerApi, MultiplayerApiError } from "@/lib/multiplayer-api"
import { forgetGroupStudyPin, LAST_GROUP_STUDY_PIN_KEY, rememberGroupStudyPin } from "@/lib/group-study-client"

type ModuleOption = { id: string; total: number; disciplines: { name: string; count: number }[] }
type NavigationMode = "host_paced" | "browse_ahead" | "answer_ahead" | "anyone_advances"
const SUGGESTED_QUESTION_COUNTS = [10, 20, 30, 50] as const

export function GroupStudyHome() {
  const router = useRouter()
  const [modules, setModules] = useState<ModuleOption[]>([])
  const [moduleId, setModuleId] = useState("")
  const [discipline, setDiscipline] = useState("")
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null)
  const [navigationMode, setNavigationMode] = useState<NavigationMode>("host_paced")
  const [questionCount, setQuestionCount] = useState(30)
  const [customQuestionCount, setCustomQuestionCount] = useState(false)
  const [allQuestions, setAllQuestions] = useState(false)
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [canCreate, setCanCreate] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [rejoinAvailable, setRejoinAvailable] = useState(false)

  useEffect(() => {
    multiplayerApi<{ modules: ModuleOption[]; canCreate: boolean }>("/api/group-study")
      .then(data => { setModules(data.modules); setModuleId(data.modules[0]?.id ?? ""); setCanCreate(data.canCreate) })
      .catch(error => setError(error instanceof MultiplayerApiError && error.status === 401 ? "Sign in or continue as a guest to use Group Study." : error.message))
  }, [])
  useEffect(() => {
    const savedPin = window.localStorage.getItem(LAST_GROUP_STUDY_PIN_KEY)?.replace(/\D/g, "").slice(0, 6) ?? ""
    if (savedPin.length !== 6) { forgetGroupStudyPin(); return }
    multiplayerApi<{ active: boolean; pin: string }>(`/api/group-study/${savedPin}?check=1`)
      .then(data => { if (data.active) { setPin(savedPin); setRejoinAvailable(true) } else forgetGroupStudyPin() })
      .catch(error => { if (error instanceof MultiplayerApiError && error.code && ["ROOM_NOT_FOUND", "ROOM_EXPIRED", "ROOM_CLOSED"].includes(error.code)) forgetGroupStudyPin() })
  }, [])
  const selected = modules.find(module => module.id === moduleId)
  const available = discipline ? selected?.disciplines.find(item => item.name === discipline)?.count ?? 0 : selected?.total ?? 0

  useEffect(() => {
    if (!available) return
    if (allQuestions) {
      setQuestionCount(available)
      return
    }
    setQuestionCount(current => {
      const next = Math.min(Math.max(1, current), available)
      if (!SUGGESTED_QUESTION_COUNTS.includes(next as typeof SUGGESTED_QUESTION_COUNTS[number])) setCustomQuestionCount(true)
      return next
    })
  }, [allQuestions, available])

  useEffect(() => {
    if (!createDialogOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !busy) setCreateDialogOpen(false)
    }
    document.addEventListener("keydown", closeOnEscape)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", closeOnEscape)
      document.body.style.overflow = previousOverflow
    }
  }, [busy, createDialogOpen])

  async function createRoom() {
    setBusy(true); setError("")
    try {
      const room = await multiplayerApi<{ pin: string }>("/api/group-study", { method: "POST", body: JSON.stringify({ moduleId, discipline, questionCount, timerSeconds, navigationMode }) })
      rememberGroupStudyPin(room.pin)
      router.push(`/group-study/${room.pin}`)
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create room") } finally { setBusy(false) }
  }
  async function joinRoom() {
    const normalized = pin.replace(/\D/g, "").slice(0, 6)
    if (normalized.length !== 6) return setError("Enter the six-digit room PIN.")
    setBusy(true); setError("")
    try {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          await multiplayerApi(`/api/group-study/${normalized}`, { method: "POST", body: JSON.stringify({ action: "join" }) })
          break
        } catch (error) {
          if (!(error instanceof MultiplayerApiError) || error.code !== "ROOM_NOT_FOUND" || attempt === 2) throw error
          await new Promise(resolve => window.setTimeout(resolve, 350 * (attempt + 1)))
        }
      }
      rememberGroupStudyPin(normalized)
      router.push(`/group-study/${normalized}`)
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to join room") } finally { setBusy(false) }
  }

  return <main className="relative min-h-screen overflow-hidden bg-background text-foreground"><div className="pointer-events-none absolute -left-32 top-20 h-80 w-80 rounded-full bg-primary/[0.06] blur-3xl"/><div className="pointer-events-none absolute -right-40 top-1/3 h-96 w-96 rounded-full bg-primary/[0.04] blur-3xl"/><div className="relative mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
    <p className="text-sm text-muted-foreground">Create a focused session or join your study group.</p>
    {error && <div role="alert" className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <div className="mt-6 grid gap-5 md:grid-cols-[1.5fr_1fr]">
      <button type="button" disabled={!canCreate} onClick={() => setCreateDialogOpen(true)} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"><Plus size={20}/>{canCreate ? "Create a room" : "Sign in to create a room"}</button>
      <div className={`${createDialogOpen ? "fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" : "hidden"} md:static md:z-auto md:block md:bg-transparent md:p-0 md:backdrop-blur-none`} onMouseDown={event => { if (event.target === event.currentTarget && !busy) setCreateDialogOpen(false) }}><section role={createDialogOpen ? "dialog" : undefined} aria-modal={createDialogOpen ? "true" : undefined} aria-labelledby="create-room-title" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-border/70 bg-card/95 p-5 shadow-2xl ring-1 ring-foreground/[0.03] sm:p-7 md:max-h-none md:max-w-none md:overflow-visible md:shadow-[0_18px_60px_-38px_rgba(0,0,0,0.45)]"><div className="flex items-start gap-3"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10"><Plus size={19}/></span><div className="min-w-0 flex-1"><h2 id="create-room-title" className="font-bold">Create a room</h2><p className="text-xs text-muted-foreground">Set up the session and invite up to 10 participants</p></div><button type="button" disabled={busy} onClick={() => setCreateDialogOpen(false)} aria-label="Close create room dialog" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50 md:hidden"><X size={20}/></button></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold sm:col-span-2">Module<select value={moduleId} onChange={event => { setModuleId(event.target.value); setDiscipline("") }} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">Choose a module</option>{modules.map(module => <option key={module.id} value={module.id}>{module.id} ({module.total})</option>)}</select></label>
          {selected && <label className="space-y-2 text-sm font-semibold sm:col-span-2">Discipline<select value={discipline} onChange={event => setDiscipline(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">All disciplines ({selected.total})</option>{selected.disciplines.map(item => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select></label>}
          {selected && <fieldset className="space-y-3 sm:col-span-2"><legend className="text-sm font-semibold">Number of questions</legend><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{SUGGESTED_QUESTION_COUNTS.map(count => <button key={count} type="button" disabled={count > available} aria-pressed={!customQuestionCount && !allQuestions && questionCount === count} onClick={() => { setQuestionCount(count); setCustomQuestionCount(false); setAllQuestions(false) }} className={`h-11 rounded-xl border text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${!customQuestionCount && !allQuestions && questionCount === count ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}>{count}</button>)}<button type="button" disabled={available < 1} aria-pressed={allQuestions} onClick={() => { setQuestionCount(available); setCustomQuestionCount(false); setAllQuestions(true) }} className={`h-11 rounded-xl border text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${allQuestions ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}>All</button><button type="button" aria-pressed={customQuestionCount} onClick={() => { setCustomQuestionCount(true); setAllQuestions(false) }} className={`h-11 rounded-xl border text-sm font-bold transition ${customQuestionCount ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}>Custom</button></div>{customQuestionCount && <label className="block space-y-2 text-sm font-medium"><span>Custom amount</span><input type="number" inputMode="numeric" min={1} max={available} value={questionCount} onChange={event => setQuestionCount(Math.max(0, Number(event.target.value)))} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"/><span className="block text-xs font-normal text-muted-foreground">Choose between 1 and {available} available questions.</span></label>}<p className="text-xs text-muted-foreground">{questionCount} of {available} available questions selected</p></fieldset>}
          <label className="space-y-2 text-sm font-semibold sm:col-span-2">Navigation mode<select value={navigationMode} onChange={event => setNavigationMode(event.target.value as NavigationMode)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="host_paced">Default (host-paced)</option><option value="browse_ahead">Browse ahead only</option><option value="answer_ahead">Browse and answer ahead</option><option value="anyone_advances">Anyone can proceed</option></select><span className="block text-xs font-normal text-muted-foreground">{navigationMode === "host_paced" ? "Review previous questions; future questions stay locked until the host advances." : navigationMode === "browse_ahead" ? "Preview future questions; answer only the live question." : navigationMode === "answer_ahead" ? "Answer future questions and see private feedback immediately." : "Future questions stay locked; anyone may advance after reveal."}</span></label>
          <label className="space-y-2 text-sm font-semibold sm:col-span-2">Answer timer<select value={timerSeconds ?? ""} onChange={event => setTimerSeconds(event.target.value ? Number(event.target.value) : null)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">No timer</option><option value="30">30 seconds</option><option value="45">45 seconds</option><option value="60">1 minute</option><option value="90">1 minute 30 seconds</option></select></label></div>
        <div className="mt-6 grid gap-3 sm:grid-cols-[1fr_2fr] md:block"><button type="button" disabled={busy} onClick={() => setCreateDialogOpen(false)} className="h-12 rounded-xl border font-bold transition hover:bg-muted disabled:opacity-50 md:hidden">Cancel</button><button disabled={busy || !canCreate || !moduleId || available < 1 || questionCount < 1 || questionCount > available} onClick={createRoom} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"><Users size={18}/>{busy ? "Working…" : "Create Group Study room"}</button></div></section></div>
      <section className="self-start overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-[0_18px_60px_-38px_rgba(0,0,0,0.45)] ring-1 ring-foreground/[0.03]"><div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent p-5 sm:p-7"><span className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-primary/20"><Users size={18}/></span><div className="flex items-center gap-2"><h2 className="text-lg font-black">Join a room</h2>{rejoinAvailable && <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Active room</span>}</div><p className="mt-1 text-xs text-muted-foreground">{rejoinAvailable ? "Your previous room is still active." : "Enter the six-digit PIN shared by your host."}</p></div><div className="p-5 sm:p-7"><label className="block space-y-2 text-sm font-semibold">Room PIN<input inputMode="numeric" maxLength={6} value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, "")); setRejoinAvailable(false) }} onKeyDown={event => { if (event.key === "Enter") void joinRoom() }} placeholder="000000" className="h-16 w-full rounded-2xl border border-border/80 bg-background/80 px-4 text-center text-2xl font-black tracking-[0.35em] shadow-inner outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"/></label><button disabled={busy} onClick={() => void joinRoom()} className="mt-4 h-12 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-md shadow-primary/15 transition hover:-translate-y-0.5 hover:shadow-lg disabled:translate-y-0 disabled:opacity-50">{busy ? "Joining…" : rejoinAvailable ? "Rejoin room" : "Join with PIN"}</button><div className="mt-5 flex gap-3 rounded-2xl border border-border/50 bg-muted/45 p-4 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 shrink-0 text-primary" size={16}/><p>Late joining is supported. Earlier questions will not count against your accuracy or streak.</p></div></div></section>
    </div>
  </div></main>
}
