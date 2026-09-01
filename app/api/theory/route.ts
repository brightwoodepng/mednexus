import { NextRequest, NextResponse } from "next/server"
import { getRequestAuth, requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import {
  pagination,
  requiredText,
  optionalText,
  theoryDatabaseAvailable,
  theoryId,
  theoryPool,
  theoryQuestionProjection,
  theoryRatingOutcome,
  theorySetDisplayProjection,
  withTransaction,
  wordCount,
} from "@/lib/theory-server"

const databaseRequired = () => NextResponse.json({ error: "Theory Vault database is not configured." }, { status: 503 })
const badRequest = (message: string) => NextResponse.json({ error: message }, { status: 400 })

export async function GET(request: NextRequest) {
  if (!theoryDatabaseAvailable()) return databaseRequired()
  const mode = request.nextUrl.searchParams.get("mode") ?? "catalog"
  try {
    const pool = await theoryPool()
    const auth = await getRequestAuth(request)
    const userId = auth?.uid ?? null

    if (mode === "catalog") {
      const [collections, modules, disciplines, sets] = await Promise.all([
        pool.query(`SELECT c.id, c.slug, c.title, c.kind, c.sort_order AS "sortOrder",
          COUNT(DISTINCT q.id)::int AS "totalQuestions",
          COUNT(DISTINCT CASE WHEN rp.completed_at IS NOT NULL THEN q.id END)::int AS "completedQuestions"
          FROM mednexus_theory_collections c
          LEFT JOIN mednexus_theory_questions q ON q.collection_id=c.id AND q.status='published' AND q.deleted_at IS NULL
          LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
          WHERE c.status='published' GROUP BY c.id ORDER BY c.sort_order, c.title`, [userId]),
        pool.query(`SELECT id, collection_id AS "collectionId", name, description, sort_order AS "sortOrder"
          FROM mednexus_theory_modules WHERE deleted_at IS NULL ORDER BY sort_order, name`),
        pool.query(`SELECT id, collection_id AS "collectionId", name, sort_order AS "sortOrder"
          FROM mednexus_theory_disciplines WHERE deleted_at IS NULL ORDER BY sort_order, name`),
        pool.query(`SELECT s.id, s.collection_id AS "collectionId", s.module_id AS "moduleId",
          s.discipline_id AS "disciplineId", s.name, s.description, s.question_limit AS "questionLimit",
          ${theorySetDisplayProjection("s")},
          COUNT(q.id)::int AS "totalQuestions",
          COUNT(CASE WHEN rp.completed_at IS NOT NULL THEN 1 END)::int AS "completedQuestions",
          MIN(q.sort_order)::int AS "rangeStart", MAX(q.sort_order)::int AS "rangeEnd"
          FROM mednexus_theory_sets s
          LEFT JOIN mednexus_theory_questions q ON q.set_id=s.id AND q.status='published' AND q.deleted_at IS NULL
          LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
          WHERE s.status='published' AND s.deleted_at IS NULL
          GROUP BY s.id ORDER BY s.sort_order, s.name`, [userId]),
      ])
      return NextResponse.json({ collections: collections.rows, modules: modules.rows, disciplines: disciplines.rows, sets: sets.rows })
    }

    if (mode === "set") {
      const setId = request.nextUrl.searchParams.get("id")
      if (!setId) return badRequest("Set id is required.")
      const [setResult, questions] = await Promise.all([
        pool.query(`SELECT s.id, s.name, s.description, s.collection_id AS "collectionId",
          s.module_id AS "moduleId", s.discipline_id AS "disciplineId",
          ${theorySetDisplayProjection("s")},
          c.title AS "collectionTitle", c.kind, m.name AS "moduleName", d.name AS "disciplineName"
          FROM mednexus_theory_sets s
          JOIN mednexus_theory_collections c ON c.id=s.collection_id
          LEFT JOIN mednexus_theory_modules m ON m.id=s.module_id
          LEFT JOIN mednexus_theory_disciplines d ON d.id=s.discipline_id
          WHERE s.id=$1 AND s.status='published' AND s.deleted_at IS NULL`, [setId]),
        pool.query(`SELECT q.id, q.title, q.prompt, q.sort_order AS "sortOrder", q.marks,
          (rp.completed_at IS NOT NULL) AS completed,
          EXISTS(SELECT 1 FROM mednexus_theory_bookmarks b WHERE b.user_id=$2 AND b.question_id=q.id) AS bookmarked,
          EXISTS(SELECT 1 FROM mednexus_theory_revision_queue r WHERE r.user_id=$2 AND r.question_id=q.id AND r.active) AS revision,
          EXISTS(SELECT 1 FROM mednexus_theory_attempts a WHERE a.user_id=$2 AND a.question_id=q.id AND a.status='draft') AS draft
          FROM mednexus_theory_questions q
          LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$2
          WHERE q.set_id=$1 AND q.status='published' AND q.deleted_at IS NULL
          ORDER BY q.sort_order, q.created_at, q.id`, [setId, userId]),
      ])
      if (!setResult.rows[0]) return NextResponse.json({ error: "Set not found." }, { status: 404 })
      const total = questions.rows.length
      const completed = questions.rows.filter(row => row.completed).length
      return NextResponse.json({ ...setResult.rows[0], questions: questions.rows, total, completed, progressPercent: total ? Math.round(completed / total * 100) : 0 })
    }

    if (mode === "question") {
      const questionId = request.nextUrl.searchParams.get("id")
      if (!questionId) return badRequest("Question id is required.")
      const result = await pool.query(`SELECT ${theoryQuestionProjection},
        c.title AS "collectionTitle", m.name AS "moduleName", d.name AS "disciplineName", s.name AS "setTitle",
        ${theorySetDisplayProjection("s")}
        FROM mednexus_theory_questions q
        JOIN mednexus_theory_collections c ON c.id=q.collection_id
        LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
        LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
        WHERE q.id=$1 AND q.status='published' AND q.deleted_at IS NULL`, [questionId])
      const question = result.rows[0]
      if (!question) return NextResponse.json({ error: "Question not found." }, { status: 404 })
      const siblings = await pool.query(`SELECT id FROM mednexus_theory_questions
        WHERE set_id IS NOT DISTINCT FROM $1 AND status='published' AND deleted_at IS NULL ORDER BY sort_order, created_at, id`, [question.setId])
      const ids = siblings.rows.map(row => row.id as string)
      const index = ids.indexOf(questionId)
      let state = null
      if (userId) {
        const stateResult = await pool.query(`SELECT
          rp.opened_at AS "openedAt", rp.reviewed_at AS "reviewedAt", rp.completed_at AS "completedAt", rp.confidence,
          EXISTS(SELECT 1 FROM mednexus_theory_bookmarks b WHERE b.user_id=$1 AND b.question_id=$2) AS bookmark,
          EXISTS(SELECT 1 FROM mednexus_theory_revision_queue r WHERE r.user_id=$1 AND r.question_id=$2 AND r.active) AS revision,
          COALESCE((SELECT body FROM mednexus_theory_notes n WHERE n.user_id=$1 AND n.question_id=$2), '') AS note,
          (SELECT json_build_object('id', a.id, 'answerMd', a.answer_md, 'updatedAt', a.updated_at)
            FROM mednexus_theory_attempts a WHERE a.user_id=$1 AND a.question_id=$2 AND a.status='draft'
            ORDER BY a.updated_at DESC LIMIT 1) AS draft
          FROM (SELECT 1) seed
          LEFT JOIN mednexus_theory_reading_progress rp ON rp.user_id=$1 AND rp.question_id=$2`, [userId, questionId])
        state = stateResult.rows[0]
      }
      return NextResponse.json({
        ...question,
        position: index + 1,
        setTotal: ids.length,
        previousId: index > 0 ? ids[index - 1] : null,
        nextId: index >= 0 && index < ids.length - 1 ? ids[index + 1] : null,
        state,
      })
    }

    if (mode === "library") {
      if (!auth) return unauthorized()
      const { page, pageSize, offset } = pagination(request.nextUrl)
      const view = request.nextUrl.searchParams.get("view") ?? "bookmarks"
      const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
      const groupId = request.nextUrl.searchParams.get("groupId")
      const sort = request.nextUrl.searchParams.get("sort") ?? "recent"
      const join = view === "notes"
        ? "JOIN mednexus_theory_notes owned ON owned.question_id=q.id AND owned.user_id=$1"
        : view === "revision"
          ? "JOIN mednexus_theory_revision_queue owned ON owned.question_id=q.id AND owned.user_id=$1 AND owned.active"
          : "JOIN mednexus_theory_bookmarks owned ON owned.question_id=q.id AND owned.user_id=$1"
      const dateColumn = view === "notes" ? "owned.updated_at" : view === "revision" ? "owned.added_at" : "owned.created_at"
      const order = sort === "module" ? `COALESCE(m.name,d.name), q.sort_order` : sort === "priority" && view === "revision" ? `owned.priority DESC, ${dateColumn} DESC` : `${dateColumn} DESC`
      const result = await pool.query(`SELECT q.id, q.title, q.prompt, q.marks, c.title AS collection,
        m.name AS module, d.name AS discipline, s.name AS "setTitle", ${theorySetDisplayProjection("s")},
        ${dateColumn} AS "updatedAt",
        ${view === "notes" ? "owned.body AS note," : "NULL::text AS note,"}
        ${view === "revision" ? "owned.priority, owned.confidence," : "0::int AS priority, NULL::text AS confidence,"}
        COUNT(*) OVER()::int AS "totalCount"
        FROM mednexus_theory_questions q ${join}
        JOIN mednexus_theory_collections c ON c.id=q.collection_id
        LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
        LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
        WHERE q.status='published' AND q.deleted_at IS NULL
          AND ($2='' OR q.prompt ILIKE '%' || $2 || '%' OR COALESCE(m.name,d.name,'') ILIKE '%' || $2 || '%')
          AND ($3::text IS NULL OR q.module_id=$3 OR q.discipline_id=$3 OR q.collection_id=$3)
        ORDER BY ${order} LIMIT $4 OFFSET $5`, [auth.uid, query, groupId, pageSize, offset])
      return NextResponse.json({ items: result.rows, page, pageSize, total: result.rows[0]?.totalCount ?? 0 })
    }

    if (mode === "search") {
      const { page, pageSize, offset } = pagination(request.nextUrl)
      const query = request.nextUrl.searchParams.get("q")?.trim() ?? ""
      if (query.length < 2) return NextResponse.json({ items: [], page, pageSize, total: 0 })
      const collectionId = request.nextUrl.searchParams.get("collectionId")
      const groupId = request.nextUrl.searchParams.get("groupId")
      const result = await pool.query(`SELECT q.id, q.title, q.prompt, c.title AS collection,
        m.name AS module, d.name AS discipline, s.name AS "setTitle", ${theorySetDisplayProjection("s")},
        CASE WHEN $1::text IS NOT NULL THEN n.body ELSE NULL END AS "noteMatch",
        ts_headline('english', q.prompt, plainto_tsquery('english', $2),
          'StartSel=<mark>, StopSel=</mark>, MaxWords=24, MinWords=8') AS highlight,
        GREATEST(
          ts_rank(to_tsvector('english', coalesce(q.title,'') || ' ' || q.prompt || ' ' || q.model_answer), plainto_tsquery('english', $2)),
          similarity(q.prompt, $2)
        ) AS rank,
        COUNT(*) OVER()::int AS "totalCount"
        FROM mednexus_theory_questions q
        JOIN mednexus_theory_collections c ON c.id=q.collection_id
        LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
        LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
        LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
        LEFT JOIN mednexus_theory_notes n ON n.question_id=q.id AND n.user_id=$1
        WHERE q.status='published' AND q.deleted_at IS NULL
          AND ($3::text IS NULL OR q.collection_id=$3)
          AND ($4::text IS NULL OR q.module_id=$4 OR q.discipline_id=$4)
          AND (
            to_tsvector('english', coalesce(q.title,'') || ' ' || q.prompt || ' ' || q.model_answer || ' ' || array_to_string(ARRAY(SELECT jsonb_array_elements_text(q.tags)), ' '))
              @@ plainto_tsquery('english', $2)
            OR q.prompt ILIKE '%' || $2 || '%'
            OR c.title ILIKE '%' || $2 || '%'
            OR s.name ILIKE '%' || $2 || '%'
            OR m.name ILIKE '%' || $2 || '%'
            OR d.name ILIKE '%' || $2 || '%'
            OR ($1::text IS NOT NULL AND n.body ILIKE '%' || $2 || '%')
          )
        ORDER BY rank DESC, q.sort_order LIMIT $5 OFFSET $6`,
      [userId, query, collectionId, groupId, pageSize, offset])
      return NextResponse.json({ items: result.rows, page, pageSize, total: result.rows[0]?.totalCount ?? 0 })
    }

    if (mode === "progress") {
      if (!auth) return unauthorized()
      const [totals, groups, recent] = await Promise.all([
        pool.query(`SELECT COUNT(q.id)::int AS total,
          COUNT(CASE WHEN rp.completed_at IS NOT NULL THEN 1 END)::int AS completed,
          COUNT(CASE WHEN rp.opened_at IS NOT NULL AND rp.completed_at IS NULL THEN 1 END)::int AS "inProgress",
          COUNT(CASE WHEN rp.confidence='low' THEN 1 END)::int AS "needsRevision",
          COUNT(CASE WHEN rp.confidence='high' THEN 1 END)::int AS high,
          COUNT(CASE WHEN rp.confidence='medium' THEN 1 END)::int AS medium,
          COUNT(CASE WHEN rp.confidence='low' THEN 1 END)::int AS low,
          (SELECT COUNT(*)::int FROM mednexus_theory_attempts WHERE user_id=$1) AS attempts,
          (SELECT COUNT(*)::int FROM mednexus_theory_attempts WHERE user_id=$1 AND status='draft') AS drafts,
          (SELECT COUNT(*)::int FROM mednexus_theory_bookmarks WHERE user_id=$1) AS bookmarks,
          (SELECT COUNT(*)::int FROM mednexus_theory_notes WHERE user_id=$1 AND body<>'') AS notes,
          (SELECT COUNT(*)::int FROM mednexus_theory_revision_queue WHERE user_id=$1 AND active) AS revisions
          FROM mednexus_theory_questions q
          LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
          WHERE q.status='published' AND q.deleted_at IS NULL`, [auth.uid]),
        pool.query(`SELECT c.id AS "collectionId", c.title AS collection,
          COALESCE(m.id,d.id) AS "groupId", COALESCE(m.name,d.name,'Unassigned') AS name,
          COUNT(q.id)::int AS total,
          COUNT(CASE WHEN rp.completed_at IS NOT NULL THEN 1 END)::int AS completed,
          COUNT(DISTINCT q.set_id)::int AS "totalSets",
          COUNT(DISTINCT CASE WHEN set_progress.remaining=0 THEN q.set_id END)::int AS "completedSets"
          FROM mednexus_theory_questions q
          JOIN mednexus_theory_collections c ON c.id=q.collection_id
          LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
          LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
          LEFT JOIN mednexus_theory_reading_progress rp ON rp.question_id=q.id AND rp.user_id=$1
          LEFT JOIN LATERAL (
            SELECT COUNT(*) FILTER (WHERE srp.completed_at IS NULL)::int AS remaining
            FROM mednexus_theory_questions sq
            LEFT JOIN mednexus_theory_reading_progress srp ON srp.question_id=sq.id AND srp.user_id=$1
            WHERE sq.set_id=q.set_id AND sq.status='published'
          ) set_progress ON TRUE
          WHERE q.status='published' AND q.deleted_at IS NULL
          GROUP BY c.id,c.title,m.id,m.name,d.id,d.name ORDER BY c.title,name`, [auth.uid]),
        pool.query(`SELECT ra.activity_type AS type, ra.occurred_at AS "occurredAt", q.id AS "questionId",
          q.prompt, COALESCE(m.name,d.name) AS "groupName", s.name AS "setTitle",
          ${theorySetDisplayProjection("s")}
          FROM mednexus_theory_recent_activity ra
          LEFT JOIN mednexus_theory_questions q ON q.id=ra.question_id
          LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
          LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
          LEFT JOIN mednexus_theory_sets s ON s.id=q.set_id
          WHERE ra.user_id=$1 ORDER BY ra.occurred_at DESC LIMIT 20`, [auth.uid]),
      ])
      return NextResponse.json({ totals: totals.rows[0], groups: groups.rows, recent: recent.rows })
    }

    return badRequest("Unknown Theory Vault mode.")
  } catch (error) {
    console.error("[theory GET]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to load Theory Vault." }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  if (!theoryDatabaseAvailable()) return databaseRequired()
  const auth = await requireRegisteredUser(request)
  if (!auth) return unauthorized()
  try {
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action ?? "")
    const questionId = typeof body.questionId === "string" ? body.questionId : null
    const pool = await theoryPool()

    if (action !== "session" && !questionId) return badRequest("Question id is required.")
    let questionHasAnswer = false
    if (questionId) {
      const exists = await pool.query(`SELECT
        (TRIM(model_answer)<>'' AND CASE WHEN jsonb_typeof(key_marking_points)='array' THEN jsonb_array_length(key_marking_points) ELSE 0 END>0) AS has_answer
        FROM mednexus_theory_questions WHERE id=$1 AND status='published' AND deleted_at IS NULL`, [questionId])
      if (!exists.rows.length) return NextResponse.json({ error: "Question not found." }, { status: 404 })
      questionHasAnswer = exists.rows[0].has_answer === true
    }

    if (action === "opened" || action === "reviewed") {
      const reviewed = action === "reviewed"
      if (reviewed && !questionHasAnswer) return badRequest("This prompt does not have a model answer to review yet.")
      await withTransaction(pool, async client => {
        await client.query(`INSERT INTO mednexus_theory_reading_progress
          (user_id, question_id, progress_percent, opened_at, reviewed_at, completed_at, last_read_at, last_mode, review_count)
          VALUES ($1,$2,$3,NOW(),${reviewed ? "NOW()" : "NULL"},${reviewed ? "NOW()" : "NULL"},NOW(),'review',$4)
          ON CONFLICT (user_id,question_id) DO UPDATE SET
            opened_at=COALESCE(mednexus_theory_reading_progress.opened_at,NOW()),
            reviewed_at=${reviewed ? "NOW()" : "mednexus_theory_reading_progress.reviewed_at"},
            completed_at=${reviewed ? "COALESCE(mednexus_theory_reading_progress.completed_at,NOW())" : "mednexus_theory_reading_progress.completed_at"},
            progress_percent=GREATEST(mednexus_theory_reading_progress.progress_percent,$3),
            last_read_at=NOW(), last_mode='review',
            review_count=mednexus_theory_reading_progress.review_count+$4`,
        [auth.uid, questionId, reviewed ? 100 : 1, reviewed ? 1 : 0])
        if (reviewed) await client.query(`INSERT INTO mednexus_theory_model_answer_reviews (user_id,question_id)
          VALUES ($1,$2) ON CONFLICT (user_id,question_id) DO UPDATE SET reviewed_at=NOW(),
          review_count=mednexus_theory_model_answer_reviews.review_count+1`, [auth.uid, questionId])
        await client.query(`INSERT INTO mednexus_theory_recent_activity
          (id,user_id,question_id,activity_type) VALUES ($1,$2,$3,$4)`,
        [theoryId("theory-activity"), auth.uid, questionId, reviewed ? "reviewed" : "opened"])
      })
      return NextResponse.json({ ok: true, completed: reviewed })
    }

    if (action === "bookmark") {
      const enabled = body.enabled !== false
      if (enabled) await pool.query(`INSERT INTO mednexus_theory_bookmarks (user_id,question_id)
        VALUES ($1,$2) ON CONFLICT DO NOTHING`, [auth.uid, questionId])
      else await pool.query("DELETE FROM mednexus_theory_bookmarks WHERE user_id=$1 AND question_id=$2", [auth.uid, questionId])
      return NextResponse.json({ ok: true, bookmark: enabled })
    }

    if (action === "revision") {
      const enabled = body.enabled !== false
      if (enabled) await pool.query(`INSERT INTO mednexus_theory_revision_queue
        (user_id,question_id,source,priority,active,removed_at,updated_at)
        VALUES ($1,$2,$3,$4,TRUE,NULL,NOW())
        ON CONFLICT (user_id,question_id) DO UPDATE SET source=EXCLUDED.source,
          priority=EXCLUDED.priority, active=TRUE, removed_at=NULL, updated_at=NOW()`,
      [auth.uid, questionId, body.source === "self_rating" ? "self_rating" : "manual", Number(body.priority) || 0])
      else await pool.query(`UPDATE mednexus_theory_revision_queue
        SET active=FALSE,removed_at=NOW(),updated_at=NOW() WHERE user_id=$1 AND question_id=$2`,
      [auth.uid, questionId])
      return NextResponse.json({ ok: true, revision: enabled })
    }

    if (action === "note") {
      const note = optionalText(body.note, 20_000).trim()
      if (!note) await pool.query("DELETE FROM mednexus_theory_notes WHERE user_id=$1 AND question_id=$2", [auth.uid, questionId])
      else await pool.query(`INSERT INTO mednexus_theory_notes (id,user_id,question_id,body)
        VALUES ($1,$2,$3,$4) ON CONFLICT (user_id,question_id)
        DO UPDATE SET body=EXCLUDED.body,updated_at=NOW()`, [theoryId("theory-note"), auth.uid, questionId, note])
      return NextResponse.json({ ok: true, note })
    }

    if (action === "draft") {
      const answer = optionalText(body.answer, 100_000)
      const result = await pool.query(`INSERT INTO mednexus_theory_attempts
        (id,user_id,question_id,answer_md,word_count,status)
        VALUES ($1,$2,$3,$4,$5,'draft')
        ON CONFLICT (user_id,question_id) WHERE status='draft'
        DO UPDATE SET answer_md=EXCLUDED.answer_md,word_count=EXCLUDED.word_count,updated_at=NOW()
        RETURNING id,answer_md AS "answerMd",word_count AS "wordCount",updated_at AS "updatedAt"`,
      [theoryId("theory-attempt"), auth.uid, questionId, answer, wordCount(answer)])
      return NextResponse.json({ ok: true, draft: result.rows[0] })
    }

    if (action === "reveal") {
      if (!questionHasAnswer) return badRequest("The model answer is still being prepared.")
      await pool.query(`INSERT INTO mednexus_theory_attempts
        (id,user_id,question_id,status,model_answer_revealed_at)
        VALUES ($1,$2,$3,'draft',NOW())
        ON CONFLICT (user_id,question_id) WHERE status='draft'
        DO UPDATE SET model_answer_revealed_at=NOW(),updated_at=NOW()`,
      [theoryId("theory-attempt"), auth.uid, questionId])
      return NextResponse.json({ ok: true, revealed: true })
    }

    if (action === "submit") {
      const answer = optionalText(body.answer, 100_000)
      const result = await withTransaction(pool, async client => {
        const draft = await client.query(`SELECT id FROM mednexus_theory_attempts
          WHERE user_id=$1 AND question_id=$2 AND status='draft' FOR UPDATE`, [auth.uid, questionId])
        const id = draft.rows[0]?.id ?? theoryId("theory-attempt")
        if (draft.rows[0]) await client.query(`UPDATE mednexus_theory_attempts SET answer_md=$3,
          word_count=$4,status='submitted',submitted_at=NOW(),updated_at=NOW() WHERE id=$1 AND user_id=$2`,
        [id, auth.uid, answer, wordCount(answer)])
        else await client.query(`INSERT INTO mednexus_theory_attempts
          (id,user_id,question_id,answer_md,word_count,status,submitted_at)
          VALUES ($1,$2,$3,$4,$5,'submitted',NOW())`, [id, auth.uid, questionId, answer, wordCount(answer)])
        return id
      })
      return NextResponse.json({ ok: true, attemptId: result })
    }

    if (action === "rate") {
      if (!questionHasAnswer) return badRequest("Self-marking is unavailable until a model answer is added.")
      const rating = body.rating
      if (rating !== "excellent" && rating !== "partial" && rating !== "needs_revision") return badRequest("A valid self-rating is required.")
      const { confidence } = theoryRatingOutcome(rating)
      await withTransaction(pool, async client => {
        let attempt = await client.query(`SELECT id FROM mednexus_theory_attempts
          WHERE user_id=$1 AND question_id=$2 ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`, [auth.uid, questionId])
        if (!attempt.rows.length) attempt = await client.query(`INSERT INTO mednexus_theory_attempts
          (id,user_id,question_id,status,submitted_at,model_answer_revealed_at)
          VALUES ($1,$2,$3,'submitted',NOW(),NOW()) RETURNING id`,
        [theoryId("theory-attempt"), auth.uid, questionId])
        await client.query(`UPDATE mednexus_theory_attempts SET status='submitted',
          submitted_at=COALESCE(submitted_at,NOW()),self_rating=$2,updated_at=NOW() WHERE id=$1`,
        [attempt.rows[0].id, rating])
        await client.query(`INSERT INTO mednexus_theory_reading_progress
          (user_id,question_id,progress_percent,opened_at,completed_at,last_read_at,confidence,last_mode)
          VALUES ($1,$2,100,NOW(),NOW(),NOW(),$3,'practice')
          ON CONFLICT (user_id,question_id) DO UPDATE SET progress_percent=100,
            opened_at=COALESCE(mednexus_theory_reading_progress.opened_at,NOW()),
            completed_at=COALESCE(mednexus_theory_reading_progress.completed_at,NOW()),
            last_read_at=NOW(),confidence=$3,last_mode='practice'`, [auth.uid, questionId, confidence])
        if (rating === "needs_revision") await client.query(`INSERT INTO mednexus_theory_revision_queue
          (user_id,question_id,source,confidence,active,removed_at,updated_at)
          VALUES ($1,$2,'self_rating','low',TRUE,NULL,NOW())
          ON CONFLICT (user_id,question_id) DO UPDATE SET source='self_rating',confidence='low',
            active=TRUE,removed_at=NULL,updated_at=NOW()`, [auth.uid, questionId])
        if (rating === "excellent") await client.query(`UPDATE mednexus_theory_revision_queue
          SET confidence='high',active=FALSE,removed_at=NOW(),last_reviewed_at=NOW(),
            review_count=review_count+1,updated_at=NOW() WHERE user_id=$1 AND question_id=$2`,
        [auth.uid, questionId])
        if (rating === "partial") await client.query(`UPDATE mednexus_theory_revision_queue
          SET confidence='medium',last_reviewed_at=NOW(),review_count=review_count+1,updated_at=NOW()
          WHERE user_id=$1 AND question_id=$2`, [auth.uid, questionId])
        await client.query(`INSERT INTO mednexus_theory_recent_activity
          (id,user_id,question_id,activity_type,metadata) VALUES ($1,$2,$3,'practice_rated',$4)`,
        [theoryId("theory-activity"), auth.uid, questionId, { rating }])
      })
      return NextResponse.json({ ok: true, rating, confidence, revision: rating === "needs_revision" })
    }

    if (action === "session") {
      const kind = body.kind === "revision" ? "revision" : "set"
      const setId = typeof body.setId === "string" ? body.setId : null
      const rows = kind === "revision"
        ? await pool.query(`SELECT q.id FROM mednexus_theory_revision_queue r
          JOIN mednexus_theory_questions q ON q.id=r.question_id
          WHERE r.user_id=$1 AND r.active AND q.status='published' AND q.deleted_at IS NULL
          ORDER BY r.priority DESC,r.added_at`, [auth.uid])
        : await pool.query(`SELECT id FROM mednexus_theory_questions
          WHERE set_id=$1 AND status='published' AND deleted_at IS NULL ORDER BY sort_order,created_at,id`, [setId])
      if (!rows.rows.length) return badRequest("There are no questions available for this session.")
      const id = theoryId("theory-session")
      const questionIds = rows.rows.map(row => row.id)
      await pool.query(`INSERT INTO mednexus_theory_study_sessions
        (id,user_id,kind,set_id,question_ids,timer_seconds) VALUES ($1,$2,$3,$4,$5,$6)`,
      [id, auth.uid, kind, setId, questionIds, body.timerSeconds == null ? null : Number(body.timerSeconds)])
      return NextResponse.json({ id, kind, questionIds, currentIndex: 0 })
    }

    return badRequest("Unknown Theory Vault action.")
  } catch (error) {
    console.error("[theory POST]", error)
    return NextResponse.json({ error: error instanceof Error ? error.message : "Unable to update Theory Vault." }, { status: 500 })
  }
}
