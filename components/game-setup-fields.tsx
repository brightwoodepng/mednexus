"use client"

import { useEffect, useState } from "react"

const selectClass = "mt-2 min-h-11 w-full min-w-0 rounded-xl border border-border bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
export function GameScopeDropdowns({ catalog, onChange }: {
  catalog: Array<{ name: string; disciplines: Array<{ name: string }> }>
  onChange: (filter: { module: string | null; discipline: string | null }, ready: boolean) => void
}) {
  const [module, setModule] = useState("")
  const [discipline, setDiscipline] = useState("")
  const disciplines = catalog.find(item => item.name === module)?.disciplines ?? []
  return <div className="mb-4 space-y-4 rounded-2xl border border-border bg-card p-4">
    <label className="block text-xs font-bold text-muted-foreground">Module
      <select className={selectClass} value={module} onChange={event => {
        const next = event.target.value; setModule(next); setDiscipline("")
        onChange({ module: next === "__all" ? null : next || null, discipline: null }, false)
      }}><option value="">Choose a module</option><option value="__all">All modules</option>{catalog.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
    </label>
    {module && <label className="block text-xs font-bold text-muted-foreground">Discipline
      <select className={selectClass} value={discipline} onChange={event => {
        const next = event.target.value; setDiscipline(next)
        onChange({ module: module === "__all" ? null : module, discipline: next === "__all" ? null : next || null }, Boolean(next))
      }}><option value="">Choose a discipline</option><option value="__all">{module === "__all" ? "All disciplines" : "Whole module"}</option>{disciplines.map(item => <option key={item.name} value={item.name}>{item.name}</option>)}</select>
    </label>}
  </div>
}

export function GameQuestionCountDropdown({ available, onChange }: { available: number; onChange: (quantity: number) => void }) {
  const [choice, setChoice] = useState("")
  const [custom, setCustom] = useState("")
  const max = Math.min(available, 500)
  const quantity = choice === "all" ? max : choice === "custom" ? Number(custom) : Number(choice)
  const valid = Number.isInteger(quantity) && quantity > 0 && quantity <= max
  useEffect(() => { onChange(valid ? quantity : 0) }, [quantity, valid, onChange])
  return <div className="mb-4 rounded-2xl border border-border bg-card p-4">
    <label className="block text-xs font-bold text-muted-foreground">Question count
      <select value={choice} onChange={event => setChoice(event.target.value)} className={selectClass}>
        <option value="">Choose question count</option>
        {[10,20,50,75,100,150].map(value => <option key={value} value={value} disabled={value > max}>{value} questions</option>)}
        <option value="all" disabled={!max}>All ({max})</option><option value="custom" disabled={!max}>Custom</option>
      </select>
    </label>
    {choice === "custom" && <label className="mt-4 block text-xs font-bold text-muted-foreground">Custom question count
      <input type="number" inputMode="numeric" min={1} max={max} step={1} value={custom} onChange={event => setCustom(event.target.value)} className={selectClass} placeholder={`1–${max}`}/>
      {custom && !valid && <span role="alert" className="mt-2 block text-xs text-destructive">Enter a whole number from 1 to {max}.</span>}
    </label>}
    <p className="mt-2 text-xs text-muted-foreground">{available} questions available{available > 500 ? " · Up to 500 per round" : ""}</p>
  </div>
}
