"use client"

import { useState } from "react"
import { useEconomy } from "@/contexts/economy-context"
import {
  STORE_ITEMS, VAULT_META, TITLE_LABELS, SOLO_SUPPLY_MODE_LABELS,
  FRAME_RING_CLASSES, HIGHLIGHT_ROW_CLASSES,
  type CosmeticRarity, type StoreItem, type VaultMeta,
} from "@/lib/economy"
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import type { Screen } from "@/lib/view"

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

const RARITY_PRESENTATION: Record<CosmeticRarity, { label: string; symbol: string; cls: string }> = {
  common: { label: "Common", symbol: "●", cls: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200" },
  rare: { label: "Rare", symbol: "◆", cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300" },
  epic: { label: "Epic", symbol: "✦", cls: "bg-violet-100 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300" },
  legendary: { label: "Legendary", symbol: "♛", cls: "bg-amber-100 text-amber-800 ring-1 ring-inset ring-amber-400 dark:bg-amber-950/50 dark:text-amber-200" },
  mythic: { label: "Mythic", symbol: "✺", cls: "bg-fuchsia-100 text-fuchsia-800 ring-2 ring-inset ring-fuchsia-400 dark:bg-fuchsia-950/50 dark:text-fuchsia-200" },
}

function RarityBadge({ rarity }: { rarity?: CosmeticRarity }) {
  if (!rarity) return null
  const presentation = RARITY_PRESENTATION[rarity]
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide ${presentation.cls}`}>
      <span aria-hidden="true">{presentation.symbol}</span>{presentation.label}
    </span>
  )
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

  return (
    <div className={`rounded-2xl border p-3 transition-all ${
      equipped ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-3">
        <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${highlightCls || `bg-gradient-to-br ${item.gradient}`} ${frameClass} text-xl shadow-sm`}>
          {item.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
            <RarityBadge rarity={item.rarity} />
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight mb-2">{item.desc}</p>

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

  return (
    <div className={`rounded-2xl border p-3 transition-all ${
      equipped ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-border bg-card"
    }`}>
      <div className="flex items-center gap-3">
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
          <div className="flex items-center gap-1.5 min-w-0 mb-0.5">
            <p className="text-sm font-bold text-foreground truncate">{item.name}</p>
            <RarityBadge rarity={item.rarity} />
          </div>
          <p className="text-[11px] text-muted-foreground leading-tight mb-2">{item.desc}</p>

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

// ── Shared sub-page shell ─────────────────────────────────────────────────────

function SubPageShell({
  title, emoji, onBack, balance, children,
}: {
  title: string
  emoji: string
  onBack: () => void
  balance: number
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-6xl flex flex-col flex-1">

        {/* Header */}
        <div className="mb-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={onBack}
              className="flex shrink-0 items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
            >
              <ChevronLeftIcon size={15} />
              Back to Store
            </button>
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="text-2xl">{emoji}</span>
              <h1 className="truncate text-xl font-extrabold tracking-tight text-foreground">{title}</h1>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 px-4 py-2">
            <span className="text-base">🪙</span>
            <span className="text-base font-extrabold tabular-nums text-amber-700 dark:text-amber-300">
              {balance.toLocaleString()}
            </span>
            <span className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70">NP Balance</span>
          </div>
        </div>

        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  )
}

// ── Supply Closet — vertical grid card ────────────────────────────────────────

function SupplyGridCard({
  item, owned, balance, buying, didBuy, selectedBundleId, onSelectBundle, onBuy,
}: {
  item: StoreItem; owned: number; balance: number; buying: boolean; didBuy: boolean; selectedBundleId: string
  onSelectBundle: (bundleId: string) => void; onBuy: () => void
}) {
  const options = item.purchaseOptions ?? [{ id: "single", quantity: 1, price: item.price }]
  const selected = options.find(option => option.id === selectedBundleId) ?? options[0]
  const maxInventory = item.maxInventory ?? item.supply?.stackLimit ?? 0
  const exceedsCap = owned + selected.quantity > maxInventory
  const canAfford = balance >= selected.price
  return (
    <div className="flex flex-col items-center text-center p-6 h-full rounded-2xl border border-border bg-card transition-all hover:shadow-md">

      {/* Icon */}
      <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-3xl shadow-md mb-4`}>
        {item.icon}
      </div>

      {/* Name */}
      <h3 className="text-sm font-bold text-foreground leading-snug">{item.name}</h3>

      {/* Description — single short sentence */}
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.desc}</p>

      {item.supply && (
        <div className="mt-3 w-full" aria-label={`Works in ${item.supply.supportedModes.map(mode => SOLO_SUPPLY_MODE_LABELS[mode]).join(", ")}`}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Works in</p>
          <div className="flex flex-wrap justify-center gap-1">
            {item.supply.supportedModes.map(mode => (
              <span key={mode} className="rounded-full bg-cyan-50 px-2 py-0.5 text-[10px] font-semibold text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-950/30 dark:text-cyan-300 dark:ring-cyan-800/60">
                {SOLO_SUPPLY_MODE_LABELS[mode]}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 grid w-full grid-cols-2 gap-2" aria-label={`Purchase quantity for ${item.name}`}>
        {options.map(option => (
          <button key={option.id} type="button" onClick={() => onSelectBundle(option.id)} disabled={buying || owned + option.quantity > maxInventory}
            aria-pressed={selected.id === option.id}
            className={`min-h-11 rounded-xl border px-2 py-1.5 text-xs font-bold transition-colors ${selected.id === option.id ? "border-cyan-500 bg-cyan-50 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-200" : "border-border bg-background text-muted-foreground"} disabled:cursor-not-allowed disabled:opacity-40`}>
            {option.quantity} unit{option.quantity === 1 ? "" : "s"}
            <span className="block text-[10px] font-semibold">{option.price.toLocaleString()} NP</span>
          </button>
        ))}
      </div>

      <div className="my-3 flex w-full items-center justify-between text-[11px] font-semibold">
        <span className="text-emerald-600 dark:text-emerald-400">Owned {owned}/{maxInventory}</span>
        <span className="text-amber-700 dark:text-amber-300">Total {selected.price.toLocaleString()} NP</span>
      </div>

      {/* Buy button — anchored to bottom */}
      <button
        type="button"
        disabled={buying || exceedsCap || canAfford === false}
        onClick={onBuy}
        className={`mt-auto w-full rounded-full py-2.5 text-xs font-bold transition-all ${
          didBuy        ? "bg-emerald-500 text-white" :
          !exceedsCap && canAfford !== false ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                          "bg-muted text-muted-foreground cursor-not-allowed"
        }`}
      >
        {buying ? "…" : didBuy ? "Purchased!" : exceedsCap ? "Inventory cap" : canAfford === false ? "Need NP" : `Buy ${selected.quantity}`}
      </button>
    </div>
  )
}

// ── Cosmetics — vertical grid card ───────────────────────────────────────────

function CosmeticGridCard({
  item, owned, equipped, buying, equipping, didBuy, canAfford, onBuy, onEquip,
}: {
  item: StoreItem; owned: boolean; equipped: boolean
  buying: boolean; equipping: boolean; didBuy: boolean; canAfford: boolean
  onBuy: () => void; onEquip: () => void
}) {
  const frameClass   = item.cosmeticType === "frame"     ? (FRAME_RING_CLASSES[item.id]    ?? "") : ""
  const highlightCls = item.cosmeticType === "highlight" ? (HIGHLIGHT_ROW_CLASSES[item.id] ?? "") : ""
  const prestigeClass = item.rarity === "mythic"
    ? "ring-2 ring-fuchsia-400/70 border-double border-4"
    : item.rarity === "legendary"
      ? "ring-1 ring-amber-400/70 border-dashed"
      : ""

  return (
    <div data-preview-theme={item.previewTheme} className={`relative flex flex-col items-center text-center p-6 h-full rounded-2xl border transition-all hover:shadow-md ${prestigeClass} ${
      equipped ? "border-primary/40 bg-primary/5 dark:bg-primary/10" : "border-border bg-card"
    }`}>

      {/* Equipped badge */}
      {equipped && (
        <span className="mb-3 self-center rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
          ● Equipped
        </span>
      )}

      {/* Visual preview */}
      <div className="mb-4 flex items-center justify-center">
        {item.cosmeticType === "avatar" ? (
          <div className={`relative h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br ${item.gradient} shadow-md`}>
            {item.imagePath ? (
              <img
                src={item.imagePath} alt={item.name}
                className="h-full w-full object-cover"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
              />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-3xl">{item.icon}</span>
            )}
          </div>
        ) : item.cosmeticType === "frame" ? (
          <div className={`flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-3xl shadow-md ${frameClass}`}>
            {item.icon}
          </div>
        ) : item.cosmeticType === "highlight" ? (
          <div className={`w-full rounded-xl px-3 py-2.5 text-sm font-bold ${highlightCls}`}>
            Your Name
          </div>
        ) : (
          /* title */
          <div className={`rounded-full bg-gradient-to-r ${item.gradient} px-4 py-2 text-sm font-bold text-white shadow-md`}>
            {TITLE_LABELS[item.id] ?? item.name}
          </div>
        )}
      </div>

      <div className="mb-2 flex flex-wrap justify-center gap-1.5">
        <RarityBadge rarity={item.rarity} />
        {item.featured && <span className="rounded-full bg-foreground px-2 py-0.5 text-[10px] font-bold text-background">★ Featured</span>}
        {item.limitedUntil && <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-bold">Limited until {item.limitedUntil}</span>}
      </div>

      {/* Name */}
      <h3 className="text-sm font-bold text-foreground leading-snug">{item.name}</h3>

      {/* Description — single short sentence */}
      <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed line-clamp-2">{item.desc}</p>

      {/* Price — only when not owned */}
      {!owned && (
        <div className="mt-3 flex items-center gap-1 rounded-full bg-amber-100 dark:bg-amber-900/30 px-2.5 py-1">
          <span className="text-[10px]">🪙</span>
          <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300">{item.price.toLocaleString()}</span>
        </div>
      )}

      <div className="mt-2 min-h-5" aria-live="polite">
        {equipped ? (
          <span className="text-[11px] font-bold text-primary">✓ Equipped</span>
        ) : owned ? (
          <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">✓ Owned</span>
        ) : canAfford ? (
          <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400">Available to buy</span>
        ) : (
          <span className="text-[11px] font-bold text-muted-foreground">🔒 Locked · Not enough NP</span>
        )}
      </div>

      {/* CTA button — anchored to bottom */}
      {owned ? (
        <button
          type="button"
          disabled={equipping}
          onClick={onEquip}
          className={`mt-auto w-full rounded-full py-2.5 text-xs font-bold transition-all ${
            equipped
              ? "bg-muted text-muted-foreground hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-600 dark:hover:text-rose-400"
              : `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90`
          }`}
        >
          {equipping ? "…" : equipped ? "Unequip" : "Equip"}
        </button>
      ) : (
        <button
          type="button"
          disabled={buying || !canAfford}
          onClick={onBuy}
          className={`mt-auto w-full rounded-full py-2.5 text-xs font-bold transition-all ${
            didBuy    ? "bg-emerald-500 text-white" :
            canAfford ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                        "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {buying ? "…" : didBuy ? "Bought!" : canAfford ? "Buy" : "Need NP"}
        </button>
      )}
    </div>
  )
}

// ── NexusStoreHub — main store landing page ───────────────────────────────────

export function NexusStoreHub({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { balance } = useEconomy()

  const vaultItems      = STORE_ITEMS.filter(i => i.category === "vault")
  const supplyItems     = STORE_ITEMS.filter(i => i.category === "lifeline")
  const cosmeticItems   = STORE_ITEMS.filter(i => i.category === "cosmetic")

  const BANNERS = [
    {
      screen:      "store-supply" as Screen,
      emoji:       "⚗️",
      title:       "Supply Closet",
      description: "Consumable lifelines for solo MCQ games. Stock up and use them when you need an edge.",
      gradient:    "from-cyan-500 to-teal-600",
      bg:          "bg-cyan-50/60 dark:bg-cyan-950/20 border-cyan-200/60 dark:border-cyan-800/40",
      chevronColor:"text-cyan-600 dark:text-cyan-400",
      count:       `${supplyItems.length} items`,
    },
    {
      screen:      "store-cosmetics" as Screen,
      emoji:       "✨",
      title:       "Cosmetics",
      description: "Titles, frames, highlights, and avatars. Customize how you appear in multiplayer games.",
      gradient:    "from-violet-500 to-fuchsia-600",
      bg:          "bg-violet-50/60 dark:bg-violet-950/20 border-violet-200/60 dark:border-violet-800/40",
      chevronColor:"text-violet-600 dark:text-violet-400",
      count:       `${cosmeticItems.length} items`,
    },
    {
      screen:      "store-vault" as Screen,
      emoji:       "🔐",
      title:       "The Vault",
      description: "Premium clinical simulations — complex multi-step cases you unlock permanently with Nexus Points.",
      gradient:    "from-amber-500 to-orange-600",
      bg:          "bg-amber-50/60 dark:bg-amber-950/20 border-amber-200/60 dark:border-amber-800/40",
      chevronColor:"text-amber-600 dark:text-amber-400",
      count:       `${vaultItems.length} cases`,
    },
  ]

  return (
    <div className="flex min-h-full flex-col">
      <div className="mx-auto w-full max-w-2xl flex flex-col flex-1">

        {/* Page header */}
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
            <span className="text-xs font-bold text-amber-600/70 dark:text-amber-400/70">NP Balance</span>
          </div>
        </div>

        {/* Banner cards */}
        <div className="flex flex-col gap-4">
          {BANNERS.map((banner) => (
            <button
              key={banner.screen}
              type="button"
              onClick={() => onNavigate(banner.screen)}
              className={`flex flex-row items-center justify-between p-6 rounded-2xl border cursor-pointer transition-all hover:shadow-md active:scale-[0.99] text-left w-full ${banner.bg}`}
            >
              {/* Left: icon + text stack */}
              <div className="flex items-center gap-5 min-w-0">
                <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${banner.gradient} text-3xl shadow-sm`}>
                  {banner.emoji}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="text-base font-extrabold text-foreground">{banner.title}</p>
                    <span className="rounded-full bg-foreground/8 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      {banner.count}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-snug">{banner.description}</p>
                </div>
              </div>

              {/* Right: chevron */}
              <ChevronRightIcon size={20} className={`shrink-0 ml-4 ${banner.chevronColor}`} />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── NexusStoreSupplyPage ──────────────────────────────────────────────────────

export function NexusStoreSupplyPage({ onBack }: { onBack: () => void }) {
  const { balance, inventory, purchase } = useEconomy()
  const [buying, setBuying] = useState<string | null>(null)
  const [flash,  setFlash]  = useState<string | null>(null)
  const [error,  setError]  = useState<string | null>(null)
  const [selectedBundles, setSelectedBundles] = useState<Record<string, string>>({})

  const supplyItems = STORE_ITEMS.filter(i => i.category === "lifeline")

  async function handleBuy(item: StoreItem) {
    setError(null)
    setBuying(item.id)
    const bundleId = selectedBundles[item.id] ?? item.purchaseOptions?.[0]?.id ?? "single"
    const result = await purchase(item.id, { bundleId })
    setBuying(null)
    if (result.ok) {
      setFlash(item.id)
      setTimeout(() => setFlash(null), 2500)
    } else {
      setError(result.error ?? "Purchase failed")
      setTimeout(() => setError(null), 4000)
    }
  }

  return (
    <SubPageShell title="Supply Closet" emoji="⚗️" onBack={onBack} balance={balance}>
      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      <p className="mb-6 text-sm text-muted-foreground">
        Consumable lifelines for solo MCQ games. Stack them in your inventory and use them when you need an edge.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
        {supplyItems.map(item => (
          <SupplyGridCard
            key={item.id}
            item={item}
            owned={inventory[item.id] ?? 0}
            balance={balance}
            buying={buying === item.id}
            didBuy={flash === item.id}
            selectedBundleId={selectedBundles[item.id] ?? item.purchaseOptions?.[0]?.id ?? "single"}
            onSelectBundle={bundleId => setSelectedBundles(current => ({ ...current, [item.id]: bundleId }))}
            onBuy={() => handleBuy(item)}
          />
        ))}
      </div>
    </SubPageShell>
  )
}

// ── Vault — vertical grid card ────────────────────────────────────────────────

function VaultGridCard({
  item, unlocked, buying, didBuy, canAfford, onBuy,
}: {
  item: StoreItem; unlocked: boolean; buying: boolean; didBuy: boolean; canAfford: boolean; onBuy: () => void
}) {
  const meta = VAULT_META[item.id]

  return (
    <div className={`relative overflow-hidden flex flex-col p-6 h-full rounded-2xl border transition-all hover:shadow-md ${
      unlocked
        ? "border-emerald-200 dark:border-emerald-800/40 bg-gradient-to-br from-emerald-50/50 to-teal-50/30 dark:from-emerald-950/20 dark:to-teal-950/10"
        : "border-border bg-card hover:border-primary/30"
    }`}>
      {/* Colour bar */}
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${item.gradient} ${unlocked ? "opacity-50" : ""}`} />

      {/* Icon + title + meta row */}
      <div className="flex items-start gap-4 mb-4">
        <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${item.gradient} text-3xl shadow-md ${!unlocked ? "opacity-70" : ""}`}>
          {unlocked ? item.icon : "🔒"}
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <h3 className="text-base font-extrabold text-foreground leading-snug">{item.name}</h3>
          {meta && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              <DifficultyBadge difficulty={meta.difficulty} />
              <span className="text-[11px] text-muted-foreground">{meta.discipline}</span>
              <span className="text-[11px] text-muted-foreground">· {meta.steps} steps</span>
            </div>
          )}
        </div>
        {!unlocked && <PriceTag price={item.price} />}
      </div>

      {/* Description — no dialogue quote */}
      <p className="text-sm text-muted-foreground leading-relaxed">{item.desc}</p>

      {/* CTA — anchored bottom-right */}
      {unlocked ? (
        <div className="mt-auto pt-5 self-end">
          <span className="rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-3 py-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-400">
            ✓ Unlocked — Available in your profile
          </span>
        </div>
      ) : (
        <button
          type="button"
          disabled={buying || !canAfford}
          onClick={onBuy}
          className={`mt-auto self-end rounded-full px-5 py-2 text-xs font-bold transition-all ${
            didBuy    ? "bg-emerald-500 text-white" :
            canAfford ? `bg-gradient-to-r ${item.gradient} text-white hover:opacity-90` :
                        "bg-muted text-muted-foreground cursor-not-allowed"
          }`}
        >
          {buying ? "…" : didBuy ? "Unlocked!" : canAfford ? "🔓 Unlock" : "Need more NP"}
        </button>
      )}
    </div>
  )
}

// ── NexusStoreVaultPage ───────────────────────────────────────────────────────

export function NexusStoreVaultPage({ onBack }: { onBack: () => void }) {
  const { balance, inventory, purchase } = useEconomy()
  const [buying, setBuying] = useState<string | null>(null)
  const [flash,  setFlash]  = useState<string | null>(null)
  const [error,  setError]  = useState<string | null>(null)

  const vaultItems      = STORE_ITEMS.filter(i => i.category === "vault")
  const ownedVaultCount = vaultItems.filter(i => (inventory[i.id] ?? 0) >= 1).length

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

  return (
    <SubPageShell title="The Vault" emoji="🔐" onBack={onBack} balance={balance}>
      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}
      <div className="mb-6 flex items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground leading-relaxed">
          Complex multi-step clinical simulations. Unlock permanently with Nexus Points — available in your profile forever.
        </p>
        <span className="shrink-0 rounded-full bg-muted px-3 py-1.5 text-sm font-bold text-muted-foreground">
          {ownedVaultCount}/{vaultItems.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
        {vaultItems.map(item => (
          <VaultGridCard
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
    </SubPageShell>
  )
}

// ── NexusStoreCosmeticsPage ───────────────────────────────────────────────────

export function NexusStoreCosmeticsPage({ onBack }: { onBack: () => void }) {
  const { balance, inventory, purchase, equippedCosmetics, equipCosmetic } = useEconomy()
  const [cosSection, setCosSection] = useState<CosmeticSection>("title")
  const [buying,     setBuying]     = useState<string | null>(null)
  const [equipping,  setEquipping]  = useState<string | null>(null)
  const [flash,      setFlash]      = useState<string | null>(null)
  const [error,      setError]      = useState<string | null>(null)
  const [rarityFilter, setRarityFilter] = useState<CosmeticRarity | "all">("all")

  const cosItems = STORE_ITEMS
    .filter(i => i.category === "cosmetic" && i.cosmeticType === cosSection)
    .filter(i => rarityFilter === "all" || i.rarity === rarityFilter)
    .sort((a, b) => {
      const stateRank = (item: StoreItem) => {
        if (equippedCosmetics[cosSection] === item.id) return 0
        if ((inventory[item.id] ?? 0) >= 1) return 1
        if (balance >= item.price) return 2
        return 3
      }
      return stateRank(a) - stateRank(b)
        || (a.sortOrder ?? Number.MAX_SAFE_INTEGER) - (b.sortOrder ?? Number.MAX_SAFE_INTEGER)
        || a.id.localeCompare(b.id)
    })

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

  return (
    <SubPageShell title="Cosmetics" emoji="✨" onBack={onBack} balance={balance}>
      {error && (
        <div className="mb-4 rounded-2xl border border-rose-200 dark:border-rose-800/40 bg-rose-50 dark:bg-rose-950/30 px-4 py-2.5 text-sm text-rose-600 dark:text-rose-400">
          {error}
        </div>
      )}

      {/* Sub-section pill tabs */}
      <div className="mb-6 flex gap-1 rounded-2xl bg-muted p-1 overflow-x-auto no-scrollbar">
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

      <div className="mb-6 flex flex-wrap items-center gap-2" aria-label="Filter cosmetics by rarity">
        <span className="mr-1 text-xs font-bold text-muted-foreground">Rarity</span>
        {(["all", "common", "rare", "epic", "legendary", "mythic"] as const).map(rarity => (
          <button
            key={rarity}
            type="button"
            aria-pressed={rarityFilter === rarity}
            onClick={() => setRarityFilter(rarity)}
            className={`min-h-9 rounded-full px-3 text-xs font-bold capitalize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
              rarityFilter === rarity
                ? "bg-foreground text-background"
                : "bg-card text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground"
            }`}
          >
            {rarity === "all" ? "All rarities" : rarity}
          </button>
        ))}
      </div>

      <p className="mb-6 text-sm text-muted-foreground">
        {cosSection === "title"     && "Displayed as a badge next to your name during multiplayer leaderboard reveals."}
        {cosSection === "frame"     && "Animated ring shown around your player avatar badge during multiplayer pauses."}
        {cosSection === "highlight" && "Your row glows on the leaderboard when scores are revealed to everyone."}
        {cosSection === "avatar"    && "Your personal avatar displayed in multiplayer lobbies and leaderboards."}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 w-full">
        {cosItems.map(item => {
          const owned    = (inventory[item.id] ?? 0) >= 1
          const equipped = equippedCosmetics[cosSection] === item.id
          return (
            <CosmeticGridCard
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
      {cosItems.length === 0 && (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          No {rarityFilter} {cosSection} cosmetics are available.
        </div>
      )}
    </SubPageShell>
  )
}
