import crypto from "crypto"

// Fall back to SESSION_SECRET so admin auth works on Replit without a separate ADMIN_SECRET
const SECRET = process.env.ADMIN_SECRET || process.env.SESSION_SECRET

/** Create a signed token valid for 24 h. */
export function createAdminToken(password: string): string {
  if (!SECRET) throw new Error("ADMIN_SECRET (or SESSION_SECRET) is not set")
  const exp = Math.floor(Date.now() / 1000) + 86400
  const sig = crypto
    .createHmac("sha256", SECRET)
    .update(`${password}:${exp}`)
    .digest("hex")
  return Buffer.from(JSON.stringify({ exp, sig })).toString("base64url")
}

/** Verify a token. Returns true if valid and not expired. */
export function verifyAdminToken(token: string): boolean {
  try {
    if (!SECRET) return false
    const { exp, sig } = JSON.parse(Buffer.from(token, "base64url").toString())
    if (!exp || !sig) return false
    if (exp < Math.floor(Date.now() / 1000)) return false
    const password = process.env.ADMIN_PASSWORD
    if (!password) return false
    const expected = crypto
      .createHmac("sha256", SECRET)
      .update(`${password}:${exp}`)
      .digest("hex")
    return crypto.timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"))
  } catch {
    return false
  }
}
