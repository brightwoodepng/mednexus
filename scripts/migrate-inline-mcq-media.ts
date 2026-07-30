import { existsSync, readFileSync } from "node:fs"
import { resolve } from "node:path"
import type { Question } from "../lib/types"

function loadLocalEnvironment() {
  const path = resolve(process.cwd(), ".env.local")
  if (!existsSync(path)) return
  const raw = readFileSync(path, "utf8").trim()
  // Also accept a raw Neon URL. This avoids forcing a secret-bearing file
  // rewrite while still supporting conventional KEY=value env files.
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (/^postgres(?:ql)?:\/\//i.test(trimmed) && !process.env.DATABASE_URL) {
      process.env.DATABASE_URL = trimmed
      continue
    }
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!match || process.env[match[1]] !== undefined) continue
    let value = match[2]
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1)
    }
    process.env[match[1]] = value
  }
}

async function migrate() {
  loadLocalEnvironment()
  if (!(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim())) {
    throw new Error("DATABASE_URL or POSTGRES_URL is not configured")
  }
  const dryRun = process.argv.includes("--dry-run")
  if (!dryRun && !(process.env.BLOB_READ_WRITE_TOKEN?.trim() || process.env.VERCEL_OIDC_TOKEN?.trim())) {
    throw new Error("Vercel Blob is not configured; BLOB_READ_WRITE_TOKEN or VERCEL_OIDC_TOKEN is required")
  }

  const { default: pool, ensureSchema } = await import("../lib/db")
  if (!dryRun) await ensureSchema()
  if (dryRun) {
    const summary = await pool.query<{
      pending_questions: number
      encoded_characters: number
    }>(
      `SELECT COUNT(*)::int AS pending_questions,
              COALESCE(SUM(length(item.value->>'mediaBase64')),0)::bigint AS encoded_characters
       FROM mednexus_questions source
       CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
       WHERE source.id=1
         AND COALESCE(item.value->>'mediaBase64','') LIKE 'data:image/%;base64,%'`,
    )
    const pendingQuestions = Number(summary.rows[0]?.pending_questions ?? 0)
    const encodedCharacters = Number(summary.rows[0]?.encoded_characters ?? 0)
    await pool.end()
    console.log(JSON.stringify({
      dryRun: true,
      pendingQuestions,
      encodedCharacters,
      approximateDecodedBytes: Math.floor(encodedCharacters * 0.75),
    }))
    return
  }

  const pending = await pool.query<{ question: Question }>(
    `SELECT item.value AS question
     FROM mednexus_questions source
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb))
       WITH ORDINALITY item(value,ordinality)
     WHERE source.id=1 AND COALESCE(item.value->>'mediaBase64','') LIKE 'data:image/%;base64,%'
     ORDER BY item.ordinality`,
  )

  const { externalizeLegacyQuestionMedia } = await import("../lib/mcq-media-normalization")

  for (const row of pending.rows) {
    const client = await pool.connect()
    try {
      await client.query("BEGIN")
      await client.query("SELECT updated_at FROM mednexus_questions WHERE id=1 FOR UPDATE")
      const [normalized] = await externalizeLegacyQuestionMedia(client, [row.question], "inline-media-migration")
      await client.query(
        `UPDATE mednexus_questions source
         SET data=(
           SELECT jsonb_agg(
             CASE WHEN item.value->>'id'=$1 THEN $2::jsonb ELSE item.value END
             ORDER BY item.ordinality
           )
           FROM jsonb_array_elements(COALESCE(source.data,'[]'::jsonb))
             WITH ORDINALITY item(value,ordinality)
         ),updated_at=NOW()
         WHERE source.id=1`,
        [row.question.id, JSON.stringify(normalized)],
      )
      await client.query("COMMIT")
      console.log(`Externalized inline media for ${row.question.id}`)
    } catch (error) {
      await client.query("ROLLBACK")
      throw error
    } finally {
      client.release()
    }
  }

  // Preserve immutable assessment text and answers while replacing only legacy
  // inline media with the canonical media assets now stored on the bank record.
  await pool.query(
    `UPDATE mednexus_assessments assessment
     SET question_snapshot=(
       SELECT COALESCE(jsonb_agg(
         CASE
           WHEN bank.question IS NOT NULL
             AND COALESCE(snapshot.value->>'mediaBase64','') LIKE 'data:image/%;base64,%'
           THEN jsonb_set(snapshot.value - 'mediaBase64', '{media}',
             COALESCE(bank.question->'media','[]'::jsonb), true)
           ELSE snapshot.value
         END
         ORDER BY snapshot.ordinality
       ),'[]'::jsonb)
       FROM jsonb_array_elements(COALESCE(assessment.question_snapshot,'[]'::jsonb))
         WITH ORDINALITY snapshot(value,ordinality)
       LEFT JOIN LATERAL (
         SELECT item.value AS question
         FROM mednexus_questions source
         CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
         WHERE source.id=1 AND item.value->>'id'=snapshot.value->>'id'
         LIMIT 1
       ) bank ON TRUE
     )
     WHERE EXISTS (
       SELECT 1
       FROM jsonb_array_elements(COALESCE(assessment.question_snapshot,'[]'::jsonb)) item(value)
       WHERE COALESCE(item.value->>'mediaBase64','') LIKE 'data:image/%;base64,%'
     )`,
  )

  const remaining = await pool.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count
     FROM mednexus_questions source
     CROSS JOIN LATERAL jsonb_array_elements(COALESCE(source.data,'[]'::jsonb)) item(value)
     WHERE source.id=1 AND COALESCE(item.value->>'mediaBase64','') LIKE 'data:image/%;base64,%'`,
  )
  if (Number(remaining.rows[0]?.count ?? 0) !== 0) throw new Error("Inline MCQ media remains after migration")
  await pool.end()
  console.log(`Inline MCQ media migration complete (${pending.rowCount ?? pending.rows.length} questions).`)
}

migrate().catch(error => {
  console.error("Inline MCQ media migration failed.", error)
  process.exitCode = 1
})
