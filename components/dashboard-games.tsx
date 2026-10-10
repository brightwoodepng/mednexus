"use client"

import { useEffect, useState } from "react"
import { Gamepad2 } from "lucide-react"
import { GameLauncherTile } from "@/components/game-launcher-tile"
import { GAME_PRESENTATION } from "@/lib/game-presentation"
import { economyDate } from "@/lib/economy"
import { getDailyGames, type FeaturedGameId } from "@/lib/daily-games"

export function DashboardGames({ onSelect, onOpenGames }: {
  onSelect: (mode: FeaturedGameId) => void; onOpenGames: () => void
}) {
  const [date, setDate] = useState(economyDate)
  useEffect(() => {
    const update = () => setDate(economyDate())
    const timer = window.setInterval(update, 60_000)
    document.addEventListener("visibilitychange", update)
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", update) }
  }, [])
  return <section aria-labelledby="daily-games-heading" className="mt-6 rounded-2xl border border-border bg-card p-3 sm:p-4">
    <header className="mb-2 flex items-center justify-between gap-3">
      <div><h2 id="daily-games-heading" className="flex items-center gap-2 text-base font-bold"><Gamepad2 size={17} aria-hidden/>Today's games</h2><p className="mt-0.5 text-xs text-muted-foreground">New picks daily</p></div>
      <button type="button" onClick={onOpenGames} className="min-h-10 shrink-0 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10">All games →</button>
    </header>
    <div className="grid grid-cols-3 gap-2 sm:gap-3">
      {getDailyGames(date).map(id => <GameLauncherTile key={id} id={id} name={GAME_PRESENTATION[id].title} onSelect={() => onSelect(id)} />)}
    </div>
  </section>
}
