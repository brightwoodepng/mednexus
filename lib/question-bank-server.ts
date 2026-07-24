import "server-only"

import { questionsDatabase } from "@/lib/questions-database"

export type QuestionBankSource = "postgres" | "firestore" | "static"

export type QuestionBankStatus = {
  source: QuestionBankSource
  questions: unknown[]
  updatedAt: string | null
  postgres: { available: boolean; rowPresent: boolean; count: number; updatedAt: string | null }
  firestore: { configured: boolean; available: boolean; count: number; updatedAt: string | null }
  static: { count: number }
}

export async function getQuestionBankStatus(): Promise<QuestionBankStatus> {
  const postgres = { available: false, rowPresent: false, count: 0, updatedAt: null as string | null }
  const firestore = { configured: Boolean(process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY), available: false, count: 0, updatedAt: null as string | null }
  if (process.env.DATABASE_URL || process.env.POSTGRES_URL) {
    try {
      const { default: pool } = await import("@/lib/db")
      const result = await pool.query("SELECT data, updated_at FROM mednexus_questions WHERE id = 1")
      postgres.available = true
      if (result.rows.length) {
        const questions = Array.isArray(result.rows[0].data) ? result.rows[0].data : []
        postgres.rowPresent = true
        postgres.count = questions.length
        postgres.updatedAt = result.rows[0].updated_at?.toISOString?.() ?? String(result.rows[0].updated_at)
        // A present empty row is a deliberate, live empty bank. Never fall through.
        return { source: "postgres", questions, updatedAt: postgres.updatedAt, postgres, firestore, static: { count: questionsDatabase.length } }
      }
    } catch {
    }
  }

  if (firestore.configured) {
    try {
      const { getAdminDb } = await import("@/lib/firebase-admin")
      const db = getAdminDb()
      if (db) {
        firestore.available = true
        const snapshot = await db.collection("mednexus").doc("questions").get()
        if (snapshot.exists) {
          const data = snapshot.data()!
          const questions = Array.isArray(data.data) ? data.data : []
          firestore.count = questions.length
          firestore.updatedAt = data.updatedAt?.toDate?.()?.toISOString() ?? null
          return { source: "firestore", questions, updatedAt: firestore.updatedAt, postgres, firestore, static: { count: questionsDatabase.length } }
        }
      }
    } catch {
      // Diagnostics report unavailable; a bundled bank remains a development fallback.
    }
  }

  return { source: "static", questions: questionsDatabase, updatedAt: null, postgres, firestore, static: { count: questionsDatabase.length } }
}
