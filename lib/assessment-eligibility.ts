import "server-only"

/** Canonical module key shared by assessment option counts and creation. */
export function assessmentModuleSql(questionSql: string) {
  return `COALESCE(NULLIF(BTRIM(${questionSql}->>'module'), ''), NULLIF(BTRIM(${questionSql}->>'subject'), ''))`
}

/** Structurally complete MCQs are eligible regardless of editorial status. */
export function assessmentEligibilitySql(questionSql: string) {
  const options = `CASE WHEN jsonb_typeof(${questionSql}->'options')='array' THEN ${questionSql}->'options' ELSE '[]'::jsonb END`
  const answers = `CASE
    WHEN jsonb_typeof(${questionSql}->'correctAnswer')='array' THEN ${questionSql}->'correctAnswer'
    WHEN jsonb_typeof(${questionSql}->'correctAnswer')='string' THEN jsonb_build_array(${questionSql}->'correctAnswer')
    ELSE '[]'::jsonb
  END`
  return `(${assessmentModuleSql(questionSql)} IS NOT NULL
    AND COALESCE(BTRIM(${questionSql}->>'subject'), '') <> ''
    AND COALESCE(BTRIM(${questionSql}->>'vignette'), '') <> ''
    AND jsonb_array_length(${options}) >= 2
    AND jsonb_array_length(${answers}) > 0
    AND NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements_text(${answers}) answer(value)
      WHERE NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(${options}) option(value)
        WHERE option.value->>'id'=answer.value
      )
    )
    AND COALESCE(BTRIM(${questionSql}->'explanation'->>'details'), '') <> '')`
}
