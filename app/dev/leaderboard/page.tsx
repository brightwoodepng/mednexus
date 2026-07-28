import { notFound } from "next/navigation"
import { LeaderboardVisualPreview } from "@/components/leaderboard-screen"

export default function LeaderboardPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <LeaderboardVisualPreview />
}
