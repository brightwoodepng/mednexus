import { NextRequest, NextResponse } from "next/server"
import type { PoolClient } from "pg"
import { requireAdminPermission, unauthorized } from "@/lib/request-auth"
import { generateWithFallback } from "@/lib/gemini"
import { guardImportRequest, validateImages, validateImportText } from "@/lib/import-guard"
import { normalizeTheoryImport, type TheoryImportItem, type TheoryImportImage, type TheoryCollectionKind } from "@/lib/theory-import"
import { auditTheory, theoryId, theoryPool, withTransaction } from "@/lib/theory-server"

export const maxDuration = 120

function systemInstruction(collectionKind: TheoryCollectionKind) {
  const label = collectionKind === "end_of_module" ? "End of Module" : "End of Year"
  return `You extract long-answer medical Theory questions from documents for a locked ${label} import.
Return JSON only, in this shape:
{"questions":[{
  "collectionTitle":"End of Module or End of Year",
  "collectionKind":"end_of_module or end_of_year",
  "moduleName":"module heading or empty string",
  "disciplineName":"discipline/subject heading or empty string",
  "title":"concise, specific question-card title",
  "prompt":"complete question prompt, preserving any [IMAGE_N] markers",
  "modelAnswer":"complete model answer in Markdown, preserving any [IMAGE_N] markers",
  "keyMarkingPoints":["one point per item"],
  "tags":["tags"],
  "imageIds":["IMAGE_1"],
  "difficulty":1 to 5,
  "estimatedStudyMinutes":number,
  "sourceTitle":"source document or empty string",
  "pastPaper":"exam or paper label or empty string",
  "year":year or null,
  "sourceOrder":number
}]}

Rules:
- Extract every long-answer, essay, short-answer, teaching, or past-paper question in source order.
- Treat each QUESTION 1, QUESTION 2, QUESTION 3, and subsequent numbered heading as the start of a separate question. Never merge two numbered question blocks into one item.
- Headings establish running collection, module, and discipline context for following questions.
- Do not return or create sets. The server assigns imported drafts to numbered sets automatically.
- Generate a concise, specific title from each question's main subject, clinical problem, or learning focus, even when the source has no explicit title. Never use a generic label such as "Theory Question" or "Question 1", and never copy the full prompt as the title.
- Never invent a module or discipline. Use the exact document heading.
- This import is ${label}. Set collectionKind to "${collectionKind}" for every question.
${collectionKind === "end_of_module" ? "- moduleName is required; disciplineName may identify a related discipline." : "- disciplineName is required; moduleName must be empty."}
- Keep model answers and marking schemes as Markdown.
- Return at least one key marking point for every question. Marks are calculated by the system.
- Ignore source marks and references.
- Copy every [IMAGE_N] marker into the relevant prompt or answer and include its id in imageIds.
- Do not publish or grade anything.`
}

async function findOrCreateCollection(client: PoolClient, item: TheoryImportItem) {
  const key = item.collectionKind === "end_of_year" ? "end-of-year" : "end-of-module"
  const title = item.collectionKind === "end_of_year" ? "End of Year" : "End of Module"
  const found = await client.query("SELECT id FROM mednexus_theory_collections WHERE slug=$1 LIMIT 1", [key])
  if (found.rows[0]) return found.rows[0].id as string
  const id = theoryId("theory-collection")
  await client.query(`INSERT INTO mednexus_theory_collections
    (id,slug,title,kind,status,sort_order) VALUES ($1,$2,$3,$4,'published',
      COALESCE((SELECT MAX(sort_order)+10 FROM mednexus_theory_collections),10))`,
  [id, key, title, item.collectionKind])
  return id
}

async function findOrCreateModule(client: PoolClient, collectionId: string, name: string) {
  if (!name) return null
  const found = await client.query(`SELECT id FROM mednexus_theory_modules
    WHERE collection_id=$1 AND lower(name)=lower($2)`, [collectionId, name])
  if (found.rows[0]) return found.rows[0].id as string
  const id = theoryId("theory-module")
  await client.query(`INSERT INTO mednexus_theory_modules
    (id,collection_id,name,sort_order) VALUES ($1,$2,$3,
      COALESCE((SELECT MAX(sort_order)+10 FROM mednexus_theory_modules WHERE collection_id=$2),10))`,
  [id, collectionId, name])
  return id
}

async function findOrCreateDiscipline(client: PoolClient, collectionId: string, name: string) {
  if (!name) return null
  const found = await client.query(`SELECT id FROM mednexus_theory_disciplines
    WHERE collection_id=$1 AND lower(name)=lower($2)`, [collectionId, name])
  if (found.rows[0]) return found.rows[0].id as string
  const id = theoryId("theory-discipline")
  await client.query(`INSERT INTO mednexus_theory_disciplines
    (id,collection_id,name,sort_order) VALUES ($1,$2,$3,
      COALESCE((SELECT MAX(sort_order)+10 FROM mednexus_theory_disciplines WHERE collection_id=$2),10))`,
  [id, collectionId, name])
  return id
}

async function commitItems(client: PoolClient, items: TheoryImportItem[]) {
  let created = 0
  let skipped = 0
  const collections = new Set<string>()
  const modules = new Set<string>()
  const disciplines = new Set<string>()

  const setting = await client.query(`SELECT default_set_size FROM mednexus_theory_settings WHERE id=1`)
  const defaultSetSize = Math.min(100, Math.max(1, Number(setting.rows[0]?.default_set_size ?? 20)))
  const allocations = new Map<string, { id: string; count: number; limit: number; nextOrder: number }>()

  async function destinationSet(collectionId: string, moduleId: string | null, disciplineId: string | null, kind: TheoryCollectionKind) {
    const groupId = kind === "end_of_module" ? moduleId : disciplineId
    if (!groupId) throw new Error(`${kind === "end_of_module" ? "Module" : "Discipline"} is required before assigning a set.`)
    const key = `${collectionId}:${kind}:${groupId}`
    let current = allocations.get(key)
    if (!current) {
      const found = await client.query(`SELECT s.id,s.question_limit AS limit,s.sort_order,
          COUNT(q.id) FILTER (WHERE q.status<>'archived')::int AS count,
          COALESCE(MAX(q.sort_order),0)::int AS "nextOrder"
        FROM mednexus_theory_sets s
        LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id
        WHERE s.collection_id=$1 AND s.status<>'archived'
          AND ${kind === "end_of_module" ? "s.module_id=$2" : "s.discipline_id=$2"}
        GROUP BY s.id HAVING COUNT(q.id) FILTER (WHERE q.status<>'archived') < s.question_limit
        ORDER BY s.sort_order DESC,s.created_at DESC LIMIT 1`, [collectionId, groupId])
      if (found.rows[0]) current = { id: found.rows[0].id, count: Number(found.rows[0].count), limit: Number(found.rows[0].limit), nextOrder: Number(found.rows[0].nextOrder) }
    }
    if (!current || current.count >= current.limit) {
      const sequence = await client.query(`SELECT COUNT(*)::int AS count,COALESCE(MAX(sort_order),0)::int AS "sortOrder"
        FROM mednexus_theory_sets WHERE collection_id=$1 AND ${kind === "end_of_module" ? "module_id=$2" : "discipline_id=$2"}`, [collectionId, groupId])
      const setNumber = Number(sequence.rows[0]?.count ?? 0) + 1
      const id = theoryId("theory-set")
      await client.query(`INSERT INTO mednexus_theory_sets
        (id,collection_id,module_id,discipline_id,name,description,status,question_limit,sort_order)
        VALUES ($1,$2,$3,$4,$5,'','published',$6,$7)`, [id, collectionId,
        kind === "end_of_module" ? moduleId : null, kind === "end_of_year" ? disciplineId : null,
        `Set ${setNumber}`, defaultSetSize, Number(sequence.rows[0]?.sortOrder ?? 0) + 10])
      current = { id, count: 0, limit: defaultSetSize, nextOrder: 0 }
    }
    allocations.set(key, current)
    return { key, current }
  }

  for (const item of items) {
    const collectionId = await findOrCreateCollection(client, item)
    const moduleId = await findOrCreateModule(client, collectionId, item.moduleName)
    const disciplineId = await findOrCreateDiscipline(client, collectionId, item.disciplineName)
    if (moduleId && disciplineId) {
      await client.query(`INSERT INTO mednexus_theory_module_disciplines (module_id,discipline_id)
        VALUES ($1,$2) ON CONFLICT (module_id,discipline_id) DO NOTHING`, [moduleId, disciplineId])
    }
    collections.add(collectionId)
    if (moduleId) modules.add(moduleId)
    if (disciplineId) disciplines.add(disciplineId)

    const duplicate = await client.query(`SELECT id FROM mednexus_theory_questions
      WHERE collection_id=$1 AND lower(trim(prompt))=lower(trim($2)) AND status<>'archived' LIMIT 1`,
    [collectionId, item.prompt])
    if (duplicate.rows[0]) {
      skipped++
      continue
    }
    const allocation = await destinationSet(collectionId, moduleId, disciplineId, item.collectionKind)
    allocation.current.count++
    allocation.current.nextOrder += 10
    allocations.set(allocation.key, allocation.current)
    await client.query(`INSERT INTO mednexus_theory_questions
      (id,collection_id,module_id,discipline_id,set_id,title,prompt,model_answer,key_marking_points,
       marks,media,tags,source_metadata,difficulty,estimated_study_minutes,status,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11::jsonb,$12::jsonb,$13::jsonb,$14,$15,'draft',$16)`,
    [theoryId("theory-question"), collectionId, moduleId, disciplineId, allocation.current.id, item.title, item.prompt,
      item.modelAnswer, JSON.stringify(item.keyMarkingPoints), item.marks,
      JSON.stringify(item.media), JSON.stringify(item.tags),
      JSON.stringify({ ...item.sourceMetadata, imported: true, sourceOrder: item.sourceOrder }),
      item.difficulty, item.estimatedStudyMinutes, allocation.current.nextOrder])
    created++
  }
  return {
    created,
    skipped,
    collections: collections.size,
    modules: modules.size,
    disciplines: disciplines.size,
    unassigned: 0,
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "manage_theory_content")
  if (!auth) return unauthorized()
  try {
    const body = await request.json() as {
      action?: string
      text?: string
      images?: TheoryImportImage[]
      payload?: unknown
      items?: unknown
      collectionKind?: TheoryCollectionKind
    }
    const action = body.action ?? "parse"
    const collectionKind = body.collectionKind === "end_of_module" || body.collectionKind === "end_of_year" ? body.collectionKind : null
    if (!collectionKind) return NextResponse.json({ error: "Choose End of Module or End of Year before importing." }, { status: 400 })

    if (action === "parse") {
      const guarded = await guardImportRequest(request, "theory-parse")
      if ("response" in guarded) return guarded.response
      const source = typeof body.text === "string" ? body.text.trim() : ""
      if (!source) return NextResponse.json({ error: "Document text is required." }, { status: 400 })
      const textLimitError = validateImportText(source)
      if (textLimitError) return NextResponse.json({ error: textLimitError }, { status: 413 })
      const imageError = validateImages(body.images)
      if (imageError) return NextResponse.json({ error: imageError }, { status: 415 })
      const raw = await generateWithFallback(systemInstruction(collectionKind), `Theory document:\n${source}`)
      if (!raw) return NextResponse.json({ error: "The AI parser did not return a usable response." }, { status: 502 })
      const parsed = JSON.parse(raw) as unknown
      return NextResponse.json(normalizeTheoryImport(parsed, body.images ?? [], collectionKind))
    }

    if (action === "validate") {
      const imageError = validateImages(body.images)
      if (imageError) return NextResponse.json({ error: imageError }, { status: 415 })
      return NextResponse.json(normalizeTheoryImport(body.payload, body.images ?? [], collectionKind))
    }

    if (action === "commit") {
      const validation = normalizeTheoryImport(body.items, [], collectionKind)
      if (!validation.items.length) return NextResponse.json({ error: validation.errors[0]?.message ?? "No valid questions to import." }, { status: 400 })
      const pool = await theoryPool()
      const summary = await withTransaction(pool, async client => {
        const result = await commitItems(client, validation.items.slice(0, 500))
        await auditTheory(client, auth.uid, "bulk_import", "question", null, result)
        return result
      })
      return NextResponse.json({ ok: true, summary, validationErrors: validation.errors })
    }

    return NextResponse.json({ error: "Unknown Theory import action." }, { status: 400 })
  } catch (error) {
    console.error("[admin theory import]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to process Theory import." }, { status: 400 })
  }
}
