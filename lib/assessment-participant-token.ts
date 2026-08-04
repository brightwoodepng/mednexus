import "server-only"

import crypto from "crypto"

export type AssessmentParticipant = {
  participantId: string
  assessmentId: string
  name: string
  exp: number
  type: "assessment-participant"
}

function secret() {
  const configured = process.env.SESSION_SECRET
  if (configured) return configured
  if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET is required for assessment participant links")
  return "mednexus-assessment-participant-dev-secret"
}

export function createAssessmentParticipantToken(input: Omit<AssessmentParticipant, "exp" | "type">, ttlHours = 24 * 7) {
  const payload: AssessmentParticipant = { ...input, type: "assessment-participant", exp: Math.floor(Date.now() / 1000) + ttlHours * 3600 }
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url")
  const signature = crypto.createHmac("sha256", secret()).update(`assessment:${data}`).digest("base64url")
  return `${data}.${signature}`
}

export function verifyAssessmentParticipantToken(token: string): AssessmentParticipant | null {
  try {
    const separator = token.lastIndexOf(".")
    if (separator < 1) return null
    const data = token.slice(0, separator)
    const supplied = Buffer.from(token.slice(separator + 1))
    const expected = Buffer.from(crypto.createHmac("sha256", secret()).update(`assessment:${data}`).digest("base64url"))
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as AssessmentParticipant
    if (payload.type !== "assessment-participant" || !payload.participantId || !payload.assessmentId || !payload.name.trim() || payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch { return null }
}
