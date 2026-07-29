import { NextRequest, NextResponse } from "next/server"
import { requireRegisteredUser, unauthorized } from "@/lib/request-auth"
import { triggerProgressionNotifications } from "@/lib/progression-notifications"

const HISTORY_LIMIT = 200
const EXAM_LIMIT = 100
const PATCH_FIELDS = new Set([
  "flaggedQuestionIds", "streak", "lastStudyDate", "notificationsLastRead",
  "mutedNotificationTypes", "favoriteModules", "srsData",
])

type SyncBody = {
  name?: string
  baseVersion?: number
  patch?: Record<string, unknown>
  increments?: { totalAnswered?: number; totalCorrect?: number }
  events?: { history?: Array<Record<string, unknown>>; examScores?: Array<Record<string, unknown>> }
  deleteHistory?: { mode: "trial" | "exam"; questionIds: string[] }
}

async function getPgPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try { return (await import("@/lib/db")).default } catch { return null }
}

async function getFirestore() {
  try { return (await import("@/lib/firebase-admin")).getAdminDb() } catch { return null }
}

function jsonWithSize(payload: unknown, context: string, status = 200) {
  const serialized = JSON.stringify(payload)
  console.info(`[sync ${context}] response_bytes=${Buffer.byteLength(serialized)}`)
  return new NextResponse(serialized, { status, headers: { "content-type": "application/json" } })
}

function cleanPatch(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {}
  return Object.fromEntries(Object.entries(value).filter(([key]) => PATCH_FIELDS.has(key)))
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const { uid } = auth
    const pool = await getPgPool()
    if (pool) {
      const [userRes, progressRes, historyRes, examRes] = await Promise.all([
        pool.query("SELECT name FROM mednexus_users WHERE uid = $1", [uid]),
        pool.query("SELECT data, version FROM mednexus_progress WHERE uid = $1", [uid]),
        pool.query("SELECT payload FROM mednexus_progress_history WHERE uid = $1 ORDER BY occurred_at DESC, event_id DESC LIMIT $2", [uid, HISTORY_LIMIT]),
        pool.query("SELECT payload FROM mednexus_progress_exam_scores WHERE uid = $1 ORDER BY occurred_at DESC, event_id DESC LIMIT $2", [uid, EXAM_LIMIT]),
      ])
      if (!userRes.rows.length) return jsonWithSize({ error: "Not found" }, "GET", 404)
      const summary = progressRes.rows[0] ?? { data: {}, version: 0 }
      return jsonWithSize({ uid, name: userRes.rows[0].name, version: Number(summary.version), progress: {
        ...summary.data, history: historyRes.rows.map((row) => row.payload), examScores: examRes.rows.map((row) => row.payload),
      }, limits: { history: HISTORY_LIMIT, examScores: EXAM_LIMIT } }, "GET")
    }

    const db = await getFirestore()
    if (db) {
      const ref = db.collection("users").doc(uid)
      const [snap, history, exams] = await Promise.all([
        ref.get(), ref.collection("progressHistory").orderBy("occurredAt", "desc").limit(HISTORY_LIMIT).get(),
        ref.collection("progressExamScores").orderBy("occurredAt", "desc").limit(EXAM_LIMIT).get(),
      ])
      if (!snap.exists) return jsonWithSize({ error: "Not found" }, "GET", 404)
      const data = snap.data()!
      return jsonWithSize({ uid, name: data.name ?? "Clinician", version: data.progressVersion ?? 0, progress: {
        ...(data.progressSummary ?? data.progress ?? {}), history: history.docs.map((doc) => doc.data().payload),
        examScores: exams.docs.map((doc) => doc.data().payload),
      }, limits: { history: HISTORY_LIMIT, examScores: EXAM_LIMIT } }, "GET")
    }
    return jsonWithSize({ error: "No database configured" }, "GET", 503)
  } catch (err) {
    console.error("[sync GET]", err)
    return jsonWithSize({ error: "Server error" }, "GET", 500)
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireRegisteredUser(req)
    if (!auth) return unauthorized()
    const raw = await req.text()
    console.info(`[sync POST] request_bytes=${Buffer.byteLength(raw)}`)
    let body: SyncBody
    try { body = JSON.parse(raw) } catch { return jsonWithSize({ error: "Invalid JSON" }, "POST", 400) }
    const { uid } = auth
    const baseVersion = Number(body.baseVersion)
    if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) return jsonWithSize({ error: "baseVersion is required" }, "POST", 400)
    const patch = cleanPatch(body.patch)
    const answeredDelta = Number(body.increments?.totalAnswered ?? 0)
    const correctDelta = Number(body.increments?.totalCorrect ?? 0)
    if (![answeredDelta, correctDelta].every(Number.isSafeInteger)) return jsonWithSize({ error: "Invalid increments" }, "POST", 400)
    const history = Array.isArray(body.events?.history) ? body.events!.history! : []
    const exams = Array.isArray(body.events?.examScores) ? body.events!.examScores! : []
    if (history.length > 500 || exams.length > 100) return jsonWithSize({ error: "Too many events" }, "POST", 413)

    const pool = await getPgPool()
    if (pool) {
      const client = await pool.connect()
      try {
        await client.query("BEGIN")
        await client.query("INSERT INTO mednexus_users (uid, name) VALUES ($1, $2) ON CONFLICT (uid) DO UPDATE SET name = EXCLUDED.name", [uid, body.name ?? "Clinician"])
        await client.query("INSERT INTO mednexus_progress (uid) VALUES ($1) ON CONFLICT (uid) DO NOTHING", [uid])
        const updated = await client.query(
          `UPDATE mednexus_progress SET data = data || $3::jsonb || jsonb_build_object(
             'totalAnswered', COALESCE((data->>'totalAnswered')::int, 0) + $4::int,
             'totalCorrect', COALESCE((data->>'totalCorrect')::int, 0) + $5::int),
             version = version + 1, updated_at = NOW()
           WHERE uid = $1 AND version = $2 RETURNING version, data`,
          [uid, baseVersion, JSON.stringify(patch), answeredDelta, correctDelta],
        )
        if (!updated.rows.length) {
          const current = await client.query("SELECT version FROM mednexus_progress WHERE uid = $1", [uid])
          await client.query("ROLLBACK")
          return jsonWithSize({ error: "Version conflict", version: Number(current.rows[0]?.version ?? 0) }, "POST", 409)
        }
        for (const event of history) await client.query(
          "INSERT INTO mednexus_progress_history (uid, event_id, occurred_at, mode, question_id, payload) VALUES ($1,$2,to_timestamp($3 / 1000.0),$4,$5,$6::jsonb) ON CONFLICT DO NOTHING",
          [uid, String(event.id ?? `${event.questionId}:${event.timestamp}`), Number(event.timestamp ?? Date.now()), event.mode ?? "trial", event.questionId ?? "", JSON.stringify(event)],
        )
        for (const event of exams) await client.query(
          "INSERT INTO mednexus_progress_exam_scores (uid, event_id, occurred_at, payload) VALUES ($1,$2,$3::timestamptz,$4::jsonb) ON CONFLICT DO NOTHING",
          [uid, String(event.id), event.date ?? new Date().toISOString(), JSON.stringify(event)],
        )
        if (body.deleteHistory) await client.query(
          "DELETE FROM mednexus_progress_history WHERE uid=$1 AND mode=$2 AND question_id = ANY($3::text[])",
          [uid, body.deleteHistory.mode, body.deleteHistory.questionIds],
        )
        await client.query("COMMIT")
        await triggerProgressionNotifications(uid, updated.rows[0].data, pool)
        return jsonWithSize({ success: true, version: Number(updated.rows[0].version) }, "POST")
      } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
    }

    const db = await getFirestore()
    if (db) {
      const { FieldValue } = await import("firebase-admin/firestore")
      const ref = db.collection("users").doc(uid)
      const result = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref)
        const currentVersion = snap.data()?.progressVersion ?? 0
        if (currentVersion !== baseVersion) return { conflict: true, version: currentVersion }
        tx.set(ref, { name: body.name ?? "Clinician", progressVersion: currentVersion + 1, progressSummary: {
          ...(snap.data()?.progressSummary ?? {}), ...patch,
          totalAnswered: (snap.data()?.progressSummary?.totalAnswered ?? 0) + answeredDelta,
          totalCorrect: (snap.data()?.progressSummary?.totalCorrect ?? 0) + correctDelta,
        }, updatedAt: FieldValue.serverTimestamp() }, { merge: true })
        for (const event of history) tx.set(ref.collection("progressHistory").doc(String(event.id ?? `${event.questionId}:${event.timestamp}`)), {
          payload: event, mode: event.mode, questionId: event.questionId,
          occurredAt: new Date(Number(event.timestamp ?? Date.now())),
        })
        for (const event of exams) tx.set(ref.collection("progressExamScores").doc(String(event.id)), { payload: event, occurredAt: new Date(String(event.date ?? new Date().toISOString())) })
        return { conflict: false, version: currentVersion + 1 }
      })
      if (result.conflict) return jsonWithSize({ error: "Version conflict", version: result.version }, "POST", 409)
      if (body.deleteHistory?.questionIds.length) {
        for (let start = 0; start < body.deleteHistory.questionIds.length; start += 30) {
          const ids = body.deleteHistory.questionIds.slice(start, start + 30)
          const snapshots = await ref.collection("progressHistory")
            .where("mode", "==", body.deleteHistory.mode).where("questionId", "in", ids).get()
          const batch = db.batch()
          snapshots.docs.forEach((doc) => batch.delete(doc.ref))
          await batch.commit()
        }
      }
      return jsonWithSize({ success: true, version: result.version }, "POST")
    }
    return jsonWithSize({ error: "No database configured" }, "POST", 503)
  } catch (err) {
    console.error("[sync POST]", err)
    return jsonWithSize({ error: "Server error" }, "POST", 500)
  }
}
