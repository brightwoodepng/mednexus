import { redirect } from "next/navigation"
import { getVerifiedAdminFromCookie } from "@/lib/admin-access"
import { BroadcastScreen } from "@/components/broadcast-screen"

export default async function NotificationsPage() {
  if (!await getVerifiedAdminFromCookie("manage_broadcasts")) redirect("/admin")
  return <BroadcastScreen />
}
