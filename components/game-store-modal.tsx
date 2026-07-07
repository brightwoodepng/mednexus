"use client"

import { useState } from "react"
import { useEconomy } from "@/contexts/economy-context"
import {
  STORE_ITEMS, VAULT_META, TITLE_LABELS,
  FRAME_RING_CLASSES, HIGHLIGHT_ROW_CLASSES,
  type StoreItem, type VaultMeta,
} from "@/lib/economy"

type StoreTab = "supply" | "vault" | "cosmetic"
type CosmeticSection = "title" | "frame" | "highlight" | "avatar"

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

function tierBadge(price: number) {
  if (price >= 5000) return { label: "Mythic",    cls: "bg-gradient-to-r from-fuchsia-500 to-purple-600 text-white" }
  if (price >= 1500) return { label: "Legendary", cls: "bg-gradient-to-r from-amber-400 to-orange-500 text-white" }
  return null
}

function CosmeticCard({
  item, owned, equipped, buying, equipping, didBuy, canAfford, onBuy, onEquip,
}: {
  item: StoreItem; owned: boolean; equipped: boolean
  buying: boolean; equipping: boolean; didBuy: boolean; canAfford: boolean
  onBuy: () => void; onEquip: () => void
}) {
  const frameClass   = item.cosmeticType === "frame"     ? FRAME_RING_CLASSES[item.id]    : ""
  const highlightCls = item.cosmeticType === "highlight" ? HIGHLIGHT_ROW_CLASSES[item.id] : ""
  const tier = tierBadge(item.price)

  return (
    <div className={`rounded-2xl border p-3 transition-all ${
      equipped ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${highlightCls || `bg-gradient-to-br ${item.gradient}`} ${frameClass} text-xl shadow-sm`}>
          {item.icon}
        </div>

        <div className="min-w-0 flex-1">
          {/* Row 1: name + tier badge */}
          <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
            {tier && (
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tier.cls}`}>
                {tier.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight mb-2">{item.desc}</p>

          {/* Row 2: price OR equipped badge + action button */}
          <div className="flex items-center justify-between gap-2">
            <div className="shrink-0">
              {equipped && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  ● Equipped
                </span>
              )}
              {!owned && !equipped && <PriceTag price={item.price} />}
            </div>
            {owned ? (
              <button
                type="button" disabled={equipping} onClick={onEquip}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
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
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                  didBuy    ? "bg-emerald-500 text-white" :
                  canAfford ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                              "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {buying ? "…" : didBuy ? "Bought!" : canAfford ? "Buy" : "Need NP"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function AvatarCard({
  item, owned, equipped, buying, equipping, didBuy, canAfford, onBuy, onEquip,
}: {
  item: StoreItem; owned: boolean; equipped: boolean
  buying: boolean; equipping: boolean; didBuy: boolean; canAfford: boolean
  onBuy: () => void; onEquip: () => void
}) {
  const tier = tierBadge(item.price)

  return (
    <div className={`rounded-2xl border p-3 transition-all ${
      equipped ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-3">
        {/* Avatar image preview — fixed 44×44, never grows */}
        <div className={`relative h-11 w-11 shrink-0 rounded-xl overflow-hidden bg-gradient-to-br ${item.gradient} shadow-sm`}>
          {item.imagePath && (
            <img
              src={item.imagePath}
              alt={item.name}
              className="h-full w-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
            />
          )}
          {!item.imagePath && (
            <span className="absolute inset-0 flex items-center justify-center text-xl">{item.icon}</span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          {/* Row 1: name + tier badge */}
          <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
            {tier && (
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide ${tier.cls}`}>
                {tier.label}
              </span>
            )}
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight mb-2">{item.desc}</p>

          {/* Row 2: price OR equipped badge + action button */}
          <div className="flex items-center justify-between gap-2">
            <div className="shrink-0">
              {equipped && (
                <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                  ● Equipped
                </span>
              )}
              {!owned && !equipped && <PriceTag price={item.price} />}
            </div>
            {owned ? (
              <button
                type="button" disabled={equipping} onClick={onEquip}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
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
                className={`shrink-0 rounded-full px-3 py-1.5 text-[11px] font-bold transition-all ${
                  didBuy    ? "bg-emerald-500 text-white" :
                  canAfford ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                              "bg-muted text-muted-foreground cursor-not-allowed"
                }`}
              >
                {buying ? "…" : didBuy ? "Bought!" : canAfford ? "Buy" : "Need NP"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── NexusStorePage — full-page standalone view ────────────────────────────────
export function NexusStorePage() {
  const { balance, inventory, purchase, equippedCosmetics, equipCosmetic } = useEconomy()
  const [tab, setTab]               = useState<StoreTab>("supply")
  const [cosSection, setCosSection] = useState<CosmeticSection>("title")
  const [buying, setBuying]         = useState<string | null>(null)
  const [equipping, setEquipping]   = useState<string | null>(null)
  const [flash, setFlash]           = useState<string | null>(null)
  const [error, setError]           = useState<string | null>(null)

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
    { id: "vault",    label: "🔐 The Vault", badge: `${ownedVaultCount}/${vaultItems.length}` },
    { id: "cosmetic", label: "✨ Cosmetics" },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-2xl flex flex-col flex-1">

        {/* ── Page header ── */}
        <div className="mb-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 text-2xl shadow-sm">
              🏪
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-foreground">Nexus Store</h1>
              <p className="text-sm text-muted-foreground">Spend your Nexus Points</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-2">
            <span className="text-base">🪙</span>
            <span className="text-base font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
              {balance.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70">NP</span>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-border gap-0.5 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex shrink-0 items-center gap-1.5 pb-3 px-4 text-sm font-semibold border-b-2 transition-all -mb-px ${
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
          <div className="mt-4 rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
            {error}
          </div>
        )}

        {/* ── Tab content ── */}
        <div className="py-5 flex-1">

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
              <div className="mb-4 flex gap-1 rounded-2xl bg-muted p-1 overflow-x-auto no-scrollbar">
                {(["title", "frame", "highlight", "avatar"] as CosmeticSection[]).map(s => (
                  <button
                    key={s} type="button" onClick={() => setCosSection(s)}
                    className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-all whitespace-nowrap ${
                      cosSection === s
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {s === "title" ? "🏷️ Titles" : s === "frame" ? "🖼️ Frames" : s === "highlight" ? "🌟 Highlights" : "🧑‍⚕️ Avatars"}
                  </button>
                ))}
              </div>

              <div className="grid gap-3">
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {cosSection === "title"     && "Displayed as a badge next to your name during multiplayer leaderboard reveals."}
                  {cosSection === "frame"     && "Animated ring shown around your player avatar badge during multiplayer pauses."}
                  {cosSection === "highlight" && "Your row glows on the leaderboard when scores are revealed to everyone."}
                  {cosSection === "avatar"    && "Your personal avatar displayed in multiplayer lobbies and leaderboards."}
                </p>

                {cosItems.map(item => {
                  const owned    = (inventory[item.id] ?? 0) >= 1
                  const equipped = equippedCosmetics[cosSection] === item.id
                  if (item.cosmeticType === "avatar") {
                    return (
                      <AvatarCard
                        key={item.id}
                        item={item}
                        owned={owned}
                        equipped={equipped}
                        buying={buying === item.id}
                        equipping={equipping === item.id}
                        didBuy={flash === item.id}
                        canAfford={balance >= item.price}
                        onBuy={() => handleBuy(item.id)}
                        onEquip={() => handleEquip("avatar", item.id)}
                      />
                    )
                  }
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
