export const PLAIN_TEXT_IMPORT_CHAR_LIMIT = 200_000

const PLAIN_TEXT_IMPORT_BYTE_LIMIT = PLAIN_TEXT_IMPORT_CHAR_LIMIT * 4
const ALLOWED_CONTROL_CHARACTERS = new Set([9, 10, 13])

export type PlainTextImportFileType = "txt" | "md"

export function plainTextImportFileType(fileName: string): PlainTextImportFileType | null {
  const normalized = fileName.trim().toLowerCase()
  if (normalized.endsWith(".txt")) return "txt"
  if (normalized.endsWith(".md")) return "md"
  return null
}

function looksBinary(text: string) {
  if (text.includes("\0")) return true
  const sample = text.slice(0, 8_192)
  if (!sample) return false
  let controls = 0
  for (const character of sample) {
    const code = character.charCodeAt(0)
    if ((code < 32 && !ALLOWED_CONTROL_CHARACTERS.has(code)) || code === 127) controls++
  }
  return controls / sample.length > 0.01
}

export async function readPlainTextImportFile(file: File): Promise<string> {
  if (file.size <= 0) throw new Error("The selected text file is empty.")
  if (file.size > PLAIN_TEXT_IMPORT_BYTE_LIMIT) {
    throw new Error(`Text imports are limited to ${PLAIN_TEXT_IMPORT_CHAR_LIMIT.toLocaleString("en-US")} characters.`)
  }

  let text: string
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(await file.arrayBuffer())
  } catch {
    throw new Error("The selected file is not valid UTF-8 text.")
  }

  text = text.replace(/^\uFEFF/, "")
  if (!text.trim()) throw new Error("The selected text file is empty.")
  if (looksBinary(text)) throw new Error("The selected file appears to contain binary data, not plain text.")
  if (text.length > PLAIN_TEXT_IMPORT_CHAR_LIMIT) {
    throw new Error(`Text imports are limited to ${PLAIN_TEXT_IMPORT_CHAR_LIMIT.toLocaleString("en-US")} characters; this file contains ${text.length.toLocaleString("en-US")}.`)
  }
  return text
}
