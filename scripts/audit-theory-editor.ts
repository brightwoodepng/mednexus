import pool from "../lib/db"

async function main() {
  const result = await pool.query(`SELECT
    COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='draft')::int AS drafts,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='published')::int AS live,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND set_id IS NULL)::int AS unassigned,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='published' AND
      (TRIM(model_answer)='' OR CASE WHEN jsonb_typeof(key_marking_points)='array' THEN jsonb_array_length(key_marking_points) ELSE 0 END=0))::int AS prompt_only,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND set_id IS NOT NULL AND TRIM(prompt)<>'' AND
      TRIM(model_answer)<>'' AND CASE WHEN jsonb_typeof(key_marking_points)='array' THEN jsonb_array_length(key_marking_points) ELSE 0 END>0)::int AS fully_ready,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS trash
    FROM mednexus_theory_questions`)
  console.log(JSON.stringify(result.rows[0], null, 2))
  await pool.end()
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
