import { NextRequest, NextResponse } from "next/server"
import { authenticateRequest, authError } from "@/lib/request-auth"
import { triggerProgressionNotifications } from "@/lib/progression-notifications"

async function getPgPool() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) return null
  try {
    const { default: pool, ensureSchema } = await import("@/lib/db")
    await ensureSchema()
    return pool
  } catch {
    return null
  }
}

async function getFirestore() {
  try {
    const { getAdminDb } = await import("@/lib/firebase-admin")
    return getAdminDb()
  } catch {
    return null
  }
}

export async function GET(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers)
    if (!auth) return authError()
    const { uid } = auth

    // Try PostgreSQL first
    const pool = await getPgPool()
    if (pool) {
      const [userRes, progressRes] = await Promise.all([
        pool.query("SELECT name FROM mednexus_users WHERE uid = $1", [uid]),
        pool.query("SELECT data FROM mednexus_progress WHERE uid = $1", [uid]),
      ])
      if (userRes.rows.length === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      return NextResponse.json({
        uid,
        name: userRes.rows[0].name,
        progress: progressRes.rows[0]?.data ?? {},
      })
    }

    // Fall back to Firestore
    const db = await getFirestore()
    if (db) {
      const snap = await db.collection("users").doc(uid).get()
      if (!snap.exists) {
        return NextResponse.json({ error: "Not found" }, { status: 404 })
      }
      const data = snap.data()!
      return NextResponse.json({
        uid,
        name: data.name ?? "Clinician",
        progress: data.progress ?? {},
      })
    }

    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  } catch (err) {
    console.error("[sync GET]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = authenticateRequest(req.headers)
    if (!auth) return authError()
    const { uid } = auth

    const body = await req.json()
    const { name, progress } = body

    // Try PostgreSQL first
    const pool = await getPgPool()
    if (pool) {
      await pool.query(
        `INSERT INTO mednexus_users (uid, name)
         VALUES ($1, $2)
         ON CONFLICT (uid) DO UPDATE SET name = EXCLUDED.name`,
        [uid, name ?? "Clinician"],
      )
      if (progress !== undefined) {
        // Use JSONB merge (existing || incoming) on conflict so that a
        // Partial syncs do not overwrite unrelated existing progress keys.
        // never overwrites keys the client didn't include.  Incoming values
        // always win for keys present in both (right-hand side of || wins).
        await pool.query(
          `INSERT INTO mednexus_progress (uid, data, updated_at)
           VALUES ($1, $2::jsonb, NOW())
           ON CONFLICT (uid) DO UPDATE
             SET data       = mednexus_progress.data || EXCLUDED.data,
                 updated_at = NOW()`,
          [uid, JSON.stringify(progress)],
        )
        // Fire progression notifications — awaited but internally catches all errors
        await triggerProgressionNotifications(uid, progress, pool)
      }
      return NextResponse.json({ success: true })
    }

    // Fall back to Firestore
    const db = await getFirestore()
    if (db) {
      const { FieldValue } = await import("firebase-admin/firestore")
      await db
        .collection("users")
        .doc(uid)
        .set(
          {
            name: name ?? "Clinician",
            ...(progress !== undefined ? { progress } : {}),
            updatedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        )
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: "No database configured" }, { status: 503 })
  } catch (err) {
    console.error("[sync POST]", err)
    return NextResponse.json({ error: "Server error" }, { status: 500 })
  }
}
