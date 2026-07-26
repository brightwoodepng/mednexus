import { sanitizeTheoryMedia, type TheoryMediaItem } from "@/lib/theory-media"

export type TheoryImportImage = { id: string; dataUri: string }

export type TheoryImportItem = {
  collectionTitle: string
  collectionKind: "end_of_module" | "end_of_year"
  moduleName: string
  disciplineName: string
  setName: string
  title: string
  prompt: string
  modelAnswer: string
  keyMarkingPoints: string[]
  marks: number | null
  referencesMd: string
  tags: string[]
  media: TheoryMediaItem[]
  difficulty: number
  estimatedStudyMinutes: number
  sourceOrder: number
}

export type TheoryImportValidation = {
  items: TheoryImportItem[]
  errors: Array<{ row: number; message: string }>
}

type Context = {
  collectionTitle?: string
  collectionKind?: string
  moduleName?: string
  disciplineName?: string
  setName?: string
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
      const next = { ...context, setName: text(record.name ?? record.title, context.setName) }
      walkQuestions(record.questions, next)
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

export function normalizeTheoryImport(payload: unknown, images: TheoryImportImage[] = []): TheoryImportValidation {
  const records = collect(payload)
  const imageMap = new Map(images.map(image => [image.id.toUpperCase(), image.dataUri]))
  const items: TheoryImportItem[] = []
  const errors: Array<{ row: number; message: string }> = []
  const seen = new Set<string>()

  records.forEach((record, index) => {
    try {
      const collectionTitle = text(record.collectionTitle ?? record.collection ?? record.category, "End of Module")
      const explicitKind = text(record.collectionKind ?? record.kind)
      const collectionKind: TheoryImportItem["collectionKind"] = explicitKind === "end_of_year"
        || /end\s+of\s+year|past\s+paper|final/i.test(collectionTitle)
        ? "end_of_year"
        : "end_of_module"
      const moduleName = text(record.moduleName ?? record.module)
      const disciplineName = text(record.disciplineName ?? record.discipline ?? record.subject)
      if (collectionKind === "end_of_module" && !moduleName) throw new Error("Module is required for End-of-Module content.")
      if (collectionKind === "end_of_year" && !disciplineName) throw new Error("Discipline is required for End-of-Year content.")

      const rawPrompt = text(record.prompt ?? record.question)
      if (!rawPrompt) throw new Error("Question prompt is required.")
      const rawAnswer = text(record.modelAnswer ?? record.answer ?? record.model_answer)
      const key = `${collectionTitle.toLowerCase()}|${rawPrompt.toLowerCase().replace(/\s+/g, " ")}`
      if (seen.has(key)) throw new Error("Duplicate question in this import.")
      seen.add(key)

      const requestedIds = [
        ...markerIds(rawPrompt, rawAnswer),
        ...list(record.imageIds ?? record.images).map(id => id.replace(/^\[|\]$/g, "").toUpperCase()),
      ]
      const importedMedia = requestedIds
        .map(id => imageMap.get(id))
        .filter((url): url is string => Boolean(url))
        .map((url, mediaIndex) => ({ type: "image" as const, url, alt: `Imported question image ${mediaIndex + 1}` }))
      const suppliedMedia = Array.isArray(record.media) ? record.media : []

      items.push({
        collectionTitle,
        collectionKind,
        moduleName,
        disciplineName,
        setName: text(record.setName ?? record.set, "Imported Set 1"),
        title: text(record.title).slice(0, 200),
        prompt: stripImageMarkers(rawPrompt),
        modelAnswer: stripImageMarkers(rawAnswer),
        keyMarkingPoints: list(record.keyMarkingPoints ?? record.markingPoints ?? record.key_points),
        marks: record.marks == null || record.marks === "" ? null : Math.max(0, Number(record.marks) || 0),
        referencesMd: text(record.referencesMd ?? record.references),
        tags: list(record.tags),
        media: sanitizeTheoryMedia([...suppliedMedia, ...importedMedia]),
        difficulty: Math.min(5, Math.max(1, Number(record.difficulty) || 3)),
        estimatedStudyMinutes: Math.min(180, Math.max(1, Number(record.estimatedStudyMinutes ?? record.studyMinutes) || 8)),
        sourceOrder: Number(record.sourceOrder ?? record.order) || index + 1,
      })
    } catch (error) {
      errors.push({ row: index + 1, message: error instanceof Error ? error.message : "Invalid question." })
    }
  })

  if (!records.length) errors.push({ row: 0, message: "No Theory questions were found in the file." })
  return { items, errors }
}
