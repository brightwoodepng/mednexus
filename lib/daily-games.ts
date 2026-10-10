import { economyDate } from "@/lib/economy"
export type FeaturedGameId = "rapid" | "timeatk" | "streak" | "double"
const games: readonly FeaturedGameId[] = ["rapid", "timeatk", "streak", "double"]

/** Three daily picks, using the same day boundary as the cosmetic shop. */
export function getDailyGames(date = economyDate()): FeaturedGameId[] {
  const parsed = Date.parse(`${date}T00:00:00Z`)
  const day = Number.isFinite(parsed) ? Math.floor(parsed / 86_400_000) : 0
  return Array.from({ length: 3 }, (_, index) => games[((day % games.length + games.length) % games.length + index) % games.length])
}
