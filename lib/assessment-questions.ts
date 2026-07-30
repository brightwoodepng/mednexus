import "server-only"

import type { Pool, PoolClient } from "pg"

type Queryable = Pick<Pool | PoolClient, "query">

export type AssessmentQuestionProjection = "full" | "safe" | "grading" | "analytics"

function projectionSql(projection: AssessmentQuestionProjection) {
  if (projection === "safe") {
    return `question
      - 'correctAnswer'
      - 'explanation'
      - 'createdAt'
      - 'updatedAt'
      - 'sourceMetadata'
      - 'audit'`
  }
  if (projection === "grading") {
    return `jsonb_build_object(
      'id', question->'id',
      'correctAnswer', question->'correctAnswer'
    )`
  }
  if (projection === "analytics") {
    return `jsonb_build_object(
      'id', question->'id',
      'vignette', question->'vignette',
      'subject', question->'subject',
      'module', question->'module',
      'correctAnswer', question->'correctAnswer'
    )`
  }
  return `question - 'audit' - 'sourceMetadata'`
}

/**
 * Resolve only the selected assessment questions inside Postgres.
 *
 * Older assessments may not have an immutable snapshot. In that case Postgres
 * reads the monolithic bank internally, but only the selected projections cross
 * the database connection.
 */
export async function loadAssessmentQuestions(
  db: Queryable,
  assessmentId: string,
  projection: AssessmentQuestionProjection,
) {
  const result = await db.query<{ question: Record<string, unknown> }>(
    `WITH assessment AS (
       SELECT question_ids, question_snapshot
       FROM mednexus_assessments
       WHERE id = $1
     ),
     source_questions AS (
       SELECT item.value AS question, item.ordinality
       FROM assessment
       CROSS JOIN LATERAL jsonb_array_elements(
         CASE
           WHEN jsonb_array_length(COALESCE(assessment.question_snapshot, '[]'::jsonb)) > 0
             THEN assessment.question_snapshot
           ELSE COALESCE((SELECT data FROM mednexus_questions WHERE id = 1), '[]'::jsonb)
         END
       ) WITH ORDINALITY AS item(value, ordinality)
       WHERE assessment.question_ids ? (item.value->>'id')
     ),
     deduplicated AS (
       SELECT DISTINCT ON (question->>'id') question
       FROM source_questions
       ORDER BY question->>'id', ordinality
     )
     SELECT ${projectionSql(projection)} AS question
     FROM deduplicated, assessment
     ORDER BY (
       SELECT ids.ordinality
       FROM jsonb_array_elements_text(assessment.question_ids)
         WITH ORDINALITY ids(id, ordinality)
       WHERE ids.id=question->>'id'
       LIMIT 1
     )`,
    [assessmentId],
  )
  return result.rows.map(row => row.question)
}
