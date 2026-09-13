"use client"

import { TheoryGroupSetup } from "@/components/group-study/theory-group-setup"
import { useApplicationShell } from "@/components/authenticated-application-shell"
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
  const { activeStudyHub } = useApplicationShell()
  const [studyType, setStudyType] = useState<"mcq" | "theory">("mcq")
  useEffect(() => { setStudyType(activeStudyHub === "mcq-qbank" ? "mcq" : "theory") }, [activeStudyHub])
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
    <div className="flex items-center gap-3 rounded-2xl border border-primary/15 bg-gradient-to-r from-primary/10 via-primary/[0.04] to-transparent p-4 md:hidden"><span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Users size={18}/></span><div><p className="text-sm font-bold">Study better together</p><p className="mt-0.5 text-xs text-muted-foreground">Create a focused session or join your study group.</p></div></div>
    <p className="hidden text-sm text-muted-foreground md:block">Create a focused session or join your study group.</p>
    <div className="mt-5 flex gap-2" role="group" aria-label="Study type">{(["mcq", "theory"] as const).map(type => <button key={type} onClick={() => setStudyType(type)} aria-pressed={studyType === type} className={`min-h-11 rounded-xl border px-5 font-semibold ${studyType === type ? "bg-primary text-primary-foreground" : "bg-card"}`}>{type === "mcq" ? "MCQ" : "Theory"}</button>)}</div>
    {error && <div role="alert" className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <div className="mt-4 grid gap-4 md:mt-6 md:grid-cols-[1.5fr_1fr] md:gap-5">
      {studyType === "theory" ? <TheoryGroupSetup/> : <><button type="button" disabled={!canCreate} onClick={() => setCreateDialogOpen(true)} className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-primary px-5 font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"><Plus size={20}/>{canCreate ? "Create a room" : "Sign in to create a room"}</button>
      <div className={`${createDialogOpen ? "fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm" : "hidden"} md:static md:z-auto md:block md:bg-transparent md:p-0 md:backdrop-blur-none`} onMouseDown={event => { if (event.target === event.currentTarget && !busy) setCreateDialogOpen(false) }}><section role={createDialogOpen ? "dialog" : undefined} aria-modal={createDialogOpen ? "true" : undefined} aria-labelledby="create-room-title" className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-3xl border border-primary/15 bg-card/95 shadow-2xl ring-1 ring-foreground/[0.03] md:max-h-none md:max-w-none md:overflow-visible md:shadow-[0_18px_60px_-38px_rgba(0,0,0,0.45)]"><div className="relative flex items-center gap-3 overflow-hidden border-b border-primary/10 bg-gradient-to-r from-primary/15 via-primary/[0.06] to-transparent p-5 sm:px-6"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><Plus size={20}/></span><div className="min-w-0 flex-1"><h2 id="create-room-title" className="text-lg font-black">Create a room</h2><p className="text-xs text-muted-foreground">Choose questions, then invite your group</p></div><button type="button" disabled={busy} onClick={() => setCreateDialogOpen(false)} aria-label="Close create room dialog" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:opacity-50 md:hidden"><X size={20}/></button></div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6"><label className="space-y-2 text-sm font-semibold">Module<select value={moduleId} onChange={event => { setModuleId(event.target.value); setDiscipline("") }} className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"><option value="">Choose a module</option>{modules.map(module => <option key={module.id} value={module.id}>{module.id} ({module.total})</option>)}</select></label>
          {selected && <label className="space-y-2 text-sm font-semibold">Discipline<select value={discipline} onChange={event => setDiscipline(event.target.value)} className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 font-normal outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10"><option value="">All disciplines ({selected.total})</option>{selected.disciplines.map(item => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select></label>}
          {selected && <fieldset className="space-y-3 sm:col-span-2"><div className="flex items-center justify-between"><legend className="text-sm font-semibold">Questions</legend><span className="text-xs font-medium text-primary">{questionCount} selected</span></div><div className="grid grid-cols-3 gap-2 sm:grid-cols-6">{SUGGESTED_QUESTION_COUNTS.filter(count => count <= available).map(count => <button key={count} type="button" aria-pressed={!customQuestionCount && !allQuestions && questionCount === count} onClick={() => { setQuestionCount(count); setCustomQuestionCount(false); setAllQuestions(false) }} className={`h-10 rounded-xl border text-sm font-bold transition ${!customQuestionCount && !allQuestions && questionCount === count ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:border-primary/50"}`}>{count}</button>)}<button type="button" disabled={available < 1} aria-pressed={allQuestions} onClick={() => { setQuestionCount(available); setCustomQuestionCount(false); setAllQuestions(true) }} className={`h-10 rounded-xl border text-sm font-bold transition disabled:opacity-35 ${allQuestions ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:border-primary/50"}`}>All</button><button type="button" aria-pressed={customQuestionCount} onClick={() => { setCustomQuestionCount(true); setAllQuestions(false) }} className={`h-10 rounded-xl border text-sm font-bold transition ${customQuestionCount ? "border-primary bg-primary text-primary-foreground shadow-sm" : "bg-background hover:border-primary/50"}`}>Custom</button></div>{customQuestionCount && <input aria-label="Custom question count" type="number" inputMode="numeric" min={1} max={available} value={questionCount} onChange={event => setQuestionCount(Math.max(0, Number(event.target.value)))} className="h-11 w-full rounded-xl border border-border/80 bg-background px-3 outline-none focus:border-primary focus:ring-4 focus:ring-primary/10"/>}</fieldset>}
          <details className="group rounded-2xl border border-border/70 bg-muted/25 sm:col-span-2"><summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-sm font-semibold"><span>Session options</span><span className="text-xs font-normal text-muted-foreground">{timerSeconds ? `${timerSeconds}s` : "No timer"} · {navigationMode === "host_paced" ? "Host-paced" : "Custom pace"}</span></summary><div className="grid gap-4 border-t border-border/60 p-4 sm:grid-cols-2"><label className="space-y-2 text-xs font-semibold">Navigation<select value={navigationMode} onChange={event => setNavigationMode(event.target.value as NavigationMode)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"><option value="host_paced">Host-paced</option><option value="browse_ahead">Browse ahead</option><option value="answer_ahead">Answer ahead</option><option value="anyone_advances">Anyone can proceed</option></select></label><label className="space-y-2 text-xs font-semibold">Answer timer<select value={timerSeconds ?? ""} onChange={event => setTimerSeconds(event.target.value ? Number(event.target.value) : null)} className="h-11 w-full rounded-xl border bg-background px-3 text-sm font-normal"><option value="">No timer</option><option value="30">30 seconds</option><option value="45">45 seconds</option><option value="60">1 minute</option><option value="90">1 min 30 sec</option></select></label></div></details></div>
        <div className="border-t border-border/60 bg-muted/15 p-5 sm:px-6"><button disabled={busy || !canCreate || !moduleId || available < 1 || questionCount < 1 || questionCount > available} onClick={createRoom} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground shadow-lg shadow-primary/15 transition hover:-translate-y-0.5 hover:shadow-xl disabled:translate-y-0 disabled:opacity-50"><Users size={18}/>{busy ? "Creating…" : "Create room"}</button></div></section></div>
      </>}
      <section className="self-start overflow-hidden rounded-3xl border border-border/70 bg-card/95 shadow-[0_18px_60px_-38px_rgba(0,0,0,0.45)] ring-1 ring-foreground/[0.03]"><div className="border-b border-border/60 bg-gradient-to-br from-primary/[0.10] via-primary/[0.04] to-transparent p-4 sm:p-5"><div className="flex items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm"><Users size={16}/></span><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><h2 className="font-black">Join a room</h2>{rejoinAvailable && <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">Active room</span>}</div><p className="mt-0.5 text-xs text-muted-foreground">{rejoinAvailable ? "Your previous room is still active." : "Enter the PIN shared by your host."}</p></div></div></div><div className="p-4 sm:p-5"><label className="text-xs font-bold text-muted-foreground" htmlFor="group-study-pin">Room PIN</label><div className="mt-2 flex gap-2"><input id="group-study-pin" inputMode="numeric" maxLength={6} value={pin} onChange={event => { setPin(event.target.value.replace(/\D/g, "")); setRejoinAvailable(false) }} onKeyDown={event => { if (event.key === "Enter") void joinRoom() }} placeholder="000000" className="h-12 min-w-0 flex-1 rounded-xl border border-border/80 bg-background/80 px-2 text-center text-lg font-black tracking-[0.18em] shadow-inner outline-none transition focus:border-primary focus:ring-4 focus:ring-primary/10 sm:text-xl sm:tracking-[0.25em]"/><button disabled={busy} onClick={() => void joinRoom()} className="h-12 shrink-0 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50">{busy ? "Joining…" : rejoinAvailable ? "Rejoin" : "Join"}</button></div><div className="mt-3 flex items-center gap-2 rounded-xl bg-muted/45 px-3 py-2 text-[11px] leading-4 text-muted-foreground"><Clock3 className="shrink-0 text-primary" size={14}/><p>Late joining is supported without affecting earlier-question accuracy.</p></div></div></section>
    </div>
  </div></main>
}
