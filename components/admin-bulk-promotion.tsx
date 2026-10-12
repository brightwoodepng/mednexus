"use client"

import { useEffect, useState } from "react"
import { CLASS_LEVELS } from "@/lib/levels"

type Student = { uid: string; name: string; index_number: string; level: string }

export function AdminBulkPromotion({ onComplete }: { onComplete: () => void }) {
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState("Level 400")
  const [to, setTo] = useState("Level 500")
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const [users, setUsers] = useState<Student[]>([])
  const [total, setTotal] = useState(0)
  const [selected, setSelected] = useState<Record<string, Student>>({})
  const [review, setReview] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [reload, setReload] = useState(0)
  const students = Object.values(selected)
  const button = "rounded-xl border border-border px-3 py-2 text-sm disabled:opacity-50"

  useEffect(() => {
    if (!open) return
    const controller = new AbortController()
    setLoading(true)
    const timer = setTimeout(async () => {
      try {
        const params = new URLSearchParams({ level: from, search, page: String(page) })
        const res = await fetch(`/api/admin/users/promote?${params}`, { signal: controller.signal })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setUsers(data.users); setTotal(data.total); setError("")
      } catch (cause) {
        if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Unable to load students.")
      } finally { if (!controller.signal.aborted) setLoading(false) }
    }, 250)
    return () => { clearTimeout(timer); controller.abort() }
  }, [open, from, search, page, reload])

  async function promote() {
    setBusy(true); setError("")
    try {
      const res = await fetch("/api/admin/users/promote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, to, ids: students.map(user => user.uid) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Unable to promote students.")
      setNotice(`${data.promoted} students promoted from ${from} to ${to}.`)
      setSelected({}); setReview(false); setPage(1); setReload(value => value + 1); onComplete()
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to promote students.") }
    finally { setBusy(false) }
  }

  return <section className="rounded-2xl border border-border bg-card p-4 space-y-3">
    <div className="flex items-center justify-between gap-3">
      <div><h3 className="font-semibold">Bulk promotion</h3><p className="text-xs text-muted-foreground">Select approved students and review their new academic level.</p></div>
      <button type="button" className={button} disabled={busy} onClick={() => { setOpen(!open); setReview(false) }}>{open ? "Close" : "Select students"}</button>
    </div>
    {notice && <p role="status" className="text-sm text-primary">{notice}</p>}
    {open && <>
      {error && <p role="alert" className="text-sm text-destructive">{error} <button className="underline" disabled={busy} onClick={() => setReload(value => value + 1)}>Refresh</button></p>}
      {review ? <>
        <h4 className="font-semibold">Review: {from} → {to}</h4>
        <p className="text-sm text-muted-foreground">{students.length} selected students. Account progress, points and cosmetics stay with their accounts.</p>
        <ul className="max-h-64 overflow-auto rounded-xl border border-border divide-y divide-border">{students.map(user => <li key={user.uid} className="px-3 py-2 text-sm">{user.name} <span className="text-muted-foreground">· {user.index_number}</span></li>)}</ul>
        <div className="flex gap-2"><button className={button} disabled={busy} onClick={() => setReview(false)}>Back to selection</button><button className={`${button} bg-primary text-primary-foreground`} disabled={busy} onClick={() => void promote()}>{busy ? "Promoting…" : `Confirm promotion (${students.length})`}</button></div>
      </> : <>
        <div className="flex flex-wrap gap-3">
          <label className="text-sm">From <select className={`${button} bg-background ml-2`} value={from} onChange={event => { setFrom(event.target.value); setPage(1); setSelected({}); setNotice("") }}>{CLASS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
          <label className="text-sm">To <select className={`${button} bg-background ml-2`} value={to} onChange={event => setTo(event.target.value)}>{CLASS_LEVELS.map(level => <option key={level}>{level}</option>)}</select></label>
          <input aria-label="Search promotion candidates" className={`${button} bg-background flex-1`} placeholder="Name or index number" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} />
        </div>
        <div className="flex flex-wrap gap-2 items-center text-sm">
          <span>{students.length} selected (maximum 500)</span>
          <button className={button} disabled={loading || !!error || students.length + users.filter(user => !selected[user.uid]).length > 500} onClick={() => setSelected(current => ({ ...current, ...Object.fromEntries(users.map(user => [user.uid, user])) }))}>Select this page</button>
          <button className={button} onClick={() => setSelected({})}>Clear selection</button>
        </div>
        {loading ? <p role="status" className="text-sm">Loading students…</p> : error ? null : users.length ? <div className="max-h-80 overflow-auto divide-y divide-border rounded-xl border border-border">{users.map(user => <label key={user.uid} className="flex items-center gap-3 px-3 py-2 text-sm">
          <input type="checkbox" checked={!!selected[user.uid]} disabled={!selected[user.uid] && students.length >= 500} onChange={event => { const checked = event.target.checked; setSelected(current => { const next = { ...current }; if (checked) next[user.uid] = user; else delete next[user.uid]; return next }) }} />
          <span>{user.name} <span className="text-muted-foreground">· {user.index_number}</span></span>
        </label>)}</div> : <p className="text-sm text-muted-foreground">No eligible students found.</p>}
        <div className="flex flex-wrap justify-between items-center gap-2">
          <div className="flex items-center gap-2"><button className={button} disabled={loading || page === 1} onClick={() => setPage(value => value - 1)}>Previous</button><span className="text-xs">Page {page}</span><button className={button} disabled={loading || page * 50 >= total} onClick={() => setPage(value => value + 1)}>Next</button></div>
          <button className={`${button} bg-primary text-primary-foreground`} disabled={!students.length || from === to || loading || !!error} onClick={() => setReview(true)}>Review promotion</button>
        </div>
      </>}
    </>}
  </section>
}
