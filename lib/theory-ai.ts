import "server-only"

import type { Pool, PoolClient } from "pg"

export const THEORY_AI_CONSENT_VERSION = "2026-07-26"
export const THEORY_AI_DAILY_LIMIT = 50
export const THEORY_AI_MAX_AUDIO_BYTES = 8 * 1024 * 1024
export const THEORY_AI_MAX_AUDIO_SECONDS = 5 * 60

export type TheoryAiAction = "refinement" | "transcription"
export type TheoryAiAuditAction = "refine_note" | "transcribe_note" | "transcribe_answer"

const AUDIO_MIME_ALIASES: Record<string, string> = {
  "audio/webm": "audio/webm",
  "audio/ogg": "audio/ogg",
  "audio/mp4": "audio/mp4",
  "audio/m4a": "audio/mp4",
  "audio/x-m4a": "audio/mp4",
  "audio/wav": "audio/wav",
  "audio/x-wav": "audio/wav",
  "audio/mpeg": "audio/mpeg",
  "audio/mp3": "audio/mpeg",
}

function startsWith(bytes: Uint8Array, signature: number[], offset = 0) {
  return signature.every((value, index) => bytes[offset + index] === value)
}

export function normalizeAudioMime(value: string) {
  return AUDIO_MIME_ALIASES[value.toLowerCase().split(";")[0].trim()] ?? null
}

export function hasValidAudioSignature(bytes: Uint8Array, mimeType: string) {
  if (bytes.length < 12) return false
  if (mimeType === "audio/webm") return startsWith(bytes, [0x1a, 0x45, 0xdf, 0xa3])
  if (mimeType === "audio/ogg") return startsWith(bytes, [0x4f, 0x67, 0x67, 0x53])
  if (mimeType === "audio/wav") {
    return startsWith(bytes, [0x52, 0x49, 0x46, 0x46])
      && startsWith(bytes, [0x57, 0x41, 0x56, 0x45], 8)
  }
  if (mimeType === "audio/mp4") {
    return startsWith(bytes, [0x66, 0x74, 0x79, 0x70], 4)
  }
  if (mimeType === "audio/mpeg") {
    return startsWith(bytes, [0x49, 0x44, 0x33])
      || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  }
  return false
}

function readUint32Be(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, false)
}

function readUint32Le(bytes: Uint8Array, offset: number) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength).getUint32(offset, true)
}

function findSequence(bytes: Uint8Array, sequence: number[], from = 0) {
  for (let offset = from; offset <= bytes.length - sequence.length; offset += 1) {
    if (sequence.every((value, index) => bytes[offset + index] === value)) return offset
  }
  return -1
}

function readEbmlNumber(bytes: Uint8Array, offset: number) {
  const first = bytes[offset]
  if (first == null || first === 0) return null
  let length = 1
  let mask = 0x80
  while (length <= 8 && (first & mask) === 0) {
    length += 1
    mask >>= 1
  }
  if (length > 8 || offset + length > bytes.length) return null
  let value = first & (mask - 1)
  for (let index = 1; index < length; index += 1) value = value * 256 + bytes[offset + index]
  return { value, length }
}

/**
 * Reads duration from common recorder containers without decoding or storing
 * audio. Null means the container does not expose enough trustworthy metadata.
 */
export function detectAudioDurationSeconds(bytes: Uint8Array, mimeType: string): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  if (mimeType === "audio/wav" && bytes.length >= 44) {
    const byteRate = readUint32Le(bytes, 28)
    const dataOffset = findSequence(bytes, [0x64, 0x61, 0x74, 0x61], 12)
    if (byteRate > 0 && dataOffset >= 0 && dataOffset + 8 <= bytes.length) {
      return readUint32Le(bytes, dataOffset + 4) / byteRate
    }
  }
  if (mimeType === "audio/ogg") {
    let lastPage = -1
    let cursor = 0
    while (cursor < bytes.length) {
      const next = findSequence(bytes, [0x4f, 0x67, 0x67, 0x53], cursor)
      if (next < 0) break
      lastPage = next
      cursor = next + 4
    }
    if (lastPage >= 0 && lastPage + 14 <= bytes.length) {
      const low = view.getUint32(lastPage + 6, true)
      const high = view.getUint32(lastPage + 10, true)
      const granule = high * 2 ** 32 + low
      if (granule > 0 && Number.isSafeInteger(granule)) return granule / 48_000
    }
  }
  if (mimeType === "audio/mp4") {
    const mvhd = findSequence(bytes, [0x6d, 0x76, 0x68, 0x64])
    if (mvhd >= 0 && mvhd + 24 <= bytes.length) {
      const version = bytes[mvhd + 4]
      const base = mvhd + (version === 1 ? 24 : 16)
      if (base + (version === 1 ? 12 : 8) <= bytes.length) {
        const timescale = readUint32Be(bytes, base)
        const duration = version === 1
          ? readUint32Be(bytes, base + 4) * 2 ** 32 + readUint32Be(bytes, base + 8)
          : readUint32Be(bytes, base + 4)
        if (timescale > 0 && duration > 0) return duration / timescale
      }
    }
  }
  if (mimeType === "audio/webm") {
    const scaleId = findSequence(bytes, [0x2a, 0xd7, 0xb1])
    let timecodeScale = 1_000_000
    if (scaleId >= 0) {
      const size = readEbmlNumber(bytes, scaleId + 3)
      if (size && size.value > 0 && size.value <= 8 && scaleId + 3 + size.length + size.value <= bytes.length) {
        timecodeScale = 0
        const start = scaleId + 3 + size.length
        for (let index = 0; index < size.value; index += 1) timecodeScale = timecodeScale * 256 + bytes[start + index]
      }
    }
    const durationId = findSequence(bytes, [0x44, 0x89])
    if (durationId >= 0) {
      const size = readEbmlNumber(bytes, durationId + 2)
      if (size && (size.value === 4 || size.value === 8)) {
        const start = durationId + 2 + size.length
        if (start + size.value <= bytes.length) {
          const duration = size.value === 4 ? view.getFloat32(start, false) : view.getFloat64(start, false)
          if (Number.isFinite(duration) && duration > 0) return duration * timecodeScale / 1_000_000_000
        }
      }
    }
  }
  if (mimeType === "audio/mpeg") {
    const start = startsWith(bytes, [0x49, 0x44, 0x33]) && bytes.length >= 10
      ? 10 + ((bytes[6] & 0x7f) << 21) + ((bytes[7] & 0x7f) << 14) + ((bytes[8] & 0x7f) << 7) + (bytes[9] & 0x7f)
      : 0
    for (let offset = start; offset < Math.min(bytes.length - 4, start + 16_384); offset += 1) {
      if (bytes[offset] !== 0xff || (bytes[offset + 1] & 0xe0) !== 0xe0) continue
      const versionBits = (bytes[offset + 1] >> 3) & 0x03
      const layerBits = (bytes[offset + 1] >> 1) & 0x03
      const bitrateIndex = (bytes[offset + 2] >> 4) & 0x0f
      if (layerBits !== 1 || bitrateIndex === 0 || bitrateIndex === 15) continue
      const mpeg1Rates = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320]
      const mpeg2Rates = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160]
      const kbps = versionBits === 3 ? mpeg1Rates[bitrateIndex] : mpeg2Rates[bitrateIndex]
      if (kbps) return (bytes.length - start) * 8 / (kbps * 1000)
    }
  }
  return null
}

export function parseDeclaredDuration(value: FormDataEntryValue | null) {
  const duration = typeof value === "string" ? Number(value) : Number.NaN
  return Number.isFinite(duration) && duration > 0 && duration <= THEORY_AI_MAX_AUDIO_SECONDS
    ? Math.ceil(duration)
    : null
}

export async function hasCurrentTheoryAiConsent(client: Pool | PoolClient, userId: string) {
  const result = await client.query(
    "SELECT 1 FROM mednexus_theory_ai_consents WHERE user_id=$1 AND consent_version=$2",
    [userId, THEORY_AI_CONSENT_VERSION],
  )
  return result.rows.length > 0
}

export async function theoryAiRemaining(client: Pool | PoolClient, userId: string) {
  const result = await client.query(
    `SELECT refinement_count AS "refinementCount", transcription_count AS "transcriptionCount"
     FROM mednexus_theory_ai_rate_limits WHERE user_id=$1 AND usage_date=CURRENT_DATE`,
    [userId],
  )
  const row = result.rows[0] ?? { refinementCount: 0, transcriptionCount: 0 }
  return {
    refinements: Math.max(0, THEORY_AI_DAILY_LIMIT - Number(row.refinementCount)),
    transcriptions: Math.max(0, THEORY_AI_DAILY_LIMIT - Number(row.transcriptionCount)),
  }
}

export async function consumeTheoryAiQuota(client: PoolClient, userId: string, action: TheoryAiAction) {
  const column = action === "refinement" ? "refinement_count" : "transcription_count"
  const result = await client.query(
    `INSERT INTO mednexus_theory_ai_rate_limits
      (user_id, usage_date, ${column}, updated_at)
     VALUES ($1, CURRENT_DATE, 1, NOW())
     ON CONFLICT (user_id, usage_date) DO UPDATE
       SET ${column}=mednexus_theory_ai_rate_limits.${column}+1, updated_at=NOW()
       WHERE mednexus_theory_ai_rate_limits.${column} < $2
     RETURNING ${column} AS count`,
    [userId, THEORY_AI_DAILY_LIMIT],
  )
  return result.rows[0] ? THEORY_AI_DAILY_LIMIT - Number(result.rows[0].count) : null
}

export async function logTheoryAiAction(
  client: Pool | PoolClient,
  userId: string,
  action: TheoryAiAuditAction,
  outcome: string,
  durationMs: number,
  quotaUsed: number,
) {
  await client.query(
    `INSERT INTO mednexus_theory_ai_audit_log
      (user_id, action, outcome, duration_ms, quota_used)
     VALUES ($1,$2,$3,$4,$5)`,
    [userId, action, outcome.slice(0, 80), Math.max(0, Math.round(durationMs)), Math.max(0, quotaUsed)],
  )
}
