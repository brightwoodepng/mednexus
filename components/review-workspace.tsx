"use client"

import { useRef, useState, useEffect } from "react"
import { BookOpen, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react"
import { useApp } from "@/contexts/app-context"
import { useQuestions } from "@/contexts/questions-context"
import { ModuleLibrary } from "@/components/module-library"
import { QuantityModal } from "@/components/quantity-modal"
import { Modal } from "@/components/ui/modal"
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
  const [exitOpen, setExitOpen] = useState(false)
  const [navigator, setNavigator] = useState(false)
  const [explanationOpen, setExplanationOpen] = useState(true)
  const saved = user ? parseReviewSession(JSON.stringify(progress.savedReviewSession ?? null), user.uid) : null
  const button = "rounded-xl bg-primary px-4 py-3 text-sm font-semibold text-primary-foreground disabled:opacity-40"

  useEffect(() => { setActive(null); setPending(null); setError(""); setNotice(""); setExplanationOpen(true); setNavigator(false) }, [user?.uid])
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

  function start(questions: Question[]) {
    if (!pending || !user || !questions.length) return
    if (questions.length > 5000) { setError("Choose up to 5,000 questions per review."); setPending(null); return }
    const session: ReviewSession = { version: 1, userId: user.uid, module: pending.module,
      discipline: pending.discipline, questionIds: questions.map(q => q.id), currentIndex: 0,
      viewedIds: [questions[0].id], gamificationEnabled: false, updatedAt: Date.now() }
    saveReviewSession(session); setActive({ session, questions }); setPending(null)
    setExplanationOpen(true); setNavigator(window.matchMedia("(min-width: 1024px)").matches)
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
      setExplanationOpen(true); setNavigator(window.matchMedia("(min-width: 1024px)").matches)
    } catch (e) { if (owner.current === uid) setError(e instanceof Error ? e.message : "Could not resume review.") }
    finally { if (owner.current === uid) setBusy(false) }
  }

  function navigate(index: number) {
    if (!active || busy) return
    const session = visitReviewQuestion(active.session, index)
    setActive({ ...active, session }); saveReviewSession(session)
  }

  async function leave(finish = false, discard = false) {
    if (!active || busy) return
    const uid = user?.uid
    setBusy(true)
    saveReviewSession(finish || discard ? null : active.session)
    const synced = await flushProgress()
    if (owner.current !== uid) return
    setBusy(false); setActive(null); setNavigator(false); setExitOpen(false)
    if (finish) setNotice("Review complete!")
    else if (user?.role === "user" && !synced) {
      window.alert(discard ? "Discarded on this device. Account sync will retry when connected." : "Saved on this device. Account sync will retry when connected.")
      onExit()
    }
    else onExit()
  }

  if (!active) return <div className="space-y-5">
    
    {notice && <p role="status" className="rounded-xl bg-primary/10 p-4 text-sm">{notice}</p>}
    {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm">{error}</p>}
    {busy && <p role="status">Loading questions…</p>}
    <ModuleLibrary compact onReadyForQuiz={prepare} afterControls={saved ? (
      <section aria-label="Saved review" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold">Continue review</h2>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">{saved.module}{saved.discipline ? " · " + saved.discipline : ""} · {saved.currentIndex + 1}/{saved.questionIds.length}</p>
        </div>
        <button type="button" disabled={busy} onClick={resume} className="shrink-0 rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground disabled:opacity-40">{busy ? "Loading…" : "Resume review"}</button>
      </section>
    ) : null} />
    <QuantityModal open={pending !== null} label={pending?.discipline ?? pending?.module ?? ""} sublabel={pending?.discipline ? pending.module : undefined}
      questions={pending?.questions ?? []} review onClose={() => setPending(null)} onStart={start} />
  </div>

  const { session, questions } = active
  const question = questions[session.currentIndex]
  const correct = new Set(Array.isArray(question.correctAnswer) ? question.correctAnswer : question.correctAnswer ? [question.correctAnswer] : [])
  return <div className="fixed inset-0 z-[90] flex flex-col bg-background">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card p-3 sm:px-6">
      <div className="min-w-0"><p className="flex items-center gap-2 font-bold"><BookOpen size={18} />Review</p>
        <p className="max-w-[60vw] truncate text-xs text-muted-foreground">{session.module}{session.discipline ? " · " + session.discipline : ""}</p></div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => setExitOpen(true)} disabled={busy} aria-label="Exit review" className="rounded-xl bg-muted p-3 text-foreground"><X size={18} /></button></div>
    </header>
    <div className="relative flex min-h-0 flex-1">
      <button type="button" onClick={() => setNavigator(!navigator)} aria-expanded={navigator} aria-controls="review-question-navigator" aria-label={navigator ? "Hide question navigator" : "Show question navigator"} title={navigator ? "Hide question navigator" : "Show question navigator"}
        className={"absolute top-1/2 z-20 flex h-14 w-8 -translate-y-1/2 items-center justify-center rounded-l-xl border border-r-0 border-border bg-card text-primary shadow-md " + (navigator ? "right-[min(16rem,85vw)] lg:right-60" : "right-0")}>
        {navigator ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
      </button>
      <aside id="review-question-navigator" aria-label="Question navigator" className={(navigator ? "flex" : "hidden") + " absolute inset-y-0 right-0 z-10 order-last w-64 max-w-[85vw] shrink-0 flex-col overflow-y-auto border-l border-border bg-card p-4 shadow-xl lg:static lg:w-60 lg:shadow-none"}>
        <div className="mb-3 flex items-center justify-between gap-2"><h2 className="text-sm font-bold">Question navigator</h2></div>
        <div className="grid grid-cols-4 gap-2">{questions.map((q, i) => <button key={q.id} type="button" aria-label={"Question " + (i + 1)} aria-current={i === session.currentIndex ? "step" : undefined} onClick={() => { navigate(i); if (!window.matchMedia("(min-width: 1024px)").matches) setNavigator(false) }}
          className={"rounded-lg py-2 text-sm " + (i === session.currentIndex ? "bg-primary text-primary-foreground" : session.viewedIds.includes(q.id) ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground")}>{i + 1}</button>)}</div></aside>
      <main id="review-question-scroll" className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6">
        <article className="mx-auto max-w-3xl space-y-5">
          <p className="text-sm font-semibold text-muted-foreground">Question {session.currentIndex + 1} of {questions.length}</p>

          {question.contextContent && <section className="rounded-xl border border-border bg-muted/30 p-4"><RichText content={question.contextContent} /></section>}
          <section className="rounded-2xl border border-border bg-card p-4 sm:p-6"><RichText content={question.vignette} />
            <Media items={(question.media ?? []).filter(m => m.placement === "stem")} /></section>
          <div role="list" aria-label="Revealed answers" className="space-y-3">{question.options.map(option => <div role="listitem" key={option.id} className={"flex gap-3 rounded-xl border p-4 " + (correct.has(option.id) ? "border-success/50 bg-success/10" : "border-border bg-card")}>
            <span className="font-bold">{option.id}.</span><div className="min-w-0 flex-1"><RichText content={option.text} />
              <Media items={[...(option.media ?? []), ...(question.media ?? []).filter(m => m.placement === "option" && m.optionId === option.id)]} />
</div></div>)}</div>
          {!correct.size && <p className="text-sm text-muted-foreground">An answer key is not available for this question.</p>}
          <section className="space-y-4 rounded-2xl border border-border bg-card p-4 sm:p-6">
            <h2><button type="button" onClick={() => setExplanationOpen(!explanationOpen)} aria-expanded={explanationOpen} aria-controls="review-explanation" className="flex min-h-11 w-full items-center justify-between gap-3 text-left font-bold">Explanation<ChevronDown size={18} className={explanationOpen ? "rotate-180" : ""} /></button></h2>
            {explanationOpen && <div id="review-explanation" className="space-y-4">
            {question.explanation ? Object.entries({ "Learning objective": question.explanation.objective, "Explanation": question.explanation.details, "Why other options are incorrect": question.explanation.incorrectReasoning }).map(([label, text]) => text ? <div key={label}><h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-primary">{label}</h3><RichText content={text} /></div> : null) : <p className="text-sm text-muted-foreground">An explanation is not available for this question.</p>}
            <Media items={(question.media ?? []).filter(m => m.placement === "explanation")} />
            </div>}
          </section>
        </article>
      </main>
    </div>
    <footer className="flex justify-between gap-3 border-t border-border bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
      <button type="button" disabled={busy || session.currentIndex === 0} onClick={() => navigate(session.currentIndex - 1)} className={button}><ChevronLeft size={16} className="inline" /> Previous</button>
      {session.currentIndex === questions.length - 1 ? <button type="button" disabled={busy} onClick={() => leave(true)} className={button}>Finish review</button> :
        <button type="button" disabled={busy} onClick={() => navigate(session.currentIndex + 1)} className={button}>Next <ChevronRight size={16} className="inline" /></button>}
    </footer>
    <Modal open={exitOpen} onClose={() => { if (!busy) setExitOpen(false) }} title="Leave this review?" widthClass="max-w-sm">
      <div className="flex flex-col gap-3">
        <button type="button" disabled={busy} onClick={() => setExitOpen(false)} className={button}>Keep reviewing</button>
        <button type="button" disabled={busy} onClick={() => leave(false)} className={button}>{busy ? "Saving…" : "Save & continue later"}</button>
        <button type="button" disabled={busy} onClick={() => leave(false, true)} className="rounded-xl bg-destructive px-4 py-3 text-sm font-semibold text-destructive-foreground">Discard review</button>
      </div>
    </Modal>
  </div>
}
