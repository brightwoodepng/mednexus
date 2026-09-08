import pool from "@/lib/db"
import { theoryQuestionProjection } from "@/lib/theory-server"
import type { TheoryQuestionDetail } from "@/lib/types"

const joins = `FROM mednexus_theory_questions q
  JOIN mednexus_theory_collections c ON c.id=q.collection_id
  LEFT JOIN mednexus_theory_modules m ON m.id=q.module_id
  LEFT JOIN mednexus_theory_disciplines d ON d.id=q.discipline_id
  JOIN mednexus_theory_sets s ON s.id=q.set_id`
const published = `q.status='published' AND q.deleted_at IS NULL AND c.status='published'
  AND s.status='published' AND s.deleted_at IS NULL AND m.deleted_at IS NULL AND d.deleted_at IS NULL`

/** Feature readiness is read-only; an unrun release must not break MCQ rooms. */
export async function theoryGroupSchemaReady() {
  const result = await pool.query(`SELECT COUNT(*)::int AS count FROM information_schema.columns WHERE table_schema='public'
    AND ((table_name='mednexus_group_study_rooms' AND column_name='study_type')
      OR (table_name='mednexus_group_study_room_questions' AND column_name='revealed_at'))`)
  return Number(result.rows[0]?.count) === 2
}

export async function theoryGroupOptions() {
  const result = await pool.query(`SELECT c.id AS "collectionId", c.title AS "collectionTitle",
    q.module_id AS "moduleId", m.name AS "moduleName", q.discipline_id AS "disciplineId", d.name AS "disciplineName",
    s.id AS "setId", s.name AS "setTitle", COUNT(*)::int AS count
    ${joins} WHERE ${published}
    GROUP BY c.id,c.title,q.module_id,m.name,q.discipline_id,d.name,s.id,s.name
    ORDER BY c.title,m.name,d.name,s.name`)
  return result.rows
}

export async function theoryGroupQuestions(setId: string) {
  const result = await pool.query<TheoryQuestionDetail>(`SELECT ${theoryQuestionProjection},
    c.title AS "collectionTitle",m.name AS "moduleName",d.name AS "disciplineName",s.name AS "setTitle"
    ${joins} WHERE ${published} AND s.id=$1 ORDER BY q.sort_order,q.created_at,q.id`, [setId])
  return result.rows
}
