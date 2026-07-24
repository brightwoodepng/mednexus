/**
 * Presentation-only gate for the learner account menu. Authorization remains
 * server-side in `lib/admin-access.ts`; this prevents stale local profile data
 * from advertising a console that the current verified session cannot open.
 */
export type AdminConsoleMenuUser = {
  role: "guest" | "user"
  status?: string
  canAccessAdmin?: boolean
  sessionVerified?: boolean
}

export function canShowAdminConsoleLink(user: AdminConsoleMenuUser | null | undefined) {
  return user?.role === "user"
    && user.status === "approved"
    && user.sessionVerified === true
    && user.canAccessAdmin === true
}
