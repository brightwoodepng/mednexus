"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { multiplayerApi } from "@/lib/multiplayer-api"
import { rememberGroupStudyPin } from "@/lib/group-study-client"

type Option = { collectionId: string; collectionTitle: string; moduleId: string | null; moduleName: string | null; disciplineId: string | null; disciplineName: string | null; setId: string; setTitle: string; count: number }
const control = "min-h-11 w-full rounded-xl border bg-background px-3 text-sm"

export function TheoryGroupSetup() {
  const router = useRouter()
  const [options, setOptions] = useState<Option[]>([])
  const [collection, setCollection] = useState("")
  const [module, setModule] = useState("")
  const [discipline, setDiscipline] = useState("")
  const [set, setSet] = useState("")
  const [count, setCount] = useState(5)
  const [timer, setTimer] = useState(0)
  const [navigationMode, setNavigationMode] = useState("host_paced")
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  useEffect(() => {
    let active = true
    multiplayerApi<{ theoryOptions: Option[] }>("/api/group-study?studyType=theory")
      .then(data => { if (active) setOptions(data.theoryOptions) })
      .catch(error => { if (active) setError(error.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])
  const collections = [...new Map(options.map(o => [o.collectionId, o.collectionTitle])).entries()]
  const scoped = options.filter(o => o.collectionId === collection)
  const modules = [...new Map(scoped.map(o => [o.moduleId ?? "none", o.moduleName ?? "No module"])).entries()]
  const moduleOptions = scoped.filter(o => (o.moduleId ?? "none") === module)
  const disciplines = [...new Map(moduleOptions.map(o => [o.disciplineId ?? "none", o.disciplineName ?? "General"])).entries()]
  const sets = moduleOptions.filter(o => (o.disciplineId ?? "none") === discipline)
  const selected = sets.find(o => o.setId === set)
  const available = selected?.count ?? 0
  async function create() {
    setBusy(true); setError("")
    try {
      const result = await multiplayerApi<{ pin: string }>("/api/group-study", { method: "POST", body: JSON.stringify({ studyType: "theory", setId: set, questionCount: count, timerSeconds: timer || null, navigationMode }) })
      rememberGroupStudyPin(result.pin)
      router.push(`/group-study/${result.pin}`)
    } catch (error) { setError(error instanceof Error ? error.message : "Unable to create room") }
    finally { setBusy(false) }
  }
  return <section className="rounded-3xl border bg-card p-5 sm:p-7">
    <h2 className="text-lg font-bold">Create a Theory room</h2>
    <p className="mt-1 text-sm text-muted-foreground">Read and discuss together. No answers need to be submitted.</p>
    {loading ? <p className="mt-5" role="status">Loading published theory sets…</p> : options.length === 0 ? <p className="mt-5">No published theory sets are available.</p> : <div className="mt-5 space-y-4">
      <label className="block space-y-2"><span>Collection</span><select className={control} value={collection} onChange={e => { setCollection(e.target.value); setModule(""); setDiscipline(""); setSet("") }}><option value="">Choose collection</option>{collections.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="block space-y-2"><span>Module</span><select disabled={!collection} className={control} value={module} onChange={e => { setModule(e.target.value); setDiscipline(""); setSet("") }}><option value="">Choose module</option>{modules.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="block space-y-2"><span>Discipline</span><select disabled={!module} className={control} value={discipline} onChange={e => { setDiscipline(e.target.value); setSet("") }}><option value="">Choose discipline</option>{disciplines.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
      <label className="block space-y-2"><span>Question set</span><select disabled={!discipline} className={control} value={set} onChange={e => { setSet(e.target.value); setCount(Math.min(5, sets.find(o => o.setId === e.target.value)?.count ?? 5)) }}><option value="">Choose set</option>{sets.map(o => <option key={o.setId} value={o.setId}>{o.setTitle} ({o.count} questions)</option>)}</select></label>
      <label className="block space-y-2"><span>Number of questions</span><input className={control} type="number" min={1} max={available} value={count} onChange={e => setCount(Number(e.target.value))}/></label>
      <button type="button" className="text-sm font-semibold text-primary" disabled={!available} onClick={() => setCount(available)}>Use all {available} questions</button>
      <p className="text-sm text-muted-foreground">Questions follow the original set order.</p>
      <label className="block space-y-2"><span>Navigation</span><select className={control} value={navigationMode} onChange={e => setNavigationMode(e.target.value)}><option value="host_paced">Host-paced</option><option value="browse_ahead">Browse ahead privately</option><option value="anyone_advances">Anyone can proceed</option></select></label>
      <label className="block space-y-2"><span>Discussion timer</span><select className={control} value={[0,120,300,600].includes(timer) ? timer : -1} onChange={e => setTimer(Number(e.target.value) === -1 ? 180 : Number(e.target.value))}><option value={0}>No timer</option><option value={120}>2 minutes</option><option value={300}>5 minutes</option><option value={600}>10 minutes</option><option value={-1}>Custom</option></select></label>
      {timer > 0 && <label className="block space-y-2"><span>Duration in seconds (30–3600)</span><input className={control} type="number" min={30} max={3600} value={timer} onChange={e => setTimer(Number(e.target.value))}/><span className="text-sm text-muted-foreground">A reminder only. The group can continue discussing after time runs out.</span></label>}
      <button disabled={busy || !selected || !Number.isInteger(count) || count < 1 || count > available || (timer !== 0 && (!Number.isInteger(timer) || timer < 30 || timer > 3600))} onClick={create} className="min-h-12 w-full rounded-xl bg-primary px-4 font-bold text-primary-foreground disabled:opacity-40">{busy ? "Creating…" : "Create Theory room"}</button>
    </div>}
    {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
  </section>
}
