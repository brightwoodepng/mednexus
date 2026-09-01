import { sanitizeTheoryMedia, type TheoryMediaItem } from "@/lib/theory-media"
import { calculateTheoryMarks, deriveTheoryTitle } from "@/lib/theory-content"

export type TheoryImportImage = { id: string; dataUri: string }

export type TheoryImportItem = {
  collectionTitle: string
  collectionKind: "end_of_module" | "end_of_year"
  moduleName: string
  disciplineName: string
  title: string
  prompt: string
  modelAnswer: string
  keyMarkingPoints: string[]
  marks: number
  tags: string[]
  media: TheoryMediaItem[]
  difficulty: number
  estimatedStudyMinutes: number
  sourceMetadata: { sourceTitle?: string; pastPaper?: string; year?: number; reference?: string }
  sourceOrder: number
}

export type TheoryImportValidation = {
  items: TheoryImportItem[]
  errors: Array<{ row: number; message: string }>
}

export type TheoryCollectionKind = TheoryImportItem["collectionKind"]

type Context = {
  collectionTitle?: string
  collectionKind?: string
  moduleName?: string
  disciplineName?: string
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value.trim() : fallback
}

function list(value: unknown) {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string").map(item => item.trim()).filter(Boolean)
  if (typeof value === "string") return value.split(/\r?\n|,/).map(item => item.replace(/^[-*]\s*/, "").trim()).filter(Boolean)
  return []
}

function collect(payload: unknown): Array<Record<string, unknown>> {
  if (Array.isArray(payload)) return payload.flatMap(collect)
  if (!payload || typeof payload !== "object") return []
  const root = payload as Record<string, unknown>
  if (Array.isArray(root.questions) && !root.collections && !root.modules && !root.disciplines && !root.sets) {
    return root.questions.flatMap(collect)
  }
  if (text(root.prompt) || text(root.question)) return [root]

  const rows: Array<Record<string, unknown>> = []
  const walkQuestions = (questions: unknown, context: Context) => {
    if (!Array.isArray(questions)) return
    for (const question of questions) {
      if (question && typeof question === "object") rows.push({ ...context, ...(question as Record<string, unknown>) })
    }
  }
  const walkSets = (sets: unknown, context: Context) => {
    if (!Array.isArray(sets)) return
    for (const set of sets) {
      if (!set || typeof set !== "object") continue
      const record = set as Record<string, unknown>
      walkQuestions(record.questions, context)
    }
  }
  const walkDisciplines = (disciplines: unknown, context: Context) => {
    if (!Array.isArray(disciplines)) return
    for (const discipline of disciplines) {
      if (!discipline || typeof discipline !== "object") continue
      const record = discipline as Record<string, unknown>
      const next = { ...context, disciplineName: text(record.name ?? record.title, context.disciplineName) }
      walkSets(record.sets, next)
      walkQuestions(record.questions, next)
    }
  }
  const walkModules = (modules: unknown, context: Context) => {
    if (!Array.isArray(modules)) return
    for (const module of modules) {
      if (!module || typeof module !== "object") continue
      const record = module as Record<string, unknown>
      const next = { ...context, moduleName: text(record.name ?? record.title, context.moduleName) }
      walkDisciplines(record.disciplines, next)
      walkSets(record.sets, next)
      walkQuestions(record.questions, next)
    }
  }
  const collections = Array.isArray(root.collections) ? root.collections : [root]
  for (const collection of collections) {
    if (!collection || typeof collection !== "object") continue
    const record = collection as Record<string, unknown>
    const context: Context = {
      collectionTitle: text(record.collectionTitle ?? record.name ?? record.title),
      collectionKind: text(record.collectionKind ?? record.kind),
    }
    walkModules(record.modules, context)
    walkDisciplines(record.disciplines, context)
    walkSets(record.sets, context)
    walkQuestions(record.questions, context)
  }
  return rows
}

function stripImageMarkers(value: string) {
  return value.replace(/\[IMAGE_\d+\]\s*/gi, "").trim()
}

function markerIds(...values: string[]) {
  const ids: string[] = []
  for (const value of values) {
    for (const match of value.matchAll(/\[(IMAGE_\d+)\]/gi)) {
      const id = match[1].toUpperCase()
      if (!ids.includes(id)) ids.push(id)
    }
  }
  return ids
}

function structuredPrompt(record: Record<string, unknown>, fallback: string) {
  const preamble = text(record.preamble)
  const raw = Array.isArray(record.subQuestions) ? record.subQuestions : []
  const questions = raw.flatMap((entry, index) => {
    if (typeof entry === "string") return [{ label: String(index + 1), text: entry.trim() }]
    if (!entry || typeof entry !== "object") return []
    const item = entry as Record<string, unknown>
    const content = text(item.text ?? item.question ?? item.prompt)
    return content ? [{ label: text(item.label, String(index + 1)).replace(/[.):]+$/, ""), text: content }] : []
  })
  if (!preamble && !questions.length) return fallback
  const blocks = preamble ? [`> **Preamble**\n> ${preamble.replace(/\n/g, "\n> ")}`] : []
  if (questions.length) blocks.push(questions.map(item => `${item.label}. ${item.text}`).join("\n"))
  return blocks.join("\n\n")
}

function structuredAnswer(record: Record<string, unknown>, fallback: string) {
  const raw = Array.isArray(record.modelAnswerSections) ? record.modelAnswerSections : []
  const sections = raw.flatMap((entry, index) => {
    if (typeof entry === "string") return [{ label: String(index + 1), heading: "", body: entry.trim() }]
    if (!entry || typeof entry !== "object") return []
    const item = entry as Record<string, unknown>
    const body = text(item.body ?? item.answer ?? item.text)
    return body ? [{ label: text(item.label, String(index + 1)).replace(/[.):]+$/, ""), heading: text(item.heading ?? item.title), body }] : []
  })
  if (!sections.length) return fallback
  return sections.map(item => `### ${item.label}${item.heading ? `. ${item.heading}` : ""}\n\n${item.body}`).join("\n\n")
}

export function normalizeTheoryImport(payload: unknown, images: TheoryImportImage[] = [], expectedKind?: TheoryCollectionKind): TheoryImportValidation {
  const records = collect(payload)
  const imageMap = new Map(images.map(image => [image.id.toUpperCase(), image.dataUri]))
  const items: TheoryImportItem[] = []
  const errors: Array<{ row: number; message: string }> = []
  const seen = new Set<string>()

  records.forEach((record, index) => {
    try {
      const suppliedTitle = text(record.collectionTitle ?? record.collection ?? record.category)
      const explicitKind = text(record.collectionKind ?? record.kind)
      const inferredKind: TheoryImportItem["collectionKind"] = explicitKind === "end_of_year"
        || /end\s+of\s+year|past\s+paper|final/i.test(suppliedTitle)
        ? "end_of_year"
        : "end_of_module"
      if (expectedKind && explicitKind && explicitKind !== expectedKind) {
        throw new Error(`This row is marked ${explicitKind === "end_of_year" ? "End of Year" : "End of Module"}, but the importer is locked to ${expectedKind === "end_of_year" ? "End of Year" : "End of Module"}.`)
      }
      const collectionKind = expectedKind ?? inferredKind
      const collectionTitle = collectionKind === "end_of_year" ? "End of Year" : "End of Module"
      const moduleName = text(record.moduleName ?? record.module)
      const disciplineName = text(record.disciplineName ?? record.discipline ?? record.subject)
      if (collectionKind === "end_of_module" && !moduleName) throw new Error("Module is required for End-of-Module content.")
      if (collectionKind === "end_of_year" && !disciplineName) throw new Error("Discipline is required for End-of-Year content.")

      const rawPrompt = structuredPrompt(record, text(record.prompt ?? record.question))
      if (!rawPrompt) throw new Error("Question prompt is required.")
      const prompt = stripImageMarkers(rawPrompt)
      const rawAnswer = structuredAnswer(record, text(record.modelAnswer ?? record.answer ?? record.model_answer))
      const keyMarkingPoints = list(record.keyMarkingPoints ?? record.markingPoints ?? record.key_points)
      const key = `${collectionTitle.toLowerCase()}|${rawPrompt.toLowerCase().replace(/\s+/g, " ")}`
      if (seen.has(key)) throw new Error("Duplicate question in this import.")
      seen.add(key)

      const requestedIds = [...new Set([
        ...markerIds(rawPrompt, rawAnswer),
        ...list(record.imageIds ?? record.images).map(id => id.replace(/^\[|\]$/g, "").toUpperCase()),
      ])]
      const importedMedia = requestedIds
        .map(id => imageMap.get(id))
        .filter((url): url is string => Boolean(url))
        .map((url, mediaIndex) => ({ type: "image" as const, url, alt: `Imported question image ${mediaIndex + 1}` }))
      const suppliedMedia = Array.isArray(record.media) ? record.media : []
      const suppliedSource = record.sourceMetadata && typeof record.sourceMetadata === "object"
        ? record.sourceMetadata as Record<string, unknown>
        : {}

      items.push({
        collectionTitle,
        collectionKind,
        moduleName,
        disciplineName,
        title: deriveTheoryTitle(prompt, text(record.questionTitle ?? record.title)),
        prompt,
        modelAnswer: stripImageMarkers(rawAnswer),
        keyMarkingPoints,
        marks: calculateTheoryMarks(keyMarkingPoints),
        tags: list(record.tags),
        media: sanitizeTheoryMedia([...suppliedMedia, ...importedMedia]),
        difficulty: Math.min(5, Math.max(1, Number(record.difficulty) || 3)),
        estimatedStudyMinutes: Math.min(180, Math.max(1, Number(record.estimatedStudyMinutes ?? record.studyMinutes) || 8)),
        sourceMetadata: {
          sourceTitle: text(record.sourceTitle ?? record.source ?? suppliedSource.sourceTitle),
          pastPaper: text(record.pastPaper ?? record.exam ?? suppliedSource.pastPaper),
          year: Number(record.year ?? suppliedSource.year) || undefined,
          reference: text(record.reference ?? suppliedSource.reference),
        },
        sourceOrder: Number(record.sourceOrder ?? record.order) || index + 1,
      })
    } catch (error) {
      errors.push({ row: index + 1, message: error instanceof Error ? error.message : "Invalid question." })
    }
  })

  if (!records.length) errors.push({ row: 0, message: "No Theory questions were found in the file." })
  return { items, errors }
}
