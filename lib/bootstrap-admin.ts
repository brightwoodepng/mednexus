type Queryable = {
  query: (sql: string, values?: unknown[]) => Promise<{ rowCount?: number | null; rows: Array<{ uid: string; index_number: string; role: string }> }>
}

export function normalizeBootstrapIndexNumber(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, "")
    .replace(/^sm(sms|gem)(\d{2})(\d{4})$/, "sm/$1/$2/$3")
}

/** Promotes an already-registered account and records the role change. */
export async function bootstrapAdmin(client: Queryable, indexNumber: string) {
  const account = await client.query(
    "SELECT uid, index_number, role FROM mednexus_registered_users WHERE index_number = $1 FOR UPDATE",
    [normalizeBootstrapIndexNumber(indexNumber)],
  )
  if (!account.rowCount) throw new Error("Bootstrap failed: no registered account matched that index number; no role was granted.")

  const target = account.rows[0]
  if (target.role !== "SUPER_ADMIN") {
    await client.query("UPDATE mednexus_registered_users SET role = 'SUPER_ADMIN' WHERE uid = $1", [target.uid])
    await client.query(
      `INSERT INTO mednexus_role_audit_log (actor_uid, target_uid, change_type, old_value, new_value)
       VALUES (NULL, $1, 'ROLE_BOOTSTRAP', $2, 'SUPER_ADMIN')`,
      [target.uid, target.role],
    )
  }
  return target
}
