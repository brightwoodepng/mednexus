import { redirect } from "next/navigation"

/** Legacy URL retained for existing bookmarks. */
export default function BroadcastsPage() {
  redirect("/admin/notifications")
}
