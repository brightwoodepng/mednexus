import crypto from "crypto"

const SECRET = process.env.ADMIN_SECRET ?? "mednexus-tok-9x2km4p7wq"

/** Create a signed token valid for 24 h. */
export function createAdminToken(password: string): string {
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
