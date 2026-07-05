"use client"

import { useState } from "react"
import { useEconomy } from "@/contexts/economy-context"
import {
  STORE_ITEMS, VAULT_META, TITLE_LABELS,
  FRAME_RING_CLASSES, HIGHLIGHT_ROW_CLASSES,
  type StoreItem, type VaultMeta,
} from "@/lib/economy"

type StoreTab = "supply" | "vault" | "cosmetic"
type CosmeticSection = "title" | "frame" | "highlight"

// ── Small shared atoms ────────────────────────────────────────────────────────

function PriceTag({ price }: { price: number }) {
  return (
    <div className="flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2 py-0.5 shrink-0">
      <span className="text-[10px]">🪙</span>
      <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{price.toLocaleString()}</span>
    </div>
  )
}

function DifficultyBadge({ difficulty }: { difficulty: VaultMeta["difficulty"] }) {
  const cls =
    difficulty === "Intermediate" ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400" :
    difficulty === "Advanced"     ? "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400" :
                                    "bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400"
  return (
    <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${cls}`}>
      {difficulty}
    </span>
  )
}

// ── Item cards ────────────────────────────────────────────────────────────────

function ConsumableCard({
  item, owned, buying, didBuy, canAfford, onBuy,
}: {
  item: StoreItem; owned: number; buying: boolean; didBuy: boolean; canAfford: boolean; onBuy: () => void
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-start gap-3">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-2xl shadow-sm`}>
          {item.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
            <PriceTag price={item.price} />
          </div>
          <p className="text-xs text-muted-foreground mb-2.5">{item.desc}</p>
          <div className="flex items-center justify-between">
            {owned > 0 && (
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">You have: {owned}×</span>
            )}
            <button
              type="button" disabled={buying || !canAfford} onClick={onBuy}
              className={`ml-auto rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${
                didBuy        ? "bg-emerald-500 text-white" :
                canAfford     ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                                "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {buying ? "…" : didBuy ? "Purchased!" : canAfford ? "Buy" : "Need more NP"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function VaultCard({
  item, unlocked, buying, didBuy, canAfford, onBuy,
}: {
  item: StoreItem; unlocked: boolean; buying: boolean; didBuy: boolean; canAfford: boolean; onBuy: () => void
}) {
  const meta = VAULT_META[item.id]
  return (
    <div className={`relative overflow-hidden rounded-2xl border p-4 transition-all ${
      unlocked
        ? "border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10"
        : "border-border bg-card hover:border-primary/30"
    }`}>
      {/* colour bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.gradient} ${unlocked ? "opacity-50" : ""}`} />

      <div className="flex items-start gap-3 mt-0.5">
        <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-2xl shadow-sm ${!unlocked ? "opacity-70" : ""}`}>
          {unlocked ? item.icon : "🔒"}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">{item.name}</p>
              {meta && (
                <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                  <DifficultyBadge difficulty={meta.difficulty} />
                  <span className="text-[10px] text-muted-foreground">{meta.discipline}</span>
                  <span className="text-[10px] text-muted-foreground">· {meta.steps} steps</span>
                </div>
              )}
            </div>
            {!unlocked && <PriceTag price={item.price} />}
          </div>

          {meta && !unlocked && (
            <p className="text-[11px] italic text-muted-foreground/70 mb-2 truncate">
              &ldquo;{meta.preview}&rdquo;
            </p>
          )}
          <p className="text-xs text-muted-foreground mb-2.5">{item.desc}</p>

          {unlocked ? (
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                ✓ Unlocked
              </span>
              <span className="text-[11px] text-muted-foreground">Ready to play in your profile</span>
            </div>
          ) : (
            <button
              type="button" disabled={buying || !canAfford} onClick={onBuy}
              className={`rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${
                didBuy    ? "bg-emerald-500 text-white" :
                canAfford ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                            "bg-muted text-muted-foreground cursor-not-allowed"
              }`}
            >
              {buying ? "…" : didBuy ? "Unlocked!" : canAfford ? "🔓 Unlock" : "Need more NP"}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function CosmeticCard({
  item, owned, equipped, buying, equipping, didBuy, canAfford, onBuy, onEquip,
}: {
  item: StoreItem; owned: boolean; equipped: boolean
  buying: boolean; equipping: boolean; didBuy: boolean; canAfford: boolean
  onBuy: () => void; onEquip: () => void
}) {
  // Show a live preview swatch for frames and highlights
  const frameClass   = item.cosmeticType === "frame"     ? FRAME_RING_CLASSES[item.id]   : ""
  const highlightCls = item.cosmeticType === "highlight"  ? HIGHLIGHT_ROW_CLASSES[item.id] : ""

  return (
    <div className={`rounded-2xl border p-4 transition-all ${
      equipped ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-border bg-card"
    }`}>
      <div className="flex items-start gap-3">
        {/* Avatar preview — shows the frame/highlight effect */}
        <div className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${highlightCls || `bg-gradient-to-br ${item.gradient}`} ${frameClass} text-2xl shadow-sm`}>
          {item.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 mb-0.5">
            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
            {equipped && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary shrink-0">
                ● Equipped
              </span>
            )}
            {!owned && <PriceTag price={item.price} />}
          </div>
          <p className="text-xs text-muted-foreground mb-2.5">{item.desc}</p>

          <div className="flex items-center justify-end gap-2">
            {owned ? (
              <button
                type="button" disabled={equipping} onClick={onEquip}
                className={`rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${
                  equipped
                    ? "bg-muted text-muted-foreground hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400"
                    : `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90`
                }`}
              >
                {equipping ? "…" : equipped ? "Unequip" : "Equip"}
              </button>
            ) : (
              <button
                type="button" disabled={buying || !canAfford} onClick={onBuy}
                className={`rounded-full px-4 py-1.5 text-[11px] font-bold transition-all ${
                  didBuy    ? "bg-emerald-500 text-white" :
                  canAfford ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                              "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {buying ? "…" : didBuy ? "Purchased!" : canAfford ? "Buy" : "Need more NP"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── GameStoreModal ────────────────────────────────────────────────────────────
export function GameStoreModal({ onClose }: { onClose: () => void }) {
  const { balance, inventory, purchase, equippedCosmetics, equipCosmetic } = useEconomy()
  const [tab, setTab]             = useState<StoreTab>("supply")
  const [cosSection, setCosSection] = useState<CosmeticSection>("title")
  const [buying, setBuying]       = useState<string | null>(null)
  const [equipping, setEquipping] = useState<string | null>(null)
  const [flash, setFlash]         = useState<string | null>(null)
  const [error, setError]         = useState<string | null>(null)

  async function handleBuy(itemId: string) {
    setError(null)
    setBuying(itemId)
    const result = await purchase(itemId)
    setBuying(null)
    if (result.ok) {
      setFlash(itemId)
      setTimeout(() => setFlash(null), 2500)
    } else {
      setError(result.error ?? "Purchase failed")
      setTimeout(() => setError(null), 4000)
    }
  }

  async function handleEquip(type: CosmeticSection, itemId: string) {
    const isEquipped = equippedCosmetics[type] === itemId
    setEquipping(itemId)
    await equipCosmetic(type, isEquipped ? null : itemId)
    setEquipping(null)
  }

  const supplyItems = STORE_ITEMS.filter(i => i.category === "lifeline")
  const vaultItems  = STORE_ITEMS.filter(i => i.category === "vault")
  const cosItems    = STORE_ITEMS.filter(i => i.category === "cosmetic" && i.cosmeticType === cosSection)

  const ownedVaultCount = vaultItems.filter(i => (inventory[i.id] ?? 0) >= 1).length

  const TABS: { id: StoreTab; label: string; badge?: string }[] = [
    { id: "supply",   label: "⚗️ Supply Closet" },
    { id: "vault",    label: "🔐 The Vault",  badge: `${ownedVaultCount}/${vaultItems.length}` },
    { id: "cosmetic", label: "✨ Cosmetics" },
  ]

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="w-full max-w-lg rounded-3xl border border-border bg-background shadow-2xl overflow-hidden">

        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-xl shadow-sm">
              🏪
            </div>
            <div>
              <h2 className="font-extrabold text-foreground">Nexus Store</h2>
              <p className="text-[11px] text-muted-foreground">Spend your Nexus Points</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-3 py-1.5">
              <span className="text-sm">🪙</span>
              <span className="text-sm font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
                {balance.toLocaleString()}
              </span>
              <span className="text-[10px] font-bold text-amber-600/70 dark:text-amber-400/70">NP</span>
            </div>
            <button
              type="button" onClick={onClose}
              className="rounded-full p-1.5 text-muted-foreground transition-colors hover:text-foreground hover:bg-muted"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" width={18} height={18}>
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-border px-5 pt-3 pb-0 gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 pb-2.5 px-3 text-sm font-semibold border-b-2 transition-all -mb-px ${
                tab === t.id
                  ? "border-primary text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              {t.badge && (
                <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === t.id ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                }`}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── Error banner ── */}
        {error && (
          <div className="mx-4 mt-3 rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* ── Tab content ── */}
        <div className="max-h-[62vh] overflow-y-auto p-4">

          {/* Supply Closet */}
          {tab === "supply" && (
            <div className="grid gap-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Consumable lifelines you can activate during a quiz. Stacks up in your inventory — use them when you need an edge.
              </p>
              {supplyItems.map(item => (
                <ConsumableCard
                  key={item.id}
                  item={item}
                  owned={inventory[item.id] ?? 0}
                  buying={buying === item.id}
                  didBuy={flash === item.id}
                  canAfford={balance >= item.price}
                  onBuy={() => handleBuy(item.id)}
                />
              ))}
            </div>
          )}

          {/* The Vault */}
          {tab === "vault" && (
            <div className="grid gap-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Complex multi-step clinical simulations. Unlock permanently with Nexus Points — available in your profile forever.
              </p>
              {vaultItems.map(item => (
                <VaultCard
                  key={item.id}
                  item={item}
                  unlocked={(inventory[item.id] ?? 0) >= 1}
                  buying={buying === item.id}
                  didBuy={flash === item.id}
                  canAfford={balance >= item.price}
                  onBuy={() => handleBuy(item.id)}
                />
              ))}
            </div>
          )}

          {/* Cosmetics */}
          {tab === "cosmetic" && (
            <div>
              {/* Sub-section pill tabs */}
              <div className="mb-4 flex gap-1 rounded-2xl bg-muted p-1">
                {(["title", "frame", "highlight"] as CosmeticSection[]).map(s => (
                  <button
                    key={s} type="button" onClick={() => setCosSection(s)}
                    className={`flex-1 rounded-xl py-2 text-xs font-semibold transition-all ${
                      cosSection === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "title" ? "🏷️ Titles" : s === "frame" ? "🖼️ Frames" : "🌟 Highlights"}
                  </button>
                ))}
              </div>

              <div className="grid gap-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {cosSection === "title"     && "Displayed as a badge next to your name during multiplayer leaderboard reveals."}
                  {cosSection === "frame"     && "Animated ring shown around your player avatar badge during multiplayer pauses."}
                  {cosSection === "highlight" && "Your row glows on the leaderboard when scores are revealed to everyone."}
                </p>

                {cosItems.map(item => {
                  const owned    = (inventory[item.id] ?? 0) >= 1
                  const equipped = equippedCosmetics[cosSection] === item.id
                  return (
                    <CosmeticCard
                      key={item.id}
                      item={item}
                      owned={owned}
                      equipped={equipped}
                      buying={buying === item.id}
                      equipping={equipping === item.id}
                      didBuy={flash === item.id}
                      canAfford={balance >= item.price}
                      onBuy={() => handleBuy(item.id)}
                      onEquip={() => item.cosmeticType && handleEquip(item.cosmeticType as CosmeticSection, item.id)}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
