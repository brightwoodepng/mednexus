type Queryable = { query: (text: string, values?: unknown[]) => Promise<{ rowCount: number | null }> }

export type PersonalNotification = {
  id: string
  userId: string
  type: string
  message: string
  actionUrl?: string | null
  actionLabel?: string | null
}

/** Transaction-friendly and retry-safe. A stable id makes every event idempotent. */
export async function notifyUser(db: Queryable, notification: PersonalNotification) {
  if (!notification.userId || notification.userId.startsWith("guest")) return false
  const result = await db.query(
    `INSERT INTO mednexus_user_notifications (id,user_id,type,message,action_url,action_label)
     VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (id) DO NOTHING`,
    [notification.id, notification.userId, notification.type, notification.message, notification.actionUrl ?? null, notification.actionLabel ?? null],
  )
  return Boolean(result.rowCount)
}

export async function notifyRoomMembers(db: Queryable, roomId: string, eventId: string, message: string, actionUrl: string) {
  await db.query(
    `INSERT INTO mednexus_user_notifications (id,user_id,type,message,action_url,action_label)
     SELECT $2||'-'||m.user_id,m.user_id,'group_study',$3,$4,'Open room'
       FROM mednexus_group_study_memberships m
      WHERE m.room_id=$1 AND NOT m.is_guest
     ON CONFLICT (id) DO NOTHING`,
    [roomId, eventId, message, actionUrl],
  )
}
