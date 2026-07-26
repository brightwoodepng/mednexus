import { NextRequest, NextResponse } from "next/server"
import type { PoolClient } from "pg"
import { requireAdminPermission, unauthorized } from "@/lib/request-auth"
import { generateWithFallback } from "@/lib/gemini"
import { guardImportRequest, IMPORT_LIMITS, validateImages } from "@/lib/import-guard"
import { normalizeTheoryImport, type TheoryImportItem, type TheoryImportImage } from "@/lib/theory-import"
import { auditTheory, theoryId, theoryPool, withTransaction } from "@/lib/theory-server"

export const maxDuration = 120

const systemInstruction = `You extract long-answer medical Theory questions from documents.
Return JSON only, in this shape:
{"questions":[{
  "collectionTitle":"End of Module or End of Year",
  "collectionKind":"end_of_module or end_of_year",
  "moduleName":"module heading or empty string",
  "disciplineName":"discipline/subject heading or empty string",
  "setName":"set/paper heading or Imported Set 1",
  "title":"short question title",
  "prompt":"complete question prompt, preserving any [IMAGE_N] markers",
  "modelAnswer":"complete model answer in Markdown, preserving any [IMAGE_N] markers",
  "keyMarkingPoints":["one point per item"],
  "marks":number or null,
  "referencesMd":"references in Markdown or empty string",
  "tags":["tags"],
  "imageIds":["IMAGE_1"],
  "difficulty":1 to 5,
  "estimatedStudyMinutes":number,
  "sourceOrder":number
}]}

Rules:
- Extract every long-answer, essay, short-answer, teaching, or past-paper question in source order.
- Headings establish running collection, module, discipline, and set context for following questions.
- Never invent a module or discipline. Use the exact document heading.
- For End of Module content, moduleName is required; disciplineName may identify a discipline related to that module.
- For End of Year content, disciplineName is required.
- Keep model answers and marking schemes as Markdown.
- Copy every [IMAGE_N] marker into the relevant prompt or answer and include its id in imageIds.
- Do not publish or grade anything.`

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 120) || `import-${Date.now()}`
}

async function findOrCreateCollection(client: PoolClient, item: TheoryImportItem) {
  const key = slug(item.collectionTitle)
  const found = await client.query("SELECT id FROM mednexus_theory_collections WHERE slug=$1", [key])
  if (found.rows[0]) return found.rows[0].id as string
  const id = theoryId("theory-collection")
  await client.query(`INSERT INTO mednexus_theory_collections
    (id,slug,title,kind,status,sort_order) VALUES ($1,$2,$3,$4,'published',
      COALESCE((SELECT MAX(sort_order)+10 FROM mednexus_theory_collections),10))`,
  [id, key, item.collectionTitle, item.collectionKind])
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

async function findOrCreateSet(
  client: PoolClient,
  collectionId: string,
  moduleId: string | null,
  disciplineId: string | null,
  name: string,
) {
  const found = await client.query(`SELECT id FROM mednexus_theory_sets
    WHERE collection_id=$1 AND module_id IS NOT DISTINCT FROM $2
      AND discipline_id IS NOT DISTINCT FROM $3 AND lower(name)=lower($4)
      AND status<>'archived' LIMIT 1`, [collectionId, moduleId, disciplineId, name])
  if (found.rows[0]) return found.rows[0].id as string
  const id = theoryId("theory-set")
  await client.query(`INSERT INTO mednexus_theory_sets
    (id,collection_id,module_id,discipline_id,name,description,status,question_limit,sort_order)
    VALUES ($1,$2,$3,$4,$5,'Imported Theory questions','published',20,
      COALESCE((SELECT MAX(sort_order)+10 FROM mednexus_theory_sets WHERE collection_id=$2),10))`,
  [id, collectionId, moduleId, disciplineId, name])
  return id
}

async function commitItems(client: PoolClient, items: TheoryImportItem[]) {
  let created = 0
  let skipped = 0
  const collections = new Set<string>()
  const modules = new Set<string>()
  const disciplines = new Set<string>()
  const sets = new Set<string>()

  for (const item of items) {
    const collectionId = await findOrCreateCollection(client, item)
    const moduleId = await findOrCreateModule(client, collectionId, item.moduleName)
    const disciplineId = await findOrCreateDiscipline(client, collectionId, item.disciplineName)
    if (moduleId && disciplineId) {
      await client.query(`INSERT INTO mednexus_theory_module_disciplines (module_id,discipline_id)
        VALUES ($1,$2) ON CONFLICT (module_id,discipline_id) DO NOTHING`, [moduleId, disciplineId])
    }
    const setId = await findOrCreateSet(client, collectionId, moduleId, disciplineId, item.setName)
    collections.add(collectionId)
    if (moduleId) modules.add(moduleId)
    if (disciplineId) disciplines.add(disciplineId)
    sets.add(setId)

    const duplicate = await client.query(`SELECT id FROM mednexus_theory_questions
      WHERE collection_id=$1 AND lower(trim(prompt))=lower(trim($2)) AND status<>'archived' LIMIT 1`,
    [collectionId, item.prompt])
    if (duplicate.rows[0]) {
      skipped++
      continue
    }
    await client.query(`INSERT INTO mednexus_theory_questions
      (id,collection_id,module_id,discipline_id,set_id,title,prompt,model_answer,key_marking_points,
       marks,references_md,media,tags,source_metadata,difficulty,estimated_study_minutes,status,sort_order)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12::jsonb,$13::jsonb,$14::jsonb,$15,$16,'draft',
        COALESCE((SELECT MAX(sort_order)+10 FROM mednexus_theory_questions WHERE set_id=$5),10))`,
    [theoryId("theory-question"), collectionId, moduleId, disciplineId, setId, item.title, item.prompt,
      item.modelAnswer, JSON.stringify(item.keyMarkingPoints), item.marks, item.referencesMd,
      JSON.stringify(item.media), JSON.stringify(item.tags),
      JSON.stringify({ imported: true, sourceOrder: item.sourceOrder }),
      item.difficulty, item.estimatedStudyMinutes])
    created++
  }
  return {
    created,
    skipped,
    collections: collections.size,
    modules: modules.size,
    disciplines: disciplines.size,
    sets: sets.size,
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
    }
    const action = body.action ?? "parse"

    if (action === "parse") {
      const guarded = await guardImportRequest(request, "theory-parse")
      if ("response" in guarded) return guarded.response
      const source = typeof body.text === "string" ? body.text.trim() : ""
      if (!source) return NextResponse.json({ error: "Document text is required." }, { status: 400 })
      if (source.length > IMPORT_LIMITS.textChars) return NextResponse.json({ error: "Document text exceeds the import limit." }, { status: 413 })
      const imageError = validateImages(body.images)
      if (imageError) return NextResponse.json({ error: imageError }, { status: 415 })
      const raw = await generateWithFallback(systemInstruction, `Theory document:\n${source}`)
      if (!raw) return NextResponse.json({ error: "The AI parser did not return a usable response." }, { status: 502 })
      const parsed = JSON.parse(raw) as unknown
      return NextResponse.json(normalizeTheoryImport(parsed, body.images ?? []))
    }

    if (action === "validate") {
      const imageError = validateImages(body.images)
      if (imageError) return NextResponse.json({ error: imageError }, { status: 415 })
      return NextResponse.json(normalizeTheoryImport(body.payload, body.images ?? []))
    }

    if (action === "commit") {
      const validation = normalizeTheoryImport(body.items)
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
