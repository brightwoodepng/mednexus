"use client"

import { useRef, useState, useEffect } from "react"
import { BookOpen, Check, ChevronLeft, ChevronRight, Grid3X3 } from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { useQuestions } from "@/contexts/questions-context"
import { ModuleLibrary } from "@/components/module-library"
import { QuantityModal } from "@/components/quantity-modal"
import { RichText } from "@/components/rich-text"
import { parseReviewSession, visitReviewQuestion, type ReviewSession } from "@/lib/review-session"
import type { Question, QuestionMedia } from "@/lib/types"

function Media({ items }: { items: QuestionMedia[] }) {
  return <div className="space-y-3">{[...items].sort((a, b) => a.sortOrder - b.sortOrder).map(item =>
    <figure key={item.id}><img src={item.url} alt={item.alt || "Question image"} className="max-h-80 w-full rounded-xl object-contain" />
      {item.caption && <figcaption className="mt-1 text-xs text-muted-foreground">{item.caption}</figcaption>}</figure>)}</div>
}

export function ReviewWorkspace({ onExit }: { onExit: () => void }) {
  const { user, progress, saveReviewSession, flushProgress } = useApp()
  const { loadQuestionSet, loadQuestionsByIds } = useQuestions()
  const owner = useRef(user?.uid)
  owner.current = user?.uid
  const [pending, setPending] = useState<{ module: string; discipline: string | null; questions: Question[] } | null>(null)
  const [active, setActive] = useState<{ session: ReviewSession; questions: Question[] } | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [navigator, setNavigator] = useState(false)
  const saved = user ? parseReviewSession(JSON.stringify(progress.savedReviewSession ?? null), user.uid) : null
  const button = "rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"

  useEffect(() => { setActive(null); setPending(null); setError(""); setNotice("") }, [user?.uid])
  useEffect(() => {
    if (active) document.getElementById("review-question-scroll")?.scrollTo({ top: 0 })
  }, [active?.session.currentIndex])

  async function prepare(config: { module: string; discipline: string | null }) {
    const uid = user?.uid
    setBusy(true); setError(""); setNotice("")
    try {
      const questions = await loadQuestionSet(config)
      if (owner.current !== uid) return
      if (!questions.length) throw new Error("No questions are available in this selection.")
      setPending({ ...config, questions })
    } catch (e) { if (owner.current === uid) setError(e instanceof Error ? e.message : "Could not load questions.") }
    finally { if (owner.current === uid) setBusy(false) }
  }

  function start(questions: Question[], gamificationEnabled: boolean) {
    if (!pending || !user || !questions.length) return
    if (questions.length > 5000) { setError("Choose up to 5,000 questions per review."); setPending(null); return }
    const session: ReviewSession = { version: 1, userId: user.uid, module: pending.module,
      discipline: pending.discipline, questionIds: questions.map(q => q.id), currentIndex: 0,
      viewedIds: [questions[0].id], gamificationEnabled, updatedAt: Date.now() }
    saveReviewSession(session); setActive({ session, questions }); setPending(null)
  }

  async function resume() {
    if (!saved || !user) return
    const uid = user.uid
    setBusy(true); setError(""); setNotice("")
    try {
      const questions: Question[] = []
      for (let i = 0; i < saved.questionIds.length; i += 500) {
        try {
          questions.push(...await loadQuestionsByIds(saved.questionIds.slice(i, i + 500)))
        } catch (error) {
          const cached = await loadQuestionSet({ module: saved.module, discipline: saved.discipline })
          if (!cached.length) throw error
          questions.push(...cached)
          break
        }
      }
      if (owner.current !== uid) return
      const byId = new Map(questions.map(q => [q.id, q]))
      const ordered = saved.questionIds.map(id => byId.get(id))
      if (ordered.some(q => !q)) throw new Error("Some saved questions are unavailable. Your progress is still saved; retry when they are available.")
      const session = visitReviewQuestion(saved, saved.currentIndex)
      saveReviewSession(session); setActive({ session, questions: ordered as Question[] })
    } catch (e) { if (owner.current === uid) setError(e instanceof Error ? e.message : "Could not resume review.") }
    finally { if (owner.current === uid) setBusy(false) }
  }

  function navigate(index: number) {
    if (!active || busy) return
    const session = visitReviewQuestion(active.session, index)
    setActive({ ...active, session }); saveReviewSession(session)
  }

  async function leave(finish = false) {
    if (!active || busy) return
    const uid = user?.uid
    setBusy(true)
    saveReviewSession(finish ? null : active.session)
    const synced = await flushProgress()
    if (owner.current !== uid) return
    setBusy(false); setActive(null); setNavigator(false)
    if (finish) setNotice("Review complete!")
    else if (user?.role === "user" && !synced) {
      window.alert("Saved on this device. Account sync will retry when connected.")
      onExit()
    }
    else onExit()
  }

  if (!active) return <div className="space-y-5">
    <div><h1 className="text-2xl font-bold">Review</h1><p className="mt-1 text-sm text-muted-foreground">Read questions with the correct answers and explanations revealed.</p></div>
    {notice && <p role="status" className="rounded-xl bg-primary/10 p-4 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm">{error}</p>}
    {saved && <section className="rounded-2xl border border-border bg-card p-5">
      <h2 className="font-semibold">Continue review</h2><p className="mt-1 text-sm text-muted-foreground">{saved.module}{saved.discipline ? " · " + saved.discipline : ""} · Question {saved.currentIndex + 1} of {saved.questionIds.length}</p>
      <button type="button" disabled={busy} onClick={resume} className={button + " mt-4"}>{busy ? "Loading…" : "Resume review"}</button>
      <p className="mt-3 text-xs text-muted-foreground">Starting a new review replaces this saved review.</p>
    </section>}
    {busy ? <p role="status">Loading questions…</p> : <ModuleLibrary onReadyForQuiz={prepare} />}
    <QuantityModal open={pending !== null} label={pending?.discipline ?? pending?.module ?? ""} sublabel={pending?.discipline ? pending.module : undefined}
      questions={pending?.questions ?? []} mode="trial" review onClose={() => setPending(null)} onStart={start} />
  </div>

  const { session, questions } = active
  const question = questions[session.currentIndex]
  const correct = new Set(Array.isArray(question.correctAnswer) ? question.correctAnswer : question.correctAnswer ? [question.correctAnswer] : [])
  const ratio = session.viewedIds.length / questions.length
  const milestone = ratio >= 1 ? "🏆 Review complete" : ratio >= .75 ? "✨ Final stretch" : ratio >= .5 ? "🧠 Halfway there" : ratio >= .25 ? "🔥 Warming up" : "📖 Let’s explore"
  return <div className="fixed inset-0 z-[90] flex flex-col bg-background">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card p-3 sm:px-6">
      <div className="min-w-0"><p className="flex items-center gap-2 font-bold"><BookOpen size={18} />Review</p>
        <p className="max-w-[60vw] truncate text-xs text-muted-foreground">{session.module}{session.discipline ? " · " + session.discipline : ""}</p></div>
      <div className="flex flex-wrap gap-2"><button type="button" onClick={() => setNavigator(!navigator)} aria-expanded={navigator} className={button}><Grid3X3 size={16} className="inline mr-2" />Questions</button>
        <button type="button" onClick={() => leave()} disabled={busy} className={button}>{busy ? "Saving…" : "Save & exit"}</button></div>
    </header>
    <div className="flex min-h-0 flex-1">
      {navigator && <aside aria-label="Question navigator" className="w-28 shrink-0 overflow-y-auto border-r border-border bg-card p-2 sm:w-52 sm:p-4">
        <p className="mb-3 text-xs text-muted-foreground">Visited questions are highlighted.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">{questions.map((q, i) => <button key={q.id} type="button" aria-label={"Question " + (i + 1)} aria-current={i === session.currentIndex ? "step" : undefined} onClick={() => navigate(i)}
          className={"rounded-lg py-2 text-sm " + (i === session.currentIndex ? "bg-primary text-primary-foreground" : session.viewedIds.includes(q.id) ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{i + 1}</button>)}</div></aside>}
      <main id="review-question-scroll" className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <article className="mx-auto max-w-3xl space-y-5">
          <p className="text-sm font-semibold text-muted-foreground">Question {session.currentIndex + 1} of {questions.length}</p>
          {session.gamificationEnabled && <p key={milestone} role="status" className="rounded-xl bg-primary/10 px-4 py-3 font-semibold text-primary">{milestone}</p>}
          {question.contextContent && <section className="rounded-xl border border-border bg-muted/30 p-4"><RichText text={question.contextContent} /></section>}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><RichText text={question.vignette} />
            <Media items={(question.media ?? []).filter(m => m.placement === "stem")} /></section>
          <div role="list" aria-label="Revealed answers" className="space-y-3">{question.options.map(option => <div role="listitem" key={option.id} className={"flex gap-3 rounded-xl border p-4 " + (correct.has(option.id) ? "border-success/50 bg-success/10" : "border-border bg-card")}>
            <span className="font-bold">{option.id}.</span><div className="min-w-0 flex-1"><RichText text={option.text} />
              <Media items={[...(option.media ?? []), ...(question.media ?? []).filter(m => m.placement === "option" && m.optionId === option.id)]} />
              {correct.has(option.id) && <p className="mt-2 flex items-center gap-1 text-xs font-semibold text-success"><Check size={14} />Correct answer</p>}</div></div>)}</div>
          {!correct.size && <p className="text-sm text-muted-foreground">An answer key is not available for this question.</p>}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h2 className="font-bold">Explanation</h2>
            {question.explanation ? Object.entries({ "Learning objective": question.explanation.objective, "Explanation": question.explanation.details, "Why other options are incorrect": question.explanation.incorrectReasoning }).map(([label, text]) => text ? <div key={label}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{label}</h3><RichText text={text} /></div> : null) : <p className="text-sm text-muted-foreground">An explanation is not available for this question.</p>}
            <Media items={(question.media ?? []).filter(m => m.placement === "explanation")} />
          </section>
        </article>
      </main>
    </div>
    <footer className="flex justify-between gap-3 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <button type="button" disabled={busy || session.currentIndex === 0} onClick={() => navigate(session.currentIndex - 1)} className={button}><ChevronLeft size={16} className="inline" /> Previous</button>
      {session.currentIndex === questions.length - 1 ? <button type="button" disabled={busy} onClick={() => leave(true)} className={button}>Finish review</button> :
        <button type="button" disabled={busy} onClick={() => navigate(session.currentIndex + 1)} className={button}>Next <ChevronRight size={16} className="inline" /></button>}
    </footer>
  </div>
}
