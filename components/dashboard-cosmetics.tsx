"use client"

import { useEffect, useRef, useState } from "react"
import { ShoppingBag } from "lucide-react"
import { useEconomy } from "@/contexts/economy-context"
import { economyDate, type StoreItem } from "@/lib/economy"
import { getDailyCosmetics } from "@/lib/daily-cosmetics"
import { InteractiveCosmeticVisual } from "@/components/game-store-modal"

export function DashboardCosmetics({ onOpenStore }: { onOpenStore: () => void }) {
  const { balance, inventory, equippedCosmetics, purchase, equipCosmetic, loading } = useEconomy()
  const [date, setDate] = useState(economyDate)
  const [busy, setBusy] = useState<string | null>(null)
  const busyRef = useRef(false)
  const [message, setMessage] = useState("")
  const [online, setOnline] = useState(true)
  useEffect(() => {
    const update = () => { setDate(economyDate()); setOnline(navigator.onLine) }
    update()
    const timer = setInterval(update, 60_000)
    window.addEventListener("online", update); window.addEventListener("offline", update)
    document.addEventListener("visibilitychange", update)
    return () => { clearInterval(timer); window.removeEventListener("online", update); window.removeEventListener("offline", update); document.removeEventListener("visibilitychange", update) }
  }, [])
  async function buyAndEquip(item: StoreItem) {
    if (busyRef.current || !item.cosmeticType) return
    busyRef.current = true; setBusy(item.id); setMessage("")
    let bought = false
    try {
      if (!(inventory[item.id] > 0)) {
        const result = await purchase(item.id)
        if (!result.ok) { setMessage(result.error ?? "Could not purchase this item."); return }
        bought = true
      }
      const result = await equipCosmetic(item.cosmeticType, item.id)
      setMessage(result.ok ? `${item.name} equipped.` : bought ? `${item.name} purchased. ${result.error ?? "Tap Equip to try equipping again."}` : result.error ?? "Could not equip this item.")
    } catch { setMessage("Connection interrupted. Check your items before trying again.") }
    finally { busyRef.current = false; setBusy(null) }
  }
  return <section aria-labelledby="daily-cosmetics-heading" className="mt-6 rounded-2xl border border-border bg-card p-3 sm:p-4">
    <header className="mb-3 flex items-center justify-between gap-3"><div><h2 id="daily-cosmetics-heading" className="flex items-center gap-2 text-base font-bold"><ShoppingBag size={17}/>Today's cosmetics</h2><p className="mt-0.5 text-xs text-muted-foreground">New picks daily · {balance.toLocaleString()} NP</p></div><button type="button" onClick={onOpenStore} className="min-h-10 shrink-0 rounded-lg px-2 text-xs font-semibold text-primary hover:bg-primary/10">Shop all →</button></header>
    <div className="grid grid-cols-3 gap-2 sm:gap-3">{getDailyCosmetics(date).map(item => {
      const owned = inventory[item.id] > 0, equipped = equippedCosmetics[item.cosmeticType!] === item.id
      return <article key={item.id} className="flex min-w-0 flex-col rounded-xl border border-border bg-background p-2 sm:p-3">
        <div className="flex h-20 items-center justify-center overflow-hidden rounded-lg"><InteractiveCosmeticVisual item={item}/></div>
        <h3 className="mt-2 flex-1 break-words text-[11px] font-bold leading-snug sm:text-sm">{item.name}</h3>
        <p className="my-1 text-[10px] capitalize text-muted-foreground">{item.cosmeticType} · {owned ? "Owned" : `${item.price.toLocaleString()} NP`}</p>
        <button type="button" disabled={loading || busy !== null || equipped || !online || (!owned && balance < item.price)} onClick={() => void buyAndEquip(item)} className="mt-1 min-h-11 rounded-lg bg-primary px-1 text-[10px] font-bold text-primary-foreground hover:bg-primary/90 disabled:bg-muted disabled:text-muted-foreground sm:text-xs">{busy === item.id ? "Saving…" : equipped ? "Equipped" : !online ? "Offline" : owned ? "Equip" : balance < item.price ? "Need more NP" : "Buy & equip"}</button>
      </article>
    })}</div>
    {message && <p role="status" className="mt-3 text-xs font-semibold">{message}</p>}
  </section>
}
