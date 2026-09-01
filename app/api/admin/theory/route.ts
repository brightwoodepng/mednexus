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
import { seedTheoryDemo } from "@/lib/theory-demo-seed"
import { sanitizeTheoryMedia } from "@/lib/theory-media"
import { calculateTheoryMarks, deriveTheoryTitle } from "@/lib/theory-content"
import { databaseErrorResponse } from "@/lib/api-error-response"
import { withReadRetry } from "@/lib/runtime-db"

const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 })

export async function GET(request: NextRequest) {
  const auth = await requireAdminPermission(request, "manage_theory_content")
  if (!auth) return unauthorized()
  try {
    const { page, pageSize, offset } = pagination(request.nextUrl)
    const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
    const kind = request.nextUrl.searchParams.get("kind") === "end_of_year" ? "end_of_year" : "end_of_module"
    const collectionId = request.nextUrl.searchParams.get("collectionId")
    const moduleId = request.nextUrl.searchParams.get("moduleId")
    const disciplineId = request.nextUrl.searchParams.get("disciplineId")
    const setId = request.nextUrl.searchParams.get("setId")
    const status = request.nextUrl.searchParams.get("status")
    const unassigned = request.nextUrl.searchParams.get("unassigned") === "true"
    const trashOnly = request.nextUrl.searchParams.get("trash") === "true"
    const sort = request.nextUrl.searchParams.get("sort") === "oldest" ? "oldest" : request.nextUrl.searchParams.get("sort") === "title" ? "title" : "updated"
    const orderBy = sort === "title" ? "q.title ASC" : sort === "oldest" ? "q.updated_at ASC" : "q.updated_at DESC"
    const [collections, modules, disciplines, sets, questions, settings, audit, counts, hierarchyStats, trash, imports] = await withReadRetry(pool => Promise.all([
      pool.query(`SELECT id,slug,title,kind,status,sort_order AS "sortOrder"
        FROM mednexus_theory_collections WHERE kind=$1 ORDER BY sort_order,title`, [kind]),
      pool.query(`SELECT id,collection_id AS "collectionId",name,description,sort_order AS "sortOrder"
        FROM mednexus_theory_modules WHERE collection_id IN (SELECT id FROM mednexus_theory_collections WHERE kind=$1)
          AND deleted_at IS NULL
        ORDER BY sort_order,name`, [kind]),
      pool.query(`SELECT id,collection_id AS "collectionId",name,sort_order AS "sortOrder"
        FROM mednexus_theory_disciplines WHERE collection_id IN (SELECT id FROM mednexus_theory_collections WHERE kind=$1)
          AND deleted_at IS NULL
        ORDER BY sort_order,name`, [kind]),
      pool.query(`SELECT s.id,s.collection_id AS "collectionId",s.module_id AS "moduleId",
        s.discipline_id AS "disciplineId",s.name,s.description,s.status,s.question_limit AS "questionLimit",
        s.sort_order AS "sortOrder",COUNT(q.id)::int AS "questionCount"
        FROM mednexus_theory_sets s LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id AND q.deleted_at IS NULL
        WHERE s.collection_id IN (SELECT id FROM mednexus_theory_collections WHERE kind=$1)
          AND s.deleted_at IS NULL
        GROUP BY s.id ORDER BY s.sort_order,s.name`, [kind]),
      pool.query(`SELECT ${theoryQuestionProjection},
        c.title AS "collectionTitle",m.name AS "moduleName",d.name AS "disciplineName",s.name AS "setTitle",
        COUNT(*) OVER()::int AS "totalCount"
        FROM mednexus_theory_questions q
        JOIN mednexus_theory_collections c ON c.id=q.collection_id
        LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
        LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
        WHERE c.kind=$1
          AND (($11::boolean=TRUE AND q.deleted_at IS NOT NULL) OR ($11::boolean=FALSE AND q.deleted_at IS NULL))
          AND ($2='' OR q.prompt ILIKE '%'||$2||'%' OR q.title ILIKE '%'||$2||'%')
          AND ($3::text IS NULL OR q.collection_id=$3)
          AND ($4::text IS NULL OR q.status=$4)
          AND ($5::boolean=FALSE OR q.set_id IS NULL)
          AND ($6::text IS NULL OR q.module_id=$6)
          AND ($7::text IS NULL OR q.discipline_id=$7)
          AND ($8::text IS NULL OR q.set_id=$8)
        ORDER BY ${orderBy} LIMIT $9 OFFSET $10`, [kind, query, collectionId, status, unassigned, moduleId, disciplineId, setId, pageSize, offset, trashOnly]),
      pool.query(`SELECT default_set_size AS "defaultSetSize",updated_at AS "updatedAt"
        FROM mednexus_theory_settings WHERE id=1`),
      pool.query(`SELECT id,action,resource_type AS "resourceType",resource_id AS "resourceId",
        details,created_at AS "createdAt" FROM mednexus_theory_audit_log
        ORDER BY created_at DESC LIMIT 20`),
      pool.query(`SELECT q.status,COUNT(*)::int AS count FROM mednexus_theory_questions q
        JOIN mednexus_theory_collections c ON c.id=q.collection_id WHERE c.kind=$1 AND q.deleted_at IS NULL GROUP BY q.status`, [kind]),
      pool.query(`SELECT q.collection_id AS "collectionId",q.module_id AS "moduleId",q.discipline_id AS "disciplineId",q.set_id AS "setId",
        COUNT(*)::int AS total,
        COUNT(*) FILTER (WHERE q.status='draft')::int AS draft,
        COUNT(*) FILTER (WHERE q.status='published')::int AS live,
        COUNT(*) FILTER (WHERE q.set_id IS NULL OR TRIM(q.prompt)='' OR TRIM(q.model_answer)='' OR CASE WHEN jsonb_typeof(q.key_marking_points)='array' THEN jsonb_array_length(q.key_marking_points) ELSE 0 END=0)::int AS "needsAttention"
        FROM mednexus_theory_questions q JOIN mednexus_theory_collections c ON c.id=q.collection_id
        WHERE c.kind=$1 AND q.deleted_at IS NULL GROUP BY GROUPING SETS
        ((q.collection_id,q.module_id,q.discipline_id,q.set_id),(q.collection_id,q.module_id,q.discipline_id),(q.collection_id))`, [kind]),
      pool.query(`SELECT 'module' AS type,m.id,m.name AS label,m.deleted_at AS "deletedAt",COUNT(q.id)::int AS count
        FROM mednexus_theory_modules m JOIN mednexus_theory_collections c ON c.id=m.collection_id
        LEFT JOIN mednexus_theory_questions q ON q.module_id=m.id AND q.deleted_at IS NOT NULL
        WHERE c.kind=$1 AND m.deleted_at IS NOT NULL GROUP BY m.id
        UNION ALL SELECT 'discipline',d.id,d.name,d.deleted_at,COUNT(q.id)::int
        FROM mednexus_theory_disciplines d JOIN mednexus_theory_collections c ON c.id=d.collection_id
        LEFT JOIN mednexus_theory_questions q ON q.discipline_id=d.id AND q.deleted_at IS NOT NULL
        WHERE c.kind=$1 AND d.deleted_at IS NOT NULL GROUP BY d.id
        UNION ALL SELECT 'set',s.id,s.name,s.deleted_at,COUNT(q.id)::int
        FROM mednexus_theory_sets s JOIN mednexus_theory_collections c ON c.id=s.collection_id
        LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id AND q.deleted_at IS NOT NULL
        WHERE c.kind=$1 AND s.deleted_at IS NOT NULL GROUP BY s.id
        ORDER BY "deletedAt" DESC`, [kind]),
      pool.query(`SELECT id,source_name AS "sourceName",status,total_count AS "totalCount",valid_count AS "validCount",
        error_count AS "errorCount",created_at AS "createdAt",committed_at AS "committedAt",deleted_at AS "deletedAt"
        FROM mednexus_content_import_jobs WHERE bank='theory' ORDER BY created_at DESC LIMIT 50`),
    ]))
    return NextResponse.json({
      collections: collections.rows,
      modules: modules.rows,
      disciplines: disciplines.rows,
      sets: sets.rows,
      questions: questions.rows,
      page,
      pageSize,
      total: questions.rows[0]?.totalCount ?? 0,
      counts: Object.fromEntries(counts.rows.map(row => [row.status, Number(row.count)])),
      updatedAt: new Date().toISOString(),
      settings: settings.rows[0] ?? { defaultSetSize: 20 },
      audit: audit.rows,
      hierarchyStats: hierarchyStats.rows,
      trash: trash.rows,
      imports: imports.rows,
    })
  } catch (error) {
    console.error("[admin theory GET]", error)
    return databaseErrorResponse(error, "Unable to load Theory administration.")
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
      if (resource === "demo_seed") {
        const summary = await seedTheoryDemo(client)
        await auditTheory(client, auth.uid, "seed_demo", "question", null, summary)
        return { summary }
      }
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
        const setId = typeof body.setId === "string" && body.setId ? body.setId : null
        const prompt = requiredText(body.prompt, "Question prompt")
        const modelAnswer = optionalText(body.modelAnswer)
        const keyMarkingPoints = stringArray(body.keyMarkingPoints)
        const title = deriveTheoryTitle(prompt, optionalText(body.title, 200))
        const marks = calculateTheoryMarks(keyMarkingPoints)
        const status = theoryStatus(body.status)
        if (status === "published" && !setId) {
          throw new Error("Choose a set before publishing this question.")
        }
        await client.query(`INSERT INTO mednexus_theory_questions
          (id,collection_id,module_id,discipline_id,set_id,title,prompt,model_answer,key_marking_points,
           marks,media,tags,source_metadata,difficulty,estimated_study_minutes,status,sort_order)
          VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
        [id, collectionId, moduleId, disciplineId, setId, title, prompt, modelAnswer,
          keyMarkingPoints, marks, sanitizeTheoryMedia(body.media), stringArray(body.tags),
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
    const summary = await withTransaction(pool, async client => {
      if (action === "trash" || action === "restore" || action === "purge" || action === "empty_trash") {
        const resource = String(body.resource ?? "question")
        const ids = stringArray(body.ids, 500)
        const id = typeof body.id === "string" ? body.id : ""
        if (id && !ids.includes(id)) ids.push(id)
        if (action !== "empty_trash" && !ids.length) throw new Error("Select something to update.")
        if (!["question", "set", "module", "discipline"].includes(resource)) throw new Error("Unsupported trash resource.")
        const operationIds = ids
        if (action === "trash") {
          if (resource === "question") await client.query(`UPDATE mednexus_theory_questions SET previous_status=status,deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
          if (resource === "set") {
            await client.query(`UPDATE mednexus_theory_sets SET previous_status=status,deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
            await client.query(`UPDATE mednexus_theory_questions SET previous_status=status,deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE set_id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
          }
          if (resource === "module") {
            await client.query(`UPDATE mednexus_theory_modules SET deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
            await client.query(`UPDATE mednexus_theory_sets SET previous_status=status,deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE module_id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
            await client.query(`UPDATE mednexus_theory_questions SET previous_status=status,deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE module_id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
          }
          if (resource === "discipline") {
            await client.query(`UPDATE mednexus_theory_disciplines SET deleted_at=NOW(),deleted_by=$1 WHERE id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
            await client.query(`UPDATE mednexus_theory_sets SET previous_status=status,deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE discipline_id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
            await client.query(`UPDATE mednexus_theory_questions SET previous_status=status,deleted_at=NOW(),deleted_by=$1,updated_at=NOW() WHERE discipline_id=ANY($2::text[]) AND deleted_at IS NULL`, [auth.uid,operationIds])
          }
        } else if (action === "restore") {
          if (resource === "question") await client.query(`UPDATE mednexus_theory_questions SET status=COALESCE(previous_status,'draft'),previous_status=NULL,deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE id=ANY($1::text[])`, [operationIds])
          if (resource === "set") {
            await client.query(`UPDATE mednexus_theory_sets SET status=COALESCE(previous_status,'published'),previous_status=NULL,deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE id=ANY($1::text[])`, [operationIds])
            await client.query(`UPDATE mednexus_theory_questions SET status=COALESCE(previous_status,'draft'),previous_status=NULL,deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE set_id=ANY($1::text[])`, [operationIds])
          }
          if (resource === "module") {
            await client.query(`UPDATE mednexus_theory_modules SET deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE id=ANY($1::text[])`, [operationIds])
            await client.query(`UPDATE mednexus_theory_sets SET status=COALESCE(previous_status,'published'),previous_status=NULL,deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE module_id=ANY($1::text[])`, [operationIds])
            await client.query(`UPDATE mednexus_theory_questions SET status=COALESCE(previous_status,'draft'),previous_status=NULL,deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE module_id=ANY($1::text[])`, [operationIds])
          }
          if (resource === "discipline") {
            await client.query(`UPDATE mednexus_theory_disciplines SET deleted_at=NULL,deleted_by=NULL WHERE id=ANY($1::text[])`, [operationIds])
            await client.query(`UPDATE mednexus_theory_sets SET status=COALESCE(previous_status,'published'),previous_status=NULL,deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE discipline_id=ANY($1::text[])`, [operationIds])
            await client.query(`UPDATE mednexus_theory_questions SET status=COALESCE(previous_status,'draft'),previous_status=NULL,deleted_at=NULL,deleted_by=NULL,updated_at=NOW() WHERE discipline_id=ANY($1::text[])`, [operationIds])
          }
        } else if (action === "empty_trash") {
          const kind = body.kind === "end_of_year" ? "end_of_year" : "end_of_module"
          const questionResult = await client.query(`DELETE FROM mednexus_theory_questions q USING mednexus_theory_collections c
            WHERE q.collection_id=c.id AND c.kind=$1 AND (
              q.deleted_at IS NOT NULL
              OR EXISTS (SELECT 1 FROM mednexus_theory_sets s WHERE s.id=q.set_id AND s.deleted_at IS NOT NULL)
              OR EXISTS (SELECT 1 FROM mednexus_theory_modules m WHERE m.id=q.module_id AND m.deleted_at IS NOT NULL)
              OR EXISTS (SELECT 1 FROM mednexus_theory_disciplines d WHERE d.id=q.discipline_id AND d.deleted_at IS NOT NULL)
            )`, [kind])
          const setResult = await client.query(`DELETE FROM mednexus_theory_sets s USING mednexus_theory_collections c
            WHERE s.collection_id=c.id AND c.kind=$1 AND (
              s.deleted_at IS NOT NULL
              OR EXISTS (SELECT 1 FROM mednexus_theory_modules m WHERE m.id=s.module_id AND m.deleted_at IS NOT NULL)
              OR EXISTS (SELECT 1 FROM mednexus_theory_disciplines d WHERE d.id=s.discipline_id AND d.deleted_at IS NOT NULL)
            )`, [kind])
          const moduleResult = await client.query(`DELETE FROM mednexus_theory_modules m USING mednexus_theory_collections c WHERE m.collection_id=c.id AND c.kind=$1 AND m.deleted_at IS NOT NULL`, [kind])
          const disciplineResult = await client.query(`DELETE FROM mednexus_theory_disciplines d USING mednexus_theory_collections c WHERE d.collection_id=c.id AND c.kind=$1 AND d.deleted_at IS NOT NULL`, [kind])
          const importResult = await client.query("DELETE FROM mednexus_content_import_jobs WHERE bank='theory' AND deleted_at IS NOT NULL")
          const removed = (questionResult.rowCount ?? 0) + (setResult.rowCount ?? 0) + (moduleResult.rowCount ?? 0) + (disciplineResult.rowCount ?? 0) + (importResult.rowCount ?? 0)
          await auditTheory(client, auth.uid, action, "trash", null, { kind, removed })
          return { matched: removed, updated: removed, skipped: 0, validationDetails: [] }
        } else {
          if (resource === "question") await client.query("DELETE FROM mednexus_theory_questions WHERE deleted_at IS NOT NULL AND id=ANY($1::text[])", [operationIds])
          if (resource === "set") await client.query("DELETE FROM mednexus_theory_sets WHERE deleted_at IS NOT NULL AND id=ANY($1::text[])", [operationIds])
          if (resource === "module") await client.query("DELETE FROM mednexus_theory_modules WHERE deleted_at IS NOT NULL AND id=ANY($1::text[])", [operationIds])
          if (resource === "discipline") await client.query("DELETE FROM mednexus_theory_disciplines WHERE deleted_at IS NOT NULL AND id=ANY($1::text[])", [operationIds])
        }
        await auditTheory(client, auth.uid, action, resource, operationIds[0] ?? null, { ids: operationIds })
        return { matched: operationIds.length, updated: operationIds.length, skipped: 0, validationDetails: [] }
      }
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
        if (!questionIds.length) throw new Error("Select at least one question.")
        let setId = typeof body.setId === "string" ? body.setId.trim() : ""
        if (!setId) {
          const moduleId = typeof body.moduleId === "string" && body.moduleId ? body.moduleId : null
          const disciplineId = typeof body.disciplineId === "string" && body.disciplineId ? body.disciplineId : null
          if (!moduleId && !disciplineId) throw new Error("Choose a destination module, discipline, or set.")
          const group = await client.query(`SELECT c.id AS collection_id,COALESCE(m.id,d.id) AS group_id
            FROM mednexus_theory_collections c
            LEFT JOIN mednexus_theory_modules m ON m.collection_id=c.id AND m.id=$1 AND m.deleted_at IS NULL
            LEFT JOIN mednexus_theory_disciplines d ON d.collection_id=c.id AND d.id=$2 AND d.deleted_at IS NULL
            WHERE m.id IS NOT NULL OR d.id IS NOT NULL LIMIT 1`, [moduleId, disciplineId])
          if (!group.rows[0]) throw new Error("Destination group not found.")
          const available = await client.query(`SELECT s.id FROM mednexus_theory_sets s
            WHERE s.collection_id=$1 AND s.module_id IS NOT DISTINCT FROM $2 AND s.discipline_id IS NOT DISTINCT FROM $3
              AND s.deleted_at IS NULL AND s.status<>'archived'
              AND (SELECT COUNT(*) FROM mednexus_theory_questions q WHERE q.set_id=s.id AND q.deleted_at IS NULL) < s.question_limit
            ORDER BY s.sort_order,s.created_at LIMIT 1`, [group.rows[0].collection_id, moduleId, disciplineId])
          setId = available.rows[0]?.id ?? theoryId("theory-set")
          if (!available.rows[0]) {
            const settings = await client.query("SELECT default_set_size FROM mednexus_theory_settings WHERE id=1")
            const number = await client.query(`SELECT COUNT(*)::int+1 AS next FROM mednexus_theory_sets
              WHERE collection_id=$1 AND module_id IS NOT DISTINCT FROM $2 AND discipline_id IS NOT DISTINCT FROM $3`, [group.rows[0].collection_id,moduleId,disciplineId])
            await client.query(`INSERT INTO mednexus_theory_sets
              (id,collection_id,module_id,discipline_id,name,status,question_limit,sort_order)
              VALUES($1,$2,$3,$4,$5,'published',$6,$7)`, [setId,group.rows[0].collection_id,moduleId,disciplineId,`Set ${number.rows[0].next}`,Number(settings.rows[0]?.default_set_size??20),Number(number.rows[0].next)*10])
          }
        }
        const set = await client.query(`SELECT collection_id,module_id,discipline_id,question_limit
          FROM mednexus_theory_sets WHERE id=$1 AND status<>'archived' AND deleted_at IS NULL`, [setId])
        if (!set.rows[0]) throw new Error("Destination set not found.")
        const capacity = await client.query(`SELECT
          COUNT(*) FILTER (WHERE set_id=$1 AND status<>'archived' AND NOT (id=ANY($2::text[])))::int AS existing,
          COUNT(*) FILTER (WHERE id=ANY($2::text[]) AND status<>'archived')::int AS moving
          FROM mednexus_theory_questions`, [setId, questionIds])
        const existing = Number(capacity.rows[0]?.existing ?? 0)
        const moving = Number(capacity.rows[0]?.moving ?? 0)
        if (existing + moving > Number(set.rows[0].question_limit)) {
          throw new Error(`This set has ${Math.max(0, Number(set.rows[0].question_limit) - existing)} available places.`)
        }
        await client.query(`UPDATE mednexus_theory_questions SET set_id=$1,collection_id=$2,module_id=$3,
          discipline_id=COALESCE($4,discipline_id),
          status=CASE WHEN status='published' THEN 'review' ELSE status END,updated_at=NOW()
          WHERE id=ANY($5::text[])`, [setId, set.rows[0].collection_id, set.rows[0].module_id, set.rows[0].discipline_id, questionIds])
        await auditTheory(client, auth.uid, "move", "question", null, { questionIds, setId })
        return
      }
      if (action === "bulk") {
        const scope = body.scope && typeof body.scope === "object" ? body.scope as Record<string, unknown> : {}
        const explicitIds = stringArray(scope.ids, 500)
        const clauses: string[] = []
        const values: unknown[] = []
        const add = (column: string, value: unknown) => { if (typeof value === "string" && value) { values.push(value); clauses.push(`${column}=$${values.length}`) } }
        if (explicitIds.length) { values.push(explicitIds); clauses.push(`id=ANY($${values.length}::text[])`) }
        else {
          add("collection_id", scope.collectionId); add("module_id", scope.moduleId)
          add("discipline_id", scope.disciplineId); add("set_id", scope.setId); add("status", scope.status)
          if (typeof scope.query === "string" && scope.query.trim()) { values.push(`%${scope.query.trim()}%`); clauses.push(`(prompt ILIKE $${values.length} OR title ILIKE $${values.length})`) }
        }
        if (!clauses.length && scope.all === true) clauses.push("TRUE")
        if (!clauses.length) throw new Error("Choose a page, hierarchy, or filtered scope first.")
        const where = clauses.join(" AND ")
        const matchedResult = await client.query(`SELECT status,COUNT(*)::int AS count FROM mednexus_theory_questions WHERE ${where} GROUP BY status`, values)
        const matched = matchedResult.rows.reduce((sum, row) => sum + Number(row.count), 0)
        if (!matched) return
        const operation = String(body.operation ?? "")
        let updated = 0
        if (["draft", "review", "published", "archived"].includes(operation)) {
          if (operation === "published") {
            values.push(operation)
            const result = await client.query(`UPDATE mednexus_theory_questions SET status=$${values.length},updated_at=NOW()
              WHERE ${where} AND deleted_at IS NULL AND set_id IS NOT NULL AND trim(prompt)<>'' RETURNING id`, values)
            updated = result.rowCount ?? 0
          } else {
            values.push(operation)
            const result = await client.query(`UPDATE mednexus_theory_questions SET status=$${values.length},updated_at=NOW() WHERE ${where} RETURNING id`, values)
            updated = result.rowCount ?? 0
          }
        } else if (operation === "move") {
          const destinationSetId = requiredText(body.setId, "Destination set", 100)
          const destination = await client.query(`SELECT collection_id,module_id,discipline_id,question_limit FROM mednexus_theory_sets WHERE id=$1 AND status<>'archived'`, [destinationSetId])
          if (!destination.rows[0]) throw new Error("Destination set not found.")
          values.push(destinationSetId, destination.rows[0].collection_id, destination.rows[0].module_id, destination.rows[0].discipline_id)
          const result = await client.query(`UPDATE mednexus_theory_questions SET set_id=$${values.length-3},collection_id=$${values.length-2},module_id=$${values.length-1},discipline_id=$${values.length},status=CASE WHEN status='published' THEN 'review' ELSE status END,updated_at=NOW() WHERE ${where} RETURNING id`, values)
          updated = result.rowCount ?? 0
        } else throw new Error("Unsupported bulk action.")
        await auditTheory(client, auth.uid, `bulk_${operation}`, "question", null, { scope, matched, updated, skipped: matched - updated })
        return { matched, updated, skipped: matched - updated, failed: 0, statusBreakdown: Object.fromEntries(matchedResult.rows.map(row => [row.status, Number(row.count)])) }
      }
      const resource = String(body.resource ?? "")
      const id = requiredText(body.id, "Resource id", 100)
      if (resource === "set") {
        await client.query(`UPDATE mednexus_theory_sets SET name=COALESCE($2,name),
          description=COALESCE($3,description),status=COALESCE($4,status),updated_at=NOW() WHERE id=$1`,
        [id, typeof body.name === "string" ? body.name.trim() : null,
          typeof body.description === "string" ? body.description : null,
          typeof body.status === "string" ? theoryStatus(body.status) : null])
      } else if (resource === "module") {
        await client.query(`UPDATE mednexus_theory_modules SET name=COALESCE($2,name),description=COALESCE($3,description),updated_at=NOW()
          WHERE id=$1 AND deleted_at IS NULL`, [id,typeof body.name === "string" ? requiredText(body.name,"Module name",160) : null,typeof body.description === "string" ? body.description : null])
      } else if (resource === "discipline") {
        await client.query(`UPDATE mednexus_theory_disciplines SET name=COALESCE($2,name)
          WHERE id=$1 AND deleted_at IS NULL`, [id,typeof body.name === "string" ? requiredText(body.name,"Discipline name",160) : null])
      } else if (resource === "question") {
        const current = await client.query(`SELECT title,prompt,model_answer,key_marking_points,status,
          collection_id,module_id,discipline_id,set_id
          FROM mednexus_theory_questions WHERE id=$1`, [id])
        if (!current.rows[0]) throw new Error("Question not found.")
        const nextStatus = typeof body.status === "string" ? theoryStatus(body.status) : null
        const modelAnswer = typeof body.modelAnswer === "string" ? body.modelAnswer : current.rows[0].model_answer
        let collectionId = typeof body.collectionId === "string" ? body.collectionId : current.rows[0].collection_id
        let moduleId = Object.hasOwn(body, "moduleId") ? (typeof body.moduleId === "string" && body.moduleId ? body.moduleId : null) : current.rows[0].module_id
        let disciplineId = Object.hasOwn(body, "disciplineId") ? (typeof body.disciplineId === "string" && body.disciplineId ? body.disciplineId : null) : current.rows[0].discipline_id
        const setId = Object.hasOwn(body, "setId") ? (typeof body.setId === "string" && body.setId ? body.setId : null) : current.rows[0].set_id
        if (setId && setId !== current.rows[0].set_id) {
          const destination = await client.query(`SELECT collection_id,module_id,discipline_id FROM mednexus_theory_sets WHERE id=$1 AND deleted_at IS NULL`, [setId])
          if (!destination.rows[0]) throw new Error("Destination set not found.")
          collectionId = destination.rows[0].collection_id
          moduleId = destination.rows[0].module_id
          disciplineId = destination.rows[0].discipline_id ?? disciplineId
        }
        const prompt = typeof body.prompt === "string" ? requiredText(body.prompt, "Question prompt") : current.rows[0].prompt
        const keyMarkingPoints = Array.isArray(body.keyMarkingPoints)
          ? stringArray(body.keyMarkingPoints)
          : current.rows[0].key_marking_points as string[]
        const title = deriveTheoryTitle(prompt, typeof body.title === "string" ? body.title : current.rows[0].title)
        const marks = calculateTheoryMarks(keyMarkingPoints)
        const effectiveStatus = nextStatus ?? current.rows[0].status
        if (effectiveStatus === "published" && !setId) {
          throw new Error("Choose a set before publishing this question.")
        }
        await client.query(`UPDATE mednexus_theory_questions SET
          title=$2,prompt=$3,model_answer=COALESCE($4,model_answer),
          key_marking_points=$5,marks=$6,tags=COALESCE($7,tags),
          status=COALESCE($8,status),collection_id=$9,module_id=$10,discipline_id=$11,set_id=$12,
          media=COALESCE($13,media),difficulty=COALESCE($14,difficulty),
          estimated_study_minutes=COALESCE($15,estimated_study_minutes),source_metadata=COALESCE($16,source_metadata),
          updated_at=NOW() WHERE id=$1`,
        [id, title, prompt,
          typeof body.modelAnswer === "string" ? body.modelAnswer : null,
          keyMarkingPoints, marks,
          Array.isArray(body.tags) ? stringArray(body.tags) : null, nextStatus,
          collectionId, moduleId, disciplineId, setId,
          Object.hasOwn(body, "media") ? sanitizeTheoryMedia(body.media) : null,
          Object.hasOwn(body, "difficulty") ? intInRange(body.difficulty, 1, 5, 3) : null,
          Object.hasOwn(body, "estimatedStudyMinutes") ? intInRange(body.estimatedStudyMinutes, 1, 180, 8) : null,
          body.sourceMetadata && typeof body.sourceMetadata === "object" ? body.sourceMetadata : null])
        const saved = await client.query(`SELECT ${theoryQuestionProjection},
          c.title AS "collectionTitle",m.name AS "moduleName",d.name AS "disciplineName",s.name AS "setTitle"
          FROM mednexus_theory_questions q
          JOIN mednexus_theory_collections c ON c.id=q.collection_id
          LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
          LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
          LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id WHERE q.id=$1`, [id])
        await auditTheory(client, auth.uid, "update", resource, id, {})
        return { question: saved.rows[0] }
      } else throw new Error("Unknown Theory resource.")
      await auditTheory(client, auth.uid, "update", resource, id, {})
    })
    return NextResponse.json({ ok: true, ...(summary ?? {}) })
  } catch (error) {
    console.error("[admin theory PATCH]", error)
    return databaseErrorResponse(error, error instanceof Error ? error.message : "Unable to update Theory content.", 400)
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

