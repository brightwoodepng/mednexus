"use client"

import Link from "next/link"
import { useCallback, useEffect, useRef, useState } from "react"
import type { TheoryQuestionDetail } from "@/lib/types"
import type { RoomState } from "@/components/group-study/group-study-room"
import { TheoryMarkdown } from "@/components/theory-markdown"
import { TheoryQuestionMedia } from "@/components/theory-question-media"
import { theorySectionKeys } from "@/lib/theory-format"
import { useQuestionKeyboardNavigation } from "@/hooks/use-question-keyboard-navigation"
import { multiplayerApi } from "@/lib/multiplayer-api"

export type TheoryRoomContent = Pick<TheoryQuestionDetail, "title" | "prompt" | "media" | "hasAnswer"> & Partial<Pick<TheoryQuestionDetail, "modelAnswer" | "keyMarkingPoints">>
const button = "min-h-11 rounded-xl border px-4 text-sm font-semibold disabled:opacity-40"
const card = "rounded-2xl border bg-card p-5 sm:p-7"

export function TheoryGroupQuestion({ state, busy, act, navigate }: {
  state: RoomState; busy: boolean; act: (action: string, extra?: Record<string, unknown>) => Promise<unknown>; navigate: (position: number | null) => void
}) {
  const q = state.question
  const theory = q?.theory
  const host = state.viewer?.role === "host"
  const live = state.room.isLiveQuestion
  const terminal = ["completed", "ended", "expired"].includes(state.room.phase)
  const [note, setNote] = useState(state.personal?.note ?? "")
  const [message, setMessage] = useState("")
  const [saving, setSaving] = useState(false)
  const dirty = useRef(false)
  const noteRef = useRef(note)
  const registered = Boolean(state.viewer && !state.viewer.isGuest)
  useEffect(() => {
    setNote(state.personal?.note ?? ""); noteRef.current = state.personal?.note ?? ""; dirty.current = false; setMessage("")
  }, [q?.id])
  const savePersonal = async (action: string, extra: Record<string, unknown>) => {
    if (!q) return
    setSaving(true); setMessage("")
    try {
      await multiplayerApi("/api/theory", { method: "POST", body: JSON.stringify({ action, questionId: q.id, ...extra }) })
      if (action === "note") {
        dirty.current = false
        try { sessionStorage.removeItem(`theory-group-note:${state.viewer?.userId}:${state.room.id}:${q.id}`) } catch { /* optional recovery */ }
      }
      setMessage(action === "note" ? "Note saved." : "Saved to your Theory Vault.")
    } catch (error) { setMessage(error instanceof Error ? error.message : "Unable to save") }
    finally { setSaving(false) }
  }
  const move = useCallback((action: "next" | "previous") => {
    if (busy || saving || terminal) return
    if (dirty.current) { setMessage("Save your note before changing questions."); return }
    if (live && (host || (action === "next" && state.room.navigationMode === "anyone_advances"))) {
      // Never finish a session through an accidental final arrow-key press.
      if (action === "previous" && state.room.currentQuestionIndex === 0) return
      void act(action, { expectedIndex: state.room.currentQuestionIndex }).catch(() => undefined)
    } else {
      const position = state.room.viewedQuestionIndex + (action === "next" ? 1 : -1)
      if (position < 0 || position >= state.room.questionCount) return
      if (position > state.room.currentQuestionIndex && state.room.navigationMode !== "browse_ahead") return
      navigate(position === state.room.currentQuestionIndex ? null : position)
    }
  }, [act, busy, saving, terminal, live, host, navigate, state.room])
  useQuestionKeyboardNavigation({ enabled: !terminal && !busy && !saving,
    onPrevious: () => move("previous"),
    onNext: () => { if (state.room.currentQuestionIndex + 1 < state.room.questionCount || !live) move("next") },
  })
  // A host update can move the room while a participant is writing. Preserve the
  // outgoing note using its captured question ID, without blocking the group.
  useEffect(() => {
    const id = q?.id
    return () => {
      if (registered && id && dirty.current) {
        const text = noteRef.current
        try { sessionStorage.setItem(`theory-group-note:${state.viewer?.userId}:${state.room.id}:${id}`, text) } catch { /* Storage may be unavailable. */ }
        void multiplayerApi("/api/theory", { method: "POST", keepalive: true, body: JSON.stringify({ action: "note", questionId: id, note: text }) }).catch(() => undefined)
      }
    }
  }, [q?.id, registered, state.room.id])
  useEffect(() => {
    if (!q?.id) return
    try {
      const draft = sessionStorage.getItem(`theory-group-note:${state.viewer?.userId}:${state.room.id}:${q.id}`)
      if (draft !== null) { setNote(draft); noteRef.current = draft; dirty.current = true; setMessage("Your local note draft was restored. Save it when ready.") }
    } catch { /* Storage may be unavailable. */ }
  }, [q?.id, state.room.id])
  if (!theory || !q) return <div role="status" className={card}>Opening theory question…</div>
  const prefix = `group-theory-answer-${q.id}`
  const canNext = live ? host || state.room.navigationMode === "anyone_advances" || state.room.navigationMode === "browse_ahead" : true
  return <div className="space-y-4">
    {terminal && <button className={button} onClick={() => navigate(null)}>Back to session summary</button>}
    {host && <label className="flex flex-wrap items-center gap-3 text-sm font-semibold">Navigation<select disabled={busy || terminal} value={state.room.navigationMode} onChange={e => void act("navigation-mode", { navigationMode: e.target.value }).catch(() => undefined)} className={button}><option value="host_paced">Host-paced</option><option value="browse_ahead">Browse ahead privately</option><option value="anyone_advances">Anyone can proceed</option></select></label>}
    <section id="group-study-question-card" className={card}>
      <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm font-semibold text-primary">Theory · Question {state.room.viewedQuestionIndex + 1} of {state.room.questionCount}</p><button className={button} disabled={busy} aria-pressed={state.viewerFlags.includes(state.room.viewedQuestionIndex)} onClick={() => void act("flag", { questionPosition: state.room.viewedQuestionIndex }).catch(() => undefined)}>{state.viewerFlags.includes(state.room.viewedQuestionIndex) ? "Flagged" : "Flag for discussion"}</button></div>
      {!live && <button className="mt-3 text-sm font-bold text-primary" onClick={() => navigate(null)}>Return to live question</button>}
      <h1 className="mt-4 text-xl font-bold">{theory.title || "Theory question"}</h1>
      <TheoryMarkdown className="mt-4" children={theory.prompt} linkedSectionKeys={theorySectionKeys(theory.modelAnswer ?? "")} onSectionSelect={key => { const element = document.getElementById(`${prefix}-${key.toLowerCase()}`); element?.focus({ preventScroll: true }); element?.scrollIntoView({ behavior: "smooth", block: "start" }) }}/>
      <div className="mt-4"><TheoryQuestionMedia media={theory.media}/></div>
    </section>
    {theory.modelAnswer !== undefined ? <section className={card}><h2 className="mb-4 text-lg font-bold text-primary">Model answer</h2>{theory.hasAnswer ? <><TheoryMarkdown children={theory.modelAnswer} answerSectionPrefix={prefix}/>{Boolean(theory.keyMarkingPoints?.length) && <><h3 className="mt-5 font-bold">Key marking points</h3><ul className="mt-2 list-disc space-y-2 pl-5">{theory.keyMarkingPoints?.map((point, index) => <li key={index}>{typeof point === "string" ? point : JSON.stringify(point)}</li>)}</ul></>}</> : <p>Model answer coming soon. You can continue discussing and move to the next question.</p>}</section> : <section className={card}><p className="text-sm text-muted-foreground">{theory.hasAnswer ? "The host can reveal the model answer when the group is ready." : "Model answer coming soon. This does not prevent discussion or navigation."}</p>{host && live && !terminal && theory.hasAnswer && <button disabled={busy} onClick={() => void act("reveal", { expectedIndex: state.room.currentQuestionIndex }).catch(() => undefined)} className={`${button} mt-4 bg-primary text-primary-foreground`}>Reveal model answer for everyone</button>}</section>}
    {!terminal && <div className="flex flex-wrap justify-between gap-3"><button className={button} disabled={busy || state.room.viewedQuestionIndex === 0} onClick={() => move("previous")}>{host && live ? "Previous for everyone" : "Previous"}</button><button className={`${button} bg-primary text-primary-foreground`} disabled={busy || !canNext || (!live && state.room.viewedQuestionIndex + 1 >= state.room.questionCount)} onClick={() => { if (live && (host || state.room.navigationMode === "anyone_advances") && state.room.currentQuestionIndex + 1 >= state.room.questionCount && !window.confirm("Finish this Theory Group Study session for everyone?")) return; move("next") }}>{live && (host || state.room.navigationMode === "anyone_advances") ? state.room.currentQuestionIndex + 1 >= state.room.questionCount ? "Finish session" : "Next for everyone" : "Next"}</button></div>}
    <nav className="flex flex-wrap gap-2" aria-label="Theory question navigator">{Array.from({ length: state.room.questionCount }, (_, position) => <button key={position} className={`${button} ${position === state.room.viewedQuestionIndex ? "bg-primary text-primary-foreground" : ""}`} disabled={!terminal && position > state.room.currentQuestionIndex && state.room.navigationMode !== "browse_ahead"} aria-label={`Question ${position + 1}${position === state.room.currentQuestionIndex ? ", group is here" : ""}`} onClick={() => { if (dirty.current) { setMessage("Save your note before changing questions."); return }; navigate(position === state.room.currentQuestionIndex ? null : position) }}>{position + 1}{state.viewerFlags.includes(position) ? " ⚑" : ""}</button>)}</nav>
    {registered && <section className={card}><h2 className="font-bold">My private notes</h2><textarea className="mt-3 min-h-32 w-full rounded-xl border bg-background p-3 text-base" aria-label="Private theory notes" disabled={saving} value={note} maxLength={20000} onChange={e => { setNote(e.target.value); noteRef.current = e.target.value; dirty.current = true; try { sessionStorage.setItem(`theory-group-note:${state.viewer?.userId}:${state.room.id}:${q.id}`, e.target.value) } catch { /* optional recovery */ } }}/><div className="mt-3 flex flex-wrap gap-2"><button className={button} disabled={saving} onClick={() => void savePersonal("note", { note })}>Save note</button><button className={button} disabled={saving} onClick={() => void savePersonal("bookmark", { enabled: !state.personal?.bookmark })}>{state.personal?.bookmark ? "Remove bookmark" : "Bookmark"}</button><button className={button} disabled={saving} onClick={() => void savePersonal("revision", { enabled: !state.personal?.revision })}>{state.personal?.revision ? "Remove from revision" : "Add to revision"}</button></div></section>}
    {message && <p role="status" className="rounded-xl border bg-card p-3 text-sm">{message}</p>}
  </div>
}

export function TheoryGroupSummary({ state, navigate }: { state: RoomState; navigate: (position: number | null) => void }) {
  const end = state.room.completedAt ? new Date(state.room.completedAt).getTime() : Date.now()
  const minutes = Math.max(0, Math.round((end - new Date(state.room.startedAt ?? state.room.createdAt).getTime()) / 60000))
  return <section className={card}><h1 className="text-2xl font-bold">Theory session complete</h1><p className="mt-3 text-muted-foreground">{state.members.length} participants · {minutes} minutes · {state.finalReview.filter(q => q.opened).length} questions opened · {state.finalReview.filter(q => q.revealed).length} model answers revealed</p><p className="mt-2 text-sm text-muted-foreground">Discussion is not graded. Only model answers revealed during the session are shown in review.</p><div className="mt-5 space-y-2">{state.finalReview.map(q => <button key={q.roomQuestionId} className={`${button} w-full text-left`} onClick={() => navigate(q.position)}>Q{q.position + 1}: {q.question.theory?.title || "Theory question"}{state.viewerFlags.includes(q.position) ? " · Flagged" : ""}</button>)}</div><div className="mt-5 flex flex-wrap gap-3"><Link href="/theory" className={button}>Return to Theory Vault</Link><Link href="/group-study" className={button}>Create another room</Link></div></section>
}
