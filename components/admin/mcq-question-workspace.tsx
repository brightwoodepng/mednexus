"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import type { ChangeEvent } from "react"
import Link from "next/link"
import { AlertTriangle, ArrowDown, ArrowLeft, ArrowUp, Check, Eye, FileText, ImageIcon, Layers3, Loader2, Plus, Save, Settings2, Trash2, Upload, X } from "lucide-react"
import type { Question, QuestionMedia, QuestionOption, QuestionType } from "@/lib/types"

type Tab = "question" | "answers" | "explanation" | "media" | "classification" | "preview"
type ManagedStatus = "draft" | "review" | "live" | "offline" | "archived"
const tabs: Array<{ id: Tab; label: string; icon: typeof FileText }> = [{ id: "question", label: "Question", icon: FileText }, { id: "answers", label: "Answers", icon: Layers3 }, { id: "explanation", label: "Explanation", icon: Check }, { id: "media", label: "Media", icon: ImageIcon }, { id: "classification", label: "Classification", icon: Settings2 }, { id: "preview", label: "Preview", icon: Eye }]

function answersOf(question: Question) { return Array.isArray(question.correctAnswer) ? question.correctAnswer : question.correctAnswer ? [question.correctAnswer] : [] }
function ordered(items: QuestionMedia[] = []) { return [...items].sort((a, b) => a.sortOrder - b.sortOrder) }
function localPublicationIssues(question: Question) {
  const result: string[] = []
  if (!question.module?.trim()) result.push("Module is required")
  if (!question.subject?.trim()) result.push("Discipline is required")
  if (!question.vignette?.trim()) result.push("Question stem is required")
  if (!question.options?.length || question.options.length < 2 || question.options.some((option) => !option.text.trim())) result.push("At least two complete answer options are required")
  const optionIds = new Set((question.options ?? []).map((option) => option.id))
  const answers = answersOf(question)
  if (!answers.length || answers.some((answer) => !optionIds.has(answer))) result.push("A valid correct answer is required")
  if (!question.explanation?.details?.trim()) result.push("A correct-answer explanation is required")
  return result
}

export function McqQuestionWorkspace({ id }: { id: string }) {
  const [question, setQuestion] = useState<Question | null>(null)
  const [originalUpdatedAt, setOriginalUpdatedAt] = useState<string | undefined>()
  const [issues, setIssues] = useState<string[]>([])
  const [tab, setTab] = useState<Tab>("question")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState("")
  const [error, setError] = useState("")
  const [message, setMessage] = useState("")
  const currentIssues = useMemo(() => question ? localPublicationIssues(question) : [], [question])

  const load = useCallback(async () => {
    setLoading(true); setError("")
    try {
      const response = await fetch("/api/admin/mcq/questions/" + id, { cache: "no-store" })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Unable to load the question.")
      const loaded = body.question as Question
      setQuestion({ ...loaded, status: loaded.status ?? (loaded.moduleStatus === "draft" ? "draft" : loaded.moduleStatus === "offline" ? "offline" : "live"), media: loaded.media ?? [], tags: loaded.tags ?? [] })
      setOriginalUpdatedAt(loaded.updatedAt); setIssues(body.validationIssues ?? [])
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to load the question.") }
    finally { setLoading(false) }
  }, [id])
  useEffect(() => { void load() }, [load])

  function patch(values: Partial<Question>) { setQuestion((current) => current ? { ...current, ...values } : current); setMessage("") }
  function patchOption(index: number, values: Partial<QuestionOption>) { if (!question) return; const options = question.options.map((item, position) => position === index ? { ...item, ...values } : item); patch({ options }) }
  function addOption() { if (!question || question.options.length >= 8) return; const id = String.fromCharCode(65 + question.options.length); patch({ options: [...question.options, { id, text: "" }] }) }
  function removeOption(index: number) { if (!question || question.options.length <= 2) return; const removed = question.options[index].id; const options = question.options.filter((_, position) => position !== index).map((item, position) => ({ ...item, id: String.fromCharCode(65 + position) })); const oldAnswers = answersOf(question).filter((answer) => answer !== removed); patch({ options, correctAnswer: oldAnswers.length > 1 ? oldAnswers : oldAnswers[0] ?? null }) }
  function toggleAnswer(id: string) { if (!question) return; const current = answersOf(question); const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id]; patch({ correctAnswer: next.length > 1 ? next : next[0] ?? null }) }

  async function save(nextStatus?: ManagedStatus) {
    if (!question) return
    setSaving(true); setError(""); setMessage("")
    try {
      const response = await fetch("/api/admin/mcq/questions/" + id, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...question, status: nextStatus ?? question.status, expectedUpdatedAt: originalUpdatedAt }) })
      const body = await response.json()
      if (!response.ok) { setIssues(body.validationIssues ?? issues); throw new Error(body.error || "Unable to save the question.") }
      setQuestion(body.question); setOriginalUpdatedAt(body.question.updatedAt); setIssues(body.validationIssues ?? []); setMessage(nextStatus === "live" ? "Question published." : "Changes saved.")
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to save the question.") }
    finally { setSaving(false) }
  }

  async function upload(event: ChangeEvent<HTMLInputElement>, placement: QuestionMedia["placement"], optionId?: string) {
    const file = event.target.files?.[0]
    event.target.value = ""
    if (!file || !question) return
    const key = placement + (optionId ?? "")
    setUploading(key); setError("")
    try {
      const form = new FormData(); form.set("file", file); form.set("questionId", question.id); form.set("alt", placement === "option" ? "Image for answer option " + optionId : placement === "explanation" ? "Explanation image" : "Clinical question image")
      const response = await fetch("/api/admin/mcq/media", { method: "POST", body: form })
      const body = await response.json()
      if (!response.ok) throw new Error(body.error || "Image upload failed.")
      const siblings = (question.media ?? []).filter((asset) => asset.placement === placement && asset.optionId === optionId)
      const asset: QuestionMedia = { ...body.asset, placement, optionId, sortOrder: siblings.length }
      patch({ media: [...(question.media ?? []), asset] })
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Image upload failed.") }
    finally { setUploading("") }
  }

  function removeMedia(asset: QuestionMedia) {
    if (!question || !window.confirm("Remove this image from the question? The change takes effect when you save.")) return
    patch({ media: question.media?.filter((item) => item.id !== asset.id) ?? [] })
  }

  function moveMedia(asset: QuestionMedia, direction: -1 | 1) {
    if (!question) return
    const group = ordered((question.media ?? []).filter((item) => item.placement === asset.placement && item.optionId === asset.optionId))
    const index = group.findIndex((item) => item.id === asset.id); const target = index + direction
    if (target < 0 || target >= group.length) return
    const orders = new Map(group.map((item, position) => [item.id, position]))
    orders.set(group[index].id, target); orders.set(group[target].id, index)
    patch({ media: (question.media ?? []).map((item) => orders.has(item.id) ? { ...item, sortOrder: orders.get(item.id)! } : item) })
  }

  function mediaPanel(placement: QuestionMedia["placement"], optionId?: string) {
    if (!question) return null
    const items = ordered((question.media ?? []).filter((asset) => asset.placement === placement && asset.optionId === optionId))
    const key = placement + (optionId ?? "")
    return <div className="space-y-3"><label className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-dashed border-primary/50 px-4 text-sm font-semibold text-primary hover:bg-primary/5">{uploading === key ? <Loader2 className="animate-spin" size={16}/> : <Upload size={16}/>}Add image<input type="file" accept="image/jpeg,image/png,image/webp,image/gif" className="sr-only" onChange={(event) => void upload(event, placement, optionId)}/></label>{items.length === 0 ? <p className="text-xs text-muted-foreground">No images in this section.</p> : <div className="grid gap-3 sm:grid-cols-2">{items.map((asset, index) => <article key={asset.id} className="overflow-hidden rounded-xl border border-border bg-background"><img src={asset.url} alt={asset.alt} className="h-36 w-full object-contain bg-muted"/><div className="space-y-2 p-3"><input value={asset.alt} onChange={(event) => patch({ media: question.media?.map((item) => item.id === asset.id ? { ...item, alt: event.target.value } : item) })} placeholder="Alternative text" className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"/><input value={asset.caption ?? ""} onChange={(event) => patch({ media: question.media?.map((item) => item.id === asset.id ? { ...item, caption: event.target.value } : item) })} placeholder="Optional caption" className="h-9 w-full rounded-lg border border-border bg-background px-2 text-xs"/><div className="flex gap-1"><button disabled={index === 0} onClick={() => moveMedia(asset, -1)} className="rounded-lg border border-border p-2 disabled:opacity-30" aria-label="Move image up"><ArrowUp size={14}/></button><button disabled={index === items.length - 1} onClick={() => moveMedia(asset, 1)} className="rounded-lg border border-border p-2 disabled:opacity-30" aria-label="Move image down"><ArrowDown size={14}/></button><button onClick={() => void removeMedia(asset)} className="ml-auto rounded-lg bg-destructive/10 p-2 text-destructive" aria-label="Remove image"><Trash2 size={14}/></button></div></div></article>)}</div>}</div>
  }

  if (loading) return <div className="flex min-h-[60vh] items-center justify-center"><Loader2 className="animate-spin text-primary"/></div>
  if (!question) return <div className="rounded-2xl border border-destructive/30 bg-destructive/10 p-6 text-destructive">{error || "Question not found."}</div>
  const status = question.status as ManagedStatus
  const stemMedia = ordered(question.media?.filter((asset) => asset.placement === "stem") ?? [])
  const explanationMedia = ordered(question.media?.filter((asset) => asset.placement === "explanation") ?? [])

  return <div className="space-y-5 pb-24">
    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div><Link href="/admin/mcq" className="inline-flex items-center gap-2 text-sm font-semibold text-muted-foreground hover:text-primary"><ArrowLeft size={16}/>Back to MCQ Bank</Link><h1 className="mt-3 text-2xl font-bold">{question.vignette || "New MCQ draft"}</h1><p className="mt-1 text-sm text-muted-foreground">{question.module || "Unassigned module"} · {question.subject || "Unassigned discipline"}</p></div><div className="flex flex-wrap gap-2"><select value={status} onChange={(event) => patch({ status: event.target.value as ManagedStatus })} className="h-11 rounded-xl border border-border bg-card px-3 text-sm font-semibold"><option value="draft">Draft</option><option value="review">In review</option><option value="live">Live</option><option value="offline">Offline</option><option value="archived">Archived</option></select><button disabled={saving} onClick={() => void save()} className="inline-flex h-11 items-center gap-2 rounded-xl border border-border px-4 text-sm font-semibold">{saving ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}Save</button><button disabled={saving || currentIssues.length > 0} onClick={() => void save("live")} className="inline-flex h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Check size={16}/>Publish</button></div></div>
    {error && <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}{message && <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-700 dark:text-emerald-300">{message}</div>}
    {currentIssues.length > 0 && <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4"><div className="flex items-center gap-2 font-semibold text-amber-800 dark:text-amber-200"><AlertTriangle size={17}/>{currentIssues.length} item{currentIssues.length === 1 ? "" : "s"} before publishing</div><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800/90 dark:text-amber-100/90">{currentIssues.map((item) => <li key={item}>{item}</li>)}</ul></div>}
    <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1">{tabs.map((item) => <button key={item.id} onClick={() => setTab(item.id)} className={"inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold " + (tab === item.id ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-muted")}><item.icon size={15}/>{item.label}</button>)}</nav>
    <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-7">
      {tab === "question" && <div className="space-y-5"><div><label className="text-sm font-semibold">Question format</label><select value={question.questionType ?? "STANDARD_MCQ"} onChange={(event) => patch({ questionType: event.target.value as QuestionType })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"><option value="STANDARD_MCQ">Standard MCQ / SATA</option><option value="ASSERTION_REASON">Assertion–reason</option><option value="MATCHING">Matching</option></select></div><div><label className="text-sm font-semibold">Shared clinical context or passage</label><textarea value={question.contextContent ?? ""} onChange={(event) => patch({ contextContent: event.target.value || null })} rows={5} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm" placeholder="Optional shared passage, laboratory data, or Markdown table"/></div><div><label className="text-sm font-semibold">Question stem</label><textarea value={question.vignette} onChange={(event) => patch({ vignette: event.target.value })} rows={7} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm" placeholder="Write the clinical vignette and question"/></div><div><h3 className="mb-2 text-sm font-semibold">Stem images</h3>{question.mediaBase64 && <div className="mb-3 rounded-xl border border-border p-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Legacy clinical image</p><img src={question.mediaBase64} alt="Legacy question image" className="max-h-56 rounded-lg object-contain"/></div>}{mediaPanel("stem")}</div></div>}
      {tab === "answers" && <div className="space-y-4"><div className="flex items-center justify-between"><div><h2 className="font-bold">Answer choices</h2><p className="text-sm text-muted-foreground">Select one answer for SBA or several for SATA.</p></div><button onClick={addOption} disabled={question.options.length >= 8} className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm font-semibold disabled:opacity-40"><Plus size={15}/>Add option</button></div>{question.options.map((option, index) => <article key={option.id} className="rounded-2xl border border-border p-4"><div className="flex gap-3"><button onClick={() => toggleAnswer(option.id)} className={"flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border text-sm font-bold " + (answersOf(question).includes(option.id) ? "border-primary bg-primary text-primary-foreground" : "border-border")}>{option.id}</button><textarea value={option.text} onChange={(event) => patchOption(index, { text: event.target.value })} rows={3} className="min-w-0 flex-1 rounded-xl border border-border bg-background p-3 text-sm" placeholder={"Option " + option.id}/><button onClick={() => removeOption(index)} disabled={question.options.length <= 2} className="h-10 rounded-lg p-2 text-destructive hover:bg-destructive/10 disabled:opacity-30"><Trash2 size={17}/></button></div><div className="mt-3 border-t border-border pt-3"><p className="mb-2 text-xs font-semibold text-muted-foreground">Images for option {option.id}</p>{mediaPanel("option", option.id)}</div></article>)}</div>}
      {tab === "explanation" && <div className="space-y-5"><div><label className="text-sm font-semibold">Learning objective</label><input value={question.explanation?.objective ?? ""} onChange={(event) => patch({ explanation: { objective: event.target.value, details: question.explanation?.details ?? "", incorrectReasoning: question.explanation?.incorrectReasoning ?? "" } })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" placeholder="What should the learner understand?"/></div><div><label className="text-sm font-semibold">Why the correct answer is right</label><textarea value={question.explanation?.details ?? ""} onChange={(event) => patch({ explanation: { objective: question.explanation?.objective ?? "", details: event.target.value, incorrectReasoning: question.explanation?.incorrectReasoning ?? "" } })} rows={8} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"/></div><div><label className="text-sm font-semibold">Why the distractors are wrong</label><textarea value={question.explanation?.incorrectReasoning ?? ""} onChange={(event) => patch({ explanation: { objective: question.explanation?.objective ?? "", details: question.explanation?.details ?? "", incorrectReasoning: event.target.value } })} rows={6} className="mt-2 w-full rounded-xl border border-border bg-background p-3 text-sm"/></div><div><h3 className="mb-2 text-sm font-semibold">Explanation images</h3>{mediaPanel("explanation")}</div></div>}
      {tab === "media" && <div className="space-y-7"><div><h2 className="font-bold">Stem and context images</h2><p className="mb-3 text-sm text-muted-foreground">Images appear in the saved order above the answer choices.</p>{mediaPanel("stem")}</div>{question.options.map((option) => <div key={option.id}><h2 className="font-bold">Option {option.id} images</h2><p className="mb-3 line-clamp-1 text-sm text-muted-foreground">{option.text || "Empty option"}</p>{mediaPanel("option", option.id)}</div>)}<div><h2 className="font-bold">Explanation images</h2><p className="mb-3 text-sm text-muted-foreground">Shown after the learner submits or reveals the explanation.</p>{mediaPanel("explanation")}</div></div>}
      {tab === "classification" && <div className="grid gap-5 sm:grid-cols-2"><div><label className="text-sm font-semibold">Module</label><input value={question.module ?? ""} onChange={(event) => patch({ module: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"/></div><div><label className="text-sm font-semibold">Discipline</label><input value={question.subject} onChange={(event) => patch({ subject: event.target.value })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3"/></div><div className="sm:col-span-2"><label className="text-sm font-semibold">Tags</label><input value={(question.tags ?? []).join(", ")} onChange={(event) => patch({ tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} className="mt-2 h-11 w-full rounded-xl border border-border bg-background px-3" placeholder="cardiology, emergency, ECG"/></div><div className="sm:col-span-2 rounded-xl bg-muted p-4 text-sm"><p className="font-semibold">Question ID</p><code className="mt-1 block break-all text-xs text-muted-foreground">{question.id}</code></div></div>}
      {tab === "preview" && <div className="mx-auto max-w-3xl space-y-5"><div className="rounded-2xl border border-border bg-background p-5 sm:p-7">{question.contextContent && <div className="mb-5 rounded-xl bg-muted p-4 whitespace-pre-wrap text-sm">{question.contextContent}</div>}{stemMedia.map((asset) => <figure key={asset.id} className="mb-4"><img src={asset.url} alt={asset.alt} className="max-h-96 w-full rounded-xl object-contain bg-muted"/>{asset.caption && <figcaption className="mt-1 text-center text-xs text-muted-foreground">{asset.caption}</figcaption>}</figure>)}<p className="text-base font-semibold leading-7 whitespace-pre-wrap">{question.vignette || "Question stem"}</p><div className="mt-5 space-y-3">{question.options.map((option) => <div key={option.id} className="rounded-xl border border-border p-4"><div className="flex gap-3"><span className="font-bold text-primary">{option.id}.</span><span>{option.text || "Empty option"}</span></div>{ordered(question.media?.filter((asset) => asset.placement === "option" && asset.optionId === option.id) ?? []).map((asset) => <img key={asset.id} src={asset.url} alt={asset.alt} className="mt-3 max-h-56 rounded-lg object-contain"/>)}</div>)}</div></div><div className="rounded-2xl border border-primary/20 bg-primary/5 p-5"><h2 className="font-bold">Explanation preview</h2><p className="mt-3 whitespace-pre-wrap text-sm leading-6">{question.explanation?.details || "No explanation yet."}</p>{explanationMedia.map((asset) => <img key={asset.id} src={asset.url} alt={asset.alt} className="mt-3 max-h-72 rounded-xl object-contain"/>)}</div></div>}
    </section>
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 p-3 backdrop-blur lg:left-64"><div className="mx-auto flex max-w-6xl items-center justify-between gap-3"><span className="hidden text-xs text-muted-foreground sm:block">Changes are saved only when you select Save or Publish.</span><div className="ml-auto flex gap-2"><button disabled={saving} onClick={() => void save()} className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-4 text-sm font-semibold"><Save size={16}/>Save draft</button><button disabled={saving || currentIssues.length > 0} onClick={() => void save("live")} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-40"><Check size={16}/>Publish</button></div></div></div>
  </div>
}
