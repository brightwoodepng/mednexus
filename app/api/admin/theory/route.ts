import { NextRequest, NextResponse } from "next/server"
import { requireAdminPermission, unauthorized } from "@/lib/request-auth"
import {
  auditTheory,
  intInRange,
  optionalText,
  pagination,
  requiredText,
  stringArray,
  theoryId,
  theoryPool,
  theoryQuestionProjection,
  theoryStatus,
  withTransaction,
} from "@/lib/theory-server"
import type { PoolClient } from "pg"

const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 })

async function nextSet(
  client: PoolClient,
  collectionId: string,
  moduleId: string | null,
  disciplineId: string | null,
) {
  const settings = await client.query("SELECT default_set_size FROM mednexus_theory_settings WHERE id=1")
  const limit = settings.rows[0]?.default_set_size ?? 20
  const existing = await client.query(`SELECT s.id,s.name,s.sort_order,COUNT(q.id)::int AS count
    FROM mednexus_theory_sets s
    LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id AND q.status<>'archived'
    WHERE s.collection_id=$1 AND s.module_id IS NOT DISTINCT FROM $2 AND s.discipline_id IS NOT DISTINCT FROM $3
      AND s.status<>'archived'
    GROUP BY s.id HAVING COUNT(q.id)<$4 ORDER BY s.sort_order,s.created_at LIMIT 1`,
  [collectionId, moduleId, disciplineId, limit])
  if (existing.rows[0]) return existing.rows[0].id as string
  const count = await client.query(`SELECT COUNT(*)::int AS count FROM mednexus_theory_sets
    WHERE collection_id=$1 AND module_id IS NOT DISTINCT FROM $2 AND discipline_id IS NOT DISTINCT FROM $3`,
  [collectionId, moduleId, disciplineId])
  const number = Number(count.rows[0]?.count ?? 0) + 1
  const id = theoryId("theory-set")
  await client.query(`INSERT INTO mednexus_theory_sets
    (id,collection_id,module_id,discipline_id,name,sort_order,question_limit,status)
    VALUES ($1,$2,$3,$4,$5,$6,$7,'published')`,
  [id, collectionId, moduleId, disciplineId, `Set ${number}`, number * 10, limit])
  return id
}

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "manage_theory_content")
  if (!auth) return unauthorized()
  try {
    const pool = await theoryPool()
    const { page, pageSize, offset } = pagination(request.nextUrl)
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
    const collectionId = request.nextUrl.searchParams.get("collectionId")
    const status = request.nextUrl.searchParams.get("status")
    const [collections, modules, disciplines, sets, questions, settings, audit] = await Promise.all([
      pool.query(`SELECT id,slug,title,kind,status,sort_order AS "sortOrder"
        FROM mednexus_theory_collections ORDER BY sort_order,title`),
      pool.query(`SELECT id,collection_id AS "collectionId",name,description,sort_order AS "sortOrder"
        FROM mednexus_theory_modules ORDER BY sort_order,name`),
      pool.query(`SELECT id,collection_id AS "collectionId",name,sort_order AS "sortOrder"
        FROM mednexus_theory_disciplines ORDER BY sort_order,name`),
      pool.query(`SELECT s.id,s.collection_id AS "collectionId",s.module_id AS "moduleId",
        s.discipline_id AS "disciplineId",s.name,s.description,s.status,s.question_limit AS "questionLimit",
        s.sort_order AS "sortOrder",COUNT(q.id)::int AS "questionCount"
        FROM mednexus_theory_sets s LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id
        GROUP BY s.id ORDER BY s.sort_order,s.name`),
      pool.query(`SELECT ${theoryQuestionProjection},
        c.title AS "collectionTitle",m.name AS "moduleName",d.name AS "disciplineName",s.name AS "setTitle",
        COUNT(*) OVER()::int AS "totalCount"
        FROM mednexus_theory_questions q
        JOIN mednexus_theory_collections c ON c.id=q.collection_id
        LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
        LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
        WHERE ($1='' OR q.prompt ILIKE '%'||$1||'%' OR q.title ILIKE '%'||$1||'%')
          AND ($2::text IS NULL OR q.collection_id=$2)
          AND ($3::text IS NULL OR q.status=$3)
        ORDER BY q.updated_at DESC LIMIT $4 OFFSET $5`, [query, collectionId, status, pageSize, offset]),
      pool.query(`SELECT default_set_size AS "defaultSetSize",updated_at AS "updatedAt"
        FROM mednexus_theory_settings WHERE id=1`),
      pool.query(`SELECT id,action,resource_type AS "resourceType",resource_id AS "resourceId",
        details,created_at AS "createdAt" FROM mednexus_theory_audit_log
        ORDER BY created_at DESC LIMIT 20`),
    ])
    return NextResponse.json({
      collections: collections.rows,
      modules: modules.rows,
      disciplines: disciplines.rows,
      sets: sets.rows,
      questions: questions.rows,
      page,
      pageSize,
      total: questions.rows[0]?.totalCount ?? 0,
      settings: settings.rows[0] ?? { defaultSetSize: 20 },
      audit: audit.rows,
    })
  } catch (error) {
    console.error("[admin theory GET]", error)
    return NextResponse.json({ error: "Unable to load Theory administration." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireAdminPermission(request, "manage_theory_content")
  if (!auth) return unauthorized()
  try {
    const body = await request.json() as Record<string, unknown>
    const resource = String(body.resource ?? "")
    const pool = await theoryPool()
    const result = await withTransaction(pool, async client => {
      if (resource === "collection") {
        const id = theoryId("theory-collection")
        const title = requiredText(body.title, "Title", 120)
        const kind = body.kind === "end_of_module" ? "end_of_module" : "end_of_year"
        const slug = String(body.slug ?? title).trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
        await client.query(`INSERT INTO mednexus_theory_collections
          (id,slug,title,kind,status,sort_order) VALUES ($1,$2,$3,$4,$5,$6)`,
        [id, slug, title, kind, theoryStatus(body.status), Number(body.sortOrder) || 0])
        await auditTheory(client, auth.uid, "create", resource, id, { title, kind })
        return { id }
      }
      if (resource === "module") {
        const id = theoryId("theory-module")
        const collectionId = requiredText(body.collectionId, "Collection", 100)
        const name = requiredText(body.name, "Module name", 160)
        await client.query(`INSERT INTO mednexus_theory_modules
          (id,collection_id,name,description,sort_order) VALUES ($1,$2,$3,$4,$5)`,
        [id, collectionId, name, optionalText(body.description, 5_000), Number(body.sortOrder) || 0])
        await auditTheory(client, auth.uid, "create", resource, id, { name })
        return { id }
      }
      if (resource === "discipline") {
        const id = theoryId("theory-discipline")
        const collectionId = requiredText(body.collectionId, "Collection", 100)
        const name = requiredText(body.name, "Discipline name", 160)
        await client.query(`INSERT INTO mednexus_theory_disciplines
          (id,collection_id,name,sort_order) VALUES ($1,$2,$3,$4)`,
        [id, collectionId, name, Number(body.sortOrder) || 0])
        await auditTheory(client, auth.uid, "create", resource, id, { name })
        return { id }
      }
      if (resource === "set") {
        const id = theoryId("theory-set")
        const collectionId = requiredText(body.collectionId, "Collection", 100)
        const name = requiredText(body.name, "Set name", 180)
        const moduleId = typeof body.moduleId === "string" && body.moduleId ? body.moduleId : null
        const disciplineId = typeof body.disciplineId === "string" && body.disciplineId ? body.disciplineId : null
        await client.query(`INSERT INTO mednexus_theory_sets
          (id,collection_id,module_id,discipline_id,name,description,status,question_limit,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [id, collectionId, moduleId, disciplineId, name, optionalText(body.description, 5_000),
          theoryStatus(body.status), intInRange(body.questionLimit, 1, 100, 20), Number(body.sortOrder) || 0])
        await auditTheory(client, auth.uid, "create", resource, id, { name })
        return { id }
      }
      if (resource === "question") {
        const id = theoryId("theory-question")
        const collectionId = requiredText(body.collectionId, "Collection", 100)
        const moduleId = typeof body.moduleId === "string" && body.moduleId ? body.moduleId : null
        const disciplineId = typeof body.disciplineId === "string" && body.disciplineId ? body.disciplineId : null
        let setId = typeof body.setId === "string" && body.setId ? body.setId : null
        if (!setId && body.autoAssign !== false) setId = await nextSet(client, collectionId, moduleId, disciplineId)
        const prompt = requiredText(body.prompt, "Question prompt")
        const modelAnswer = optionalText(body.modelAnswer)
        const status = theoryStatus(body.status)
        if (status === "published" && !modelAnswer.trim()) throw new Error("A model answer is required before publishing.")
        await client.query(`INSERT INTO mednexus_theory_questions
          (id,collection_id,module_id,discipline_id,set_id,title,prompt,model_answer,key_marking_points,
           marks,references_md,media,tags,source_metadata,difficulty,estimated_study_minutes,status,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
        [id, collectionId, moduleId, disciplineId, setId, optionalText(body.title, 200), prompt, modelAnswer,
          stringArray(body.keyMarkingPoints), body.marks == null ? null : Math.max(0, Number(body.marks) || 0),
          optionalText(body.referencesMd), Array.isArray(body.media) ? body.media : [], stringArray(body.tags),
          typeof body.sourceMetadata === "object" && body.sourceMetadata ? body.sourceMetadata : {},
          intInRange(body.difficulty, 1, 5, 3), intInRange(body.estimatedStudyMinutes, 1, 180, 5),
          status, Number(body.sortOrder) || 0])
        await auditTheory(client, auth.uid, "create", resource, id, { setId, status })
        return { id, setId }
      }
      throw new Error("Unknown Theory resource.")
    })
    return NextResponse.json({ ok: true, ...result }, { status: 201 })
  } catch (error) {
    console.error("[admin theory POST]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to create Theory content." }, { status: 400 })
  }
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdminPermission(request, "manage_theory_content")
  if (!auth) return unauthorized()
  try {
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action ?? "update")
    const pool = await theoryPool()
    await withTransaction(pool, async client => {
      if (action === "settings") {
        const defaultSetSize = intInRange(body.defaultSetSize, 15, 20, 20)
        await client.query(`UPDATE mednexus_theory_settings SET default_set_size=$1,updated_at=NOW() WHERE id=1`, [defaultSetSize])
        await auditTheory(client, auth.uid, "update", "settings", "1", { defaultSetSize })
        return
      }
      if (action === "reorder") {
        const orderedIds = stringArray(body.orderedIds, 500)
        if (!orderedIds.length) throw new Error("Ordered question ids are required.")
        for (let index = 0; index < orderedIds.length; index++) {
          await client.query("UPDATE mednexus_theory_questions SET sort_order=$1,updated_at=NOW() WHERE id=$2",
            [(index + 1) * 10, orderedIds[index]])
        }
        await auditTheory(client, auth.uid, "reorder", "question", null, { orderedIds })
        return
      }
      if (action === "move") {
        const questionIds = stringArray(body.questionIds, 500)
        const setId = requiredText(body.setId, "Destination set", 100)
        const set = await client.query(`SELECT collection_id,module_id,discipline_id FROM mednexus_theory_sets WHERE id=$1`, [setId])
        if (!set.rows[0]) throw new Error("Destination set not found.")
        await client.query(`UPDATE mednexus_theory_questions SET set_id=$1,collection_id=$2,module_id=$3,
          discipline_id=$4,status=CASE WHEN status='published' THEN 'review' ELSE status END,updated_at=NOW()
          WHERE id=ANY($5::text[])`, [setId, set.rows[0].collection_id, set.rows[0].module_id, set.rows[0].discipline_id, questionIds])
        await auditTheory(client, auth.uid, "move", "question", null, { questionIds, setId })
        return
      }
      const resource = String(body.resource ?? "")
      const id = requiredText(body.id, "Resource id", 100)
      if (resource === "set") {
        await client.query(`UPDATE mednexus_theory_sets SET name=COALESCE($2,name),
          description=COALESCE($3,description),status=COALESCE($4,status),updated_at=NOW() WHERE id=$1`,
        [id, typeof body.name === "string" ? body.name.trim() : null,
          typeof body.description === "string" ? body.description : null,
          typeof body.status === "string" ? theoryStatus(body.status) : null])
      } else if (resource === "question") {
        const current = await client.query(`SELECT model_answer,collection_id,module_id,discipline_id,set_id
          FROM mednexus_theory_questions WHERE id=$1`, [id])
        if (!current.rows[0]) throw new Error("Question not found.")
        const nextStatus = typeof body.status === "string" ? theoryStatus(body.status) : null
        const modelAnswer = typeof body.modelAnswer === "string" ? body.modelAnswer : current.rows[0].model_answer
        if (nextStatus === "published" && !modelAnswer.trim()) throw new Error("A model answer is required before publishing.")
        const collectionId = typeof body.collectionId === "string" ? body.collectionId : current.rows[0].collection_id
        const moduleId = Object.hasOwn(body, "moduleId") ? (typeof body.moduleId === "string" && body.moduleId ? body.moduleId : null) : current.rows[0].module_id
        const disciplineId = Object.hasOwn(body, "disciplineId") ? (typeof body.disciplineId === "string" && body.disciplineId ? body.disciplineId : null) : current.rows[0].discipline_id
        let setId = Object.hasOwn(body, "setId") ? (typeof body.setId === "string" && body.setId ? body.setId : null) : current.rows[0].set_id
        if (!setId && body.autoAssign === true) setId = await nextSet(client, collectionId, moduleId, disciplineId)
        await client.query(`UPDATE mednexus_theory_questions SET
          title=COALESCE($2,title),prompt=COALESCE($3,prompt),model_answer=COALESCE($4,model_answer),
          key_marking_points=COALESCE($5,key_marking_points),marks=COALESCE($6,marks),
          references_md=COALESCE($7,references_md),tags=COALESCE($8,tags),
          status=COALESCE($9,status),collection_id=$10,module_id=$11,discipline_id=$12,set_id=$13,
          media=COALESCE($14,media),updated_at=NOW() WHERE id=$1`,
        [id, typeof body.title === "string" ? body.title : null, typeof body.prompt === "string" ? body.prompt.trim() : null,
          typeof body.modelAnswer === "string" ? body.modelAnswer : null,
          Array.isArray(body.keyMarkingPoints) ? stringArray(body.keyMarkingPoints) : null,
          body.marks == null ? null : Math.max(0, Number(body.marks) || 0),
          typeof body.referencesMd === "string" ? body.referencesMd : null,
          Array.isArray(body.tags) ? stringArray(body.tags) : null, nextStatus,
          collectionId, moduleId, disciplineId, setId, Array.isArray(body.media) ? body.media : null])
      } else throw new Error("Unknown Theory resource.")
      await auditTheory(client, auth.uid, "update", resource, id, {})
    })
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error("[admin theory PATCH]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Theory content." }, { status: 400 })
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireAdminPermission(request, "manage_theory_content")
  if (!auth) return unauthorized()
  try {
    const body = await request.json() as Record<string, unknown>
    const resource = String(body.resource ?? "")
    const id = requiredText(body.id, "Resource id", 100)
    if (resource !== "question") return badRequest("Only draft questions can be deleted directly.")
    const pool = await theoryPool()
    const result = await withTransaction(pool, async client => {
      const deleted = await client.query("DELETE FROM mednexus_theory_questions WHERE id=$1 AND status='draft' RETURNING id", [id])
      if (!deleted.rows.length) throw new Error("Only draft questions can be deleted.")
      await auditTheory(client, auth.uid, "delete", resource, id, {})
      return deleted.rows[0]
    })
    return NextResponse.json({ ok: true, ...result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to delete Theory content." }, { status: 400 })
  }
}
