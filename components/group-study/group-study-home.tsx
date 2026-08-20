"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { ArrowLeft, Clock3, Plus, Users } from "lucide-react"
import { multiplayerApi, MultiplayerApiError } from "@/lib/multiplayer-api"

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
  const [pin, setPin] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [canCreate, setCanCreate] = useState(false)

  useEffect(() => {
    multiplayerApi<{ modules: ModuleOption[]; canCreate: boolean }>("/api/group-study")
      .then(data => { setModules(data.modules); setModuleId(data.modules[0]?.id ?? ""); setCanCreate(data.canCreate) })
      .catch(error => setError(error instanceof MultiplayerApiError && error.status === 401 ? "Sign in or continue as a guest to use Group Study." : error.message))
  }, [])
  const selected = modules.find(module => module.id === moduleId)
  const available = discipline ? selected?.disciplines.find(item => item.name === discipline)?.count ?? 0 : selected?.total ?? 0

  useEffect(() => {
    if (!available) return
    setQuestionCount(current => {
      const next = Math.min(Math.max(1, current), available)
      if (!SUGGESTED_QUESTION_COUNTS.includes(next as typeof SUGGESTED_QUESTION_COUNTS[number])) setCustomQuestionCount(true)
      return next
    })
  }, [available])

  async function createRoom() {
    setBusy(true); setError("")
    try {
      const room = await multiplayerApi<{ pin: string }>("/api/group-study", { method: "POST", body: JSON.stringify({ moduleId, discipline, questionCount, timerSeconds, navigationMode }) })
      router.push(`/group-study/${room.pin}`)
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create room") } finally { setBusy(false) }
  }
  async function joinRoom() {
    const normalized = pin.replace(/\D/g, "").slice(0, 6)
    if (normalized.length !== 6) return setError("Enter the six-digit room PIN.")
    setBusy(true); setError("")
    try {
      await multiplayerApi(`/api/group-study/${normalized}`, { method: "POST", body: JSON.stringify({ action: "join" }) })
      router.push(`/group-study/${normalized}`)
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to join room") } finally { setBusy(false) }
  }

  return <main className="min-h-screen bg-background text-foreground"><div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-10">
    <Link href="/" className="inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"><ArrowLeft size={16}/>MCQ dashboard</Link>
    <header className="mt-6 flex items-center gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary"><Users size={22}/></span><h1 className="text-2xl font-black tracking-tight sm:text-3xl">Group Study</h1></header>
    {error && <div role="alert" className="mt-5 rounded-2xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>}
    <div className="mt-6 grid gap-5 lg:grid-cols-[1.5fr_1fr]">
      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Plus size={19}/></span><div><h2 className="font-bold">Create a room</h2><p className="text-xs text-muted-foreground">{canCreate ? "Host up to 10 registered or guest participants" : "Guests can join rooms; sign in to create one"}</p></div></div>
        <div className="mt-6 grid gap-4 sm:grid-cols-2"><label className="space-y-2 text-sm font-semibold sm:col-span-2">Module<select value={moduleId} onChange={event => { setModuleId(event.target.value); setDiscipline("") }} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">Choose a module</option>{modules.map(module => <option key={module.id} value={module.id}>{module.id} ({module.total})</option>)}</select></label>
          {selected && <label className="space-y-2 text-sm font-semibold sm:col-span-2">Discipline<select value={discipline} onChange={event => setDiscipline(event.target.value)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">All disciplines ({selected.total})</option>{selected.disciplines.map(item => <option key={item.name} value={item.name}>{item.name} ({item.count})</option>)}</select></label>}
          {selected && <fieldset className="space-y-3 sm:col-span-2"><legend className="text-sm font-semibold">Number of questions</legend><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{SUGGESTED_QUESTION_COUNTS.map(count => <button key={count} type="button" disabled={count > available} aria-pressed={!customQuestionCount && questionCount === count} onClick={() => { setQuestionCount(count); setCustomQuestionCount(false) }} className={`h-11 rounded-xl border text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-35 ${!customQuestionCount && questionCount === count ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}>{count}</button>)}<button type="button" aria-pressed={customQuestionCount} onClick={() => setCustomQuestionCount(true)} className={`col-span-2 h-11 rounded-xl border text-sm font-bold transition sm:col-span-1 ${customQuestionCount ? "border-primary bg-primary text-primary-foreground" : "bg-background hover:border-primary/50"}`}>Custom</button></div>{customQuestionCount && <label className="block space-y-2 text-sm font-medium"><span>Custom amount</span><input type="number" inputMode="numeric" min={1} max={available} value={questionCount} onChange={event => setQuestionCount(Math.max(0, Number(event.target.value)))} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"/><span className="block text-xs font-normal text-muted-foreground">Choose between 1 and {available} available questions.</span></label>}<p className="text-xs text-muted-foreground">{questionCount} of {available} available questions selected</p></fieldset>}
          <label className="space-y-2 text-sm font-semibold sm:col-span-2">Navigation mode<select value={navigationMode} onChange={event => setNavigationMode(event.target.value as NavigationMode)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="host_paced">Default (host-paced)</option><option value="browse_ahead">Browse ahead only</option><option value="answer_ahead">Browse and answer ahead</option><option value="anyone_advances">Anyone can proceed</option></select><span className="block text-xs font-normal text-muted-foreground">{navigationMode === "host_paced" ? "Review previous questions; future questions stay locked until the host advances." : navigationMode === "browse_ahead" ? "Preview future questions; answer only the live question." : navigationMode === "answer_ahead" ? "Answer future questions and see private feedback immediately." : "Future questions stay locked; anyone may advance after reveal."}</span></label>
          <label className="space-y-2 text-sm font-semibold sm:col-span-2">Answer timer<select value={timerSeconds ?? ""} onChange={event => setTimerSeconds(event.target.value ? Number(event.target.value) : null)} className="h-11 w-full rounded-xl border bg-background px-3 font-normal"><option value="">No timer</option><option value="30">30 seconds</option><option value="45">45 seconds</option><option value="60">1 minute</option><option value="90">1 minute 30 seconds</option></select></label></div>
        <button disabled={busy || !canCreate || !moduleId || available < 1 || questionCount < 1 || questionCount > available} onClick={createRoom} className="mt-6 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary font-bold text-primary-foreground shadow-sm transition hover:opacity-90 disabled:opacity-50"><Users size={18}/>{busy ? "Working…" : canCreate ? "Create Group Study room" : "Registered account required"}</button></section>
      <section className="rounded-3xl border bg-card p-5 shadow-sm sm:p-7"><h2 className="font-bold">Join a room</h2><p className="mt-1 text-xs text-muted-foreground">Registered and guest accounts can join</p><label className="mt-6 block space-y-2 text-sm font-semibold">Room PIN<input inputMode="numeric" maxLength={6} value={pin} onChange={event => setPin(event.target.value.replace(/\D/g, ""))} onKeyDown={event => { if (event.key === "Enter") void joinRoom() }} placeholder="000000" className="h-14 w-full rounded-2xl border bg-background px-4 text-center text-2xl font-black tracking-[0.35em]"/></label><button disabled={busy} onClick={() => void joinRoom()} className="mt-4 h-12 w-full rounded-xl border border-primary/30 bg-primary/10 font-bold text-primary hover:bg-primary/15 disabled:opacity-50">{busy ? "Joining…" : "Join with PIN"}</button><div className="mt-6 flex gap-3 rounded-2xl bg-muted/60 p-4 text-xs leading-5 text-muted-foreground"><Clock3 className="mt-0.5 shrink-0" size={16}/><p>Late joining is supported. Earlier questions will not count against your accuracy or streak.</p></div></section>
    </div>
  </div></main>
}
