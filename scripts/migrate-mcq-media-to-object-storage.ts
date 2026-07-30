import { createHash } from "crypto"
import sharp from "sharp"

async function checksum(bytes: Uint8Array) {
  return createHash("sha256").update(bytes).digest("hex")
}

async function migrate() {
  if (!(process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim())) throw new Error("DATABASE_URL or POSTGRES_URL is not configured")
  const [{ default: pool, ensureSchema }, storage] = await Promise.all([import("../lib/db"), import("../lib/mcq-media-storage")])
  await ensureSchema()
  const legacyColumn = await pool.query("SELECT 1 FROM information_schema.columns WHERE table_name='mednexus_mcq_media_assets' AND column_name='data'")
  if (!legacyColumn.rowCount) { console.log("MCQ media binary column has already been removed."); await pool.end(); return }

  const assets = await pool.query("SELECT id,mime_type,data FROM mednexus_mcq_media_assets WHERE object_key IS NULL ORDER BY id")
  for (const asset of assets.rows) {
    if (!asset.data) throw new Error(`Asset ${asset.id} has neither object_key nor binary data`)
    const bytes = new Uint8Array(asset.data)
    const digest = await checksum(bytes)
    const metadata = await sharp(bytes, { animated: true, limitInputPixels: 25_000_000 }).metadata()
    if (!metadata.width || !metadata.height) throw new Error(`Asset ${asset.id} has invalid dimensions`)
    const extension = asset.mime_type === "image/jpeg" ? "jpg" : asset.mime_type.split("/")[1]
    const key = `mcq-media/${digest}.${extension}`
    const objectLocation = await storage.putMcqMedia(key, bytes, asset.mime_type, digest)
    const stored = await storage.readMcqMedia(objectLocation)
    if (stored.byteLength !== bytes.byteLength || await checksum(stored) !== digest) throw new Error(`Checksum verification failed for ${asset.id}; database was not changed`)
    await pool.query("UPDATE mednexus_mcq_media_assets SET object_key=$1,byte_size=$2,checksum_sha256=$3,width=$4,height=$5,updated_at=NOW() WHERE id=$6 AND object_key IS NULL", [objectLocation, bytes.byteLength, digest, metadata.width, metadata.height, asset.id])
    console.log(`Migrated and verified ${asset.id}`)
  }

  const client = await pool.connect()
  try {
    await client.query("BEGIN")
    await client.query("LOCK TABLE mednexus_mcq_media_assets IN ACCESS EXCLUSIVE MODE")
    const pending = await client.query("SELECT count(*)::int AS count FROM mednexus_mcq_media_assets WHERE object_key IS NULL OR byte_size IS NULL OR checksum_sha256 IS NULL OR width IS NULL OR height IS NULL")
    if (pending.rows[0].count) throw new Error(`${pending.rows[0].count} assets remain unverified; refusing to remove binary data`)
    await client.query(`ALTER TABLE mednexus_mcq_media_assets ALTER COLUMN object_key SET NOT NULL, ALTER COLUMN byte_size SET NOT NULL, ALTER COLUMN checksum_sha256 SET NOT NULL, ALTER COLUMN width SET NOT NULL, ALTER COLUMN height SET NOT NULL; ALTER TABLE mednexus_mcq_media_assets DROP COLUMN data; INSERT INTO mednexus_schema_migrations(version) VALUES ('2026-07-29-mcq-media-object-storage-v1') ON CONFLICT DO NOTHING`)
    await client.query("COMMIT")
  } catch (error) { await client.query("ROLLBACK"); throw error } finally { client.release() }
  await pool.end()
  console.log(`MCQ media migration complete (${assets.rowCount} assets copied and verified).`)
}

migrate().catch((error) => { console.error("MCQ media migration failed.", error); process.exitCode = 1 })
