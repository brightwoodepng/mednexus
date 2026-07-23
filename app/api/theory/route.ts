import { NextResponse } from "next/server"

/**
 * Learner-facing Theory content is intentionally queried from its own tables.
 * This endpoint never falls back to the MCQ bank or fabricated sample content.
 */
export async function GET() {
  if (!process.env.DATABASE_URL && !process.env.POSTGRES_URL) {
    return NextResponse.json({ collections: [], disciplines: [], sets: [], questions: [] })
  }

  try {
    const { default: pool } = await import("@/lib/db")
    const [collections, disciplines, sets, questions] = await Promise.all([
      pool.query("SELECT id, slug, title, sort_order AS \"sortOrder\" FROM mednexus_theory_collections WHERE status = 'published' ORDER BY sort_order, title"),
      pool.query("SELECT id, collection_id AS \"collectionId\", name, sort_order AS \"sortOrder\" FROM mednexus_theory_disciplines ORDER BY sort_order, name"),
      pool.query("SELECT id, collection_id AS \"collectionId\", discipline_id AS \"disciplineId\", name, sort_order AS \"sortOrder\" FROM mednexus_theory_sets ORDER BY sort_order, name"),
      pool.query(`SELECT id, collection_id AS "collectionId", discipline_id AS "disciplineId", set_id AS "setId", prompt,
        model_answer AS "modelAnswer", key_marking_points AS "keyMarkingPoints", tags, difficulty,
        estimated_study_minutes AS "estimatedStudyMinutes", sort_order AS "sortOrder"
        FROM mednexus_theory_questions WHERE status = 'published' ORDER BY sort_order, created_at`),
    ])
    return NextResponse.json({ collections: collections.rows, disciplines: disciplines.rows, sets: sets.rows, questions: questions.rows })
  } catch (error) {
    console.error("[theory GET]", error)
    return NextResponse.json({ error: "Unable to load Theory Vault" }, { status: 500 })
  }
}
