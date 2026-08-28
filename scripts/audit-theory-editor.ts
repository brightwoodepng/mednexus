import pool from "../lib/db"

async function main() {
  const result = await pool.query(`SELECT
    COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS active,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='draft')::int AS drafts,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='published')::int AS live,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND set_id IS NULL)::int AS unassigned,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND status='published' AND
      (TRIM(model_answer)='' OR COALESCE(cardinality(key_marking_points),0)=0))::int AS prompt_only,
    COUNT(*) FILTER (WHERE deleted_at IS NULL AND set_id IS NOT NULL AND TRIM(prompt)<>'' AND
      TRIM(model_answer)<>'' AND COALESCE(cardinality(key_marking_points),0)>0)::int AS fully_ready,
    COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS trash
    FROM mednexus_theory_questions`)
  console.log(JSON.stringify(result.rows[0], null, 2))
  await pool.end()
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})
