"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { ChevronDown, CircleUserRound, Coins, Filter, Frame, PackageOpen, ShieldCheck, ShoppingBag, Sparkles, Tag, X } from "lucide-react"
import { useEconomy } from "@/contexts/economy-context"
import { useApp } from "@/contexts/app-context"
import { SELLABLE_STORE_ITEMS, SOLO_SUPPLY_MODE_LABELS, STORE_ITEMS, TITLE_LABELS, type CosmeticRarity, type StoreItem } from "@/lib/economy"
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/icons"
import type { Screen } from "@/lib/view"
import { CosmeticPreviewStage, getCosmeticPresentation } from "@/components/cosmetics"
import { AvatarImage } from "@/components/avatar-image"
import { ECONOMY_ICON, ECONOMY_ROW } from "@/components/economy-ui"

type CosmeticSection = "title" | "frame" | "highlight" | "avatar"
type CosmeticPreview = Record<CosmeticSection, string | null>
const rarities = ["all", "common", "rare", "epic", "legendary", "mythic"] as const
const emptyPreview: CosmeticPreview = { title: null, frame: null, highlight: null, avatar: null }

function BalancePill({ balance }: { balance: number }) {
  return <div aria-label={`${balance.toLocaleString()} Nexus Points`} className="flex h-11 min-w-0 shrink-0 items-center gap-1.5 rounded-xl border border-border/80 bg-card/80 px-2.5 text-foreground shadow-sm sm:px-3">
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500"><Coins size={15} aria-hidden /></span><span className="max-w-[5.5rem] truncate text-xs font-extrabold tabular-nums sm:max-w-none">{balance.toLocaleString()}</span><span className="text-[10px] font-bold text-muted-foreground">NP</span>
  </div>
}

function PriceTag({ price }: { price: number }) {
  return <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-[11px] font-bold tabular-nums text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"><span aria-hidden="true">●</span>{price.toLocaleString()} NP</span>
}

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement as HTMLElement
    const node = ref.current
    const focusable = () => Array.from(node?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])
    focusable()[0]?.focus()
    const keydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return }
      if (event.key !== "Tab") return
      const controls = focusable(); if (!controls.length) return
      const first = controls[0], last = controls[controls.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener("keydown", keydown)
    return () => { document.removeEventListener("keydown", keydown); returnFocus.current?.focus() }
  }, [open, onClose])
  return ref
}

function BottomSheet({ open, title, onClose, children, footer }: { open: boolean; title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const ref = useFocusTrap(open, onClose)
  if (!open) return null
  return <div className="fixed inset-0 z-[90] sm:hidden" role="presentation">
    <button aria-label={`Close ${title}`} className="absolute inset-0 h-full w-full bg-black/55" onClick={onClose} />
    <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="store-sheet-title" className="absolute inset-x-0 bottom-0 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-3xl border border-border bg-background shadow-2xl">
      <header className="sticky top-0 z-10 flex min-h-14 items-center justify-between border-b border-border bg-background px-4"><h2 id="store-sheet-title" className="min-w-0 truncate text-base font-extrabold">{title}</h2><button type="button" onClick={onClose} aria-label={`Close ${title}`} className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-muted"><X size={20} /></button></header>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">{children}</div>
      {footer && <footer className="sticky bottom-0 border-t border-border bg-background p-3 pb-[calc(.75rem+env(safe-area-inset-bottom,0px))]">{footer}</footer>}
    </div>
  </div>
}

function SubPageShell({ title, description, onBack, balance, toolbar, children }: { title: string; description?: ReactNode; onBack: () => void; balance: number; toolbar?: ReactNode; children: ReactNode }) {
  return <div className="mx-auto flex min-h-full w-full max-w-6xl min-w-0 flex-col overflow-x-clip pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-6">
    <header data-testid="store-header" className="sticky top-0 z-50 -mx-3 mb-3 border-b border-border/80 bg-background/95 px-3 pb-2 pt-[max(.375rem,env(safe-area-inset-top,0px))] backdrop-blur-md sm:static sm:mx-0 sm:mb-6 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="flex min-h-11 min-w-0 items-center gap-2 sm:gap-3">
        <button type="button" onClick={onBack} aria-label="Back to Nexus Store" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground hover:bg-muted sm:h-10 sm:w-auto sm:gap-1.5 sm:px-3">
          <ChevronLeftIcon size={16} /><span className="hidden text-sm font-semibold sm:inline">Back to Store</span>
        </button>
        <h1 className="min-w-0 flex-1 truncate text-lg font-extrabold tracking-tight sm:text-xl">{title}</h1><BalancePill balance={balance} />
      </div>
      {(description || toolbar) && <div className="mt-1.5 min-w-0 sm:mt-2 sm:ml-0">{description}{toolbar}</div>}
    </header>
    <div className="min-w-0 flex-1">{children}</div>
  </div>
}

export function NexusStoreHub({ onNavigate }: { onNavigate: (screen: Screen) => void }) {
  const { balance } = useEconomy()
  useEffect(() => { const main = document.querySelector("main"); const saved = Number(sessionStorage.getItem("nexus-store-scroll") || 0); if (main && saved) requestAnimationFrame(() => { main.scrollTop = saved }) }, [])
  const navigate = (screen: Screen) => { const main = document.querySelector("main"); sessionStorage.setItem("nexus-store-scroll", String(main?.scrollTop ?? 0)); onNavigate(screen) }
  const departments = [
    { screen: "store-supply" as Screen, title: "Supply Closet", description: "Consumable lifelines for solo MCQ games.", count: `${STORE_ITEMS.filter(i => i.category === "lifeline").length} items`, Icon: PackageOpen, iconStyle: "bg-cyan-500/12 text-cyan-600 dark:text-cyan-300" },
    { screen: "store-cosmetics" as Screen, title: "Cosmetics", description: "Titles, frames, highlights, and avatars for multiplayer.", count: `${SELLABLE_STORE_ITEMS.filter(i => i.category === "cosmetic").length} items`, Icon: Sparkles, iconStyle: "bg-violet-500/12 text-violet-600 dark:text-violet-300" },
  ]
  const vaultSellable = SELLABLE_STORE_ITEMS.some(i => i.category === "vault")
  return <div className="mx-auto min-h-full w-full max-w-2xl min-w-0 overflow-x-clip pb-[calc(6rem+env(safe-area-inset-bottom,0px))] md:pb-6">
    <header className="sticky top-0 z-50 -mx-3 mb-4 flex min-h-16 items-center justify-between gap-3 border-b border-border/80 bg-background/95 px-3 py-2 pt-[max(.5rem,env(safe-area-inset-top,0px))] backdrop-blur-md sm:static sm:mx-0 sm:mb-6 sm:border-0 sm:bg-transparent sm:p-0">
      <div className="flex min-w-0 items-center gap-3"><span className={`${ECONOMY_ICON} bg-violet-500/12 text-violet-600 dark:text-violet-300`}><ShoppingBag size={19} /></span><h1 className="truncate text-lg font-extrabold sm:text-xl">Nexus Store</h1></div><BalancePill balance={balance} />
    </header>
    <div className="flex flex-col gap-3 sm:gap-4">
      {departments.map(({ Icon, ...department }) => <button key={department.screen} type="button" onClick={() => navigate(department.screen)} className={`flex min-h-[72px] w-full items-center gap-3 text-left hover:border-primary/30 hover:bg-card hover:shadow-sm ${ECONOMY_ROW}`}>
        <span className={`${ECONOMY_ICON} ${department.iconStyle}`}><Icon size={18} /></span><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm text-foreground">{department.title}</strong><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">{department.count}</span></span><span className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">{department.description}</span></span><ChevronRightIcon className="shrink-0 text-muted-foreground" size={18} />
      </button>)}
      {!vaultSellable && <div aria-disabled="true" className={`flex min-h-[72px] w-full items-center gap-3 border-dashed opacity-65 ${ECONOMY_ROW}`}><span className={`${ECONOMY_ICON} bg-muted text-muted-foreground`}><ShieldCheck size={18} /></span><span className="min-w-0 flex-1"><span className="flex min-w-0 items-center gap-2"><strong className="truncate text-sm">The Vault</strong><span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold text-muted-foreground">Coming soon</span></span><span className="mt-0.5 block line-clamp-2 text-xs leading-4 text-muted-foreground">New clinical simulations are being prepared.</span></span></div>}
    </div>
  </div>
}

function SupplyCard({ item, owned, balance, buying, selectedBundleId, error, onSelectBundle, onBuy }: { item: StoreItem; owned: number; balance: number; buying: boolean; selectedBundleId: string; error?: string; onSelectBundle: (id: string) => void; onBuy: () => void }) {
  const options = item.purchaseOptions ?? [{ id: "single", quantity: 1, price: item.price }], selected = options.find(o => o.id === selectedBundleId) ?? options[0]
  const cap = item.maxInventory ?? item.supply?.stackLimit ?? 0, capped = owned + selected.quantity > cap
  const buyLabel = buying ? "Purchasing…" : capped ? "Inventory cap" : balance < selected.price ? "Need NP" : `Buy ${selected.quantity} · ${selected.price.toLocaleString()} NP`
  return <article id={`store-item-${item.id}`} className="min-w-0 rounded-2xl border border-border bg-card p-3 transition-[background-color,border-color,box-shadow] sm:flex sm:h-full sm:flex-col sm:p-6">
    <div className="flex min-w-0 items-center gap-3"><span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br ${item.gradient} text-xl`}>{item.icon}</span><div className="min-w-0 flex-1"><h2 className="truncate text-sm font-bold">{item.name}</h2><p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300">Owned {owned}/{cap}</p></div></div>
    <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground sm:mt-3 sm:leading-relaxed">{item.desc}</p>
    {item.supply && <details className="mt-1 text-xs text-muted-foreground sm:mt-2"><summary className="flex min-h-11 cursor-pointer items-center justify-between font-semibold">Supported modes <ChevronDown size={16} /></summary><p className="pb-2">{item.supply.supportedModes.map(m => SOLO_SUPPLY_MODE_LABELS[m]).join(", ")}</p></details>}
    <div aria-label={`Purchase quantity for ${item.name}`} className={`mt-2 gap-1 rounded-xl bg-muted p-1 sm:mt-3 ${options.length === 1 ? "hidden sm:grid sm:grid-cols-1" : options.length > 2 ? "grid grid-cols-3" : "grid grid-cols-2"}`}>{options.map(option => <button key={option.id} type="button" disabled={buying || owned + option.quantity > cap} aria-pressed={selected.id === option.id} onClick={() => onSelectBundle(option.id)} className={`min-h-11 min-w-0 rounded-lg px-1 text-xs font-bold ${selected.id === option.id ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}><span className="block truncate">{option.quantity}×</span><span className="block truncate text-[10px]">{option.price.toLocaleString()} NP</span></button>)}</div>
    {error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}
    <div className="mt-2 sm:mt-auto sm:flex sm:items-center sm:gap-2 sm:pt-4"><span className="hidden sm:inline-flex"><PriceTag price={selected.price} /></span><button type="button" disabled={buying || capped || balance < selected.price} onClick={onBuy} className="min-h-11 w-full min-w-0 flex-1 rounded-xl bg-primary px-3 text-xs font-bold text-primary-foreground transition-[background-color,box-shadow] hover:shadow-sm disabled:bg-muted disabled:text-muted-foreground"><span className="sm:hidden">{buyLabel}</span><span className="hidden sm:inline">{buying ? "Purchasing…" : capped ? "Inventory cap" : balance < selected.price ? "Need NP" : `Buy ${selected.quantity}`}</span></button></div>
  </article>
}

export function NexusStoreSupplyPage({ onBack }: { onBack: () => void }) {
  const { balance, inventory, purchase } = useEconomy(); const [buying, setBuying] = useState<string | null>(null); const [bundles, setBundles] = useState<Record<string,string>>({}); const [errors, setErrors] = useState<Record<string,string>>({}); const [status, setStatus] = useState("")
  const items = STORE_ITEMS.filter(i => i.category === "lifeline")
  async function buy(item: StoreItem) { if (buying) return; setBuying(item.id); setErrors(e => ({ ...e, [item.id]: "" })); const bundleId = bundles[item.id] ?? item.purchaseOptions?.[0]?.id ?? "single"; const option = item.purchaseOptions?.find(o => o.id === bundleId) ?? { quantity: 1 }; const result = await purchase(item.id, { bundleId }); setBuying(null); if (result.ok) setStatus(`Purchased ${option.quantity} ${item.name}. You now have ${result.quantity ?? (inventory[item.id] ?? 0) + option.quantity}. ${result.balance ?? balance} NP remaining.`); else setErrors(e => ({ ...e, [item.id]: result.error ?? "Purchase failed. Try again." })) }
  return <SubPageShell title="Supply Closet" description={<p className="hidden line-clamp-2 text-xs text-muted-foreground sm:block sm:text-sm">Stock lifelines for solo MCQ games.</p>} onBack={onBack} balance={balance}><div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-[70] flex justify-center sm:bottom-6">{status && <p className="pointer-events-auto max-w-lg rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-xl">{status}</p>}</div><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-4">{items.map(item => <SupplyCard key={item.id} item={item} owned={inventory[item.id] ?? 0} balance={balance} buying={buying === item.id} selectedBundleId={bundles[item.id] ?? item.purchaseOptions?.[0]?.id ?? "single"} error={errors[item.id]} onSelectBundle={id => setBundles(b => ({...b,[item.id]:id}))} onBuy={() => buy(item)} />)}</div></SubPageShell>
}

function RarityBadge({ rarity }: { rarity?: CosmeticRarity }) { return rarity ? <span className="truncate rounded-full bg-muted px-2 py-1 text-[10px] font-extrabold uppercase tracking-wide text-muted-foreground">{rarity}</span> : null }
function CosmeticVisual({ item }: { item: StoreItem }) { const cls = item.cosmeticType === "frame" || item.cosmeticType === "highlight" ? getCosmeticPresentation(item.id).className ?? "" : ""; return <div className={`flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br sm:h-[72px] sm:w-[72px] ${item.gradient} ${cls} text-2xl`}>{item.cosmeticType === "avatar" && item.imagePath ? <AvatarImage avatarId={item.id} fallback={item.icon} className="h-full w-full object-cover" /> : item.cosmeticType === "title" ? <span className="px-1 text-center text-[10px] font-bold text-white">{TITLE_LABELS[item.id] ?? item.name}</span> : item.icon}</div> }
function CosmeticCard({ item, owned, equipped, previewed, buying, equipping, canAfford, error, onBuy, onEquip, onPreview }: { item: StoreItem; owned: boolean; equipped: boolean; previewed: boolean; buying: boolean; equipping: boolean; canAfford: boolean; error?: string; onBuy: () => void; onEquip: () => void; onPreview: () => void }) {
  return <article id={`store-item-${item.id}`} className={`min-w-0 rounded-2xl border bg-card p-3 transition-[background-color,border-color,box-shadow] ${equipped ? "border-primary bg-primary/5" : "border-border"}`}><div className="flex min-w-0 gap-3"><CosmeticVisual item={item}/><div className="min-w-0 flex-1"><h2 className="line-clamp-2 text-sm font-bold leading-tight">{item.name}</h2><div className="mt-1 flex min-w-0 flex-wrap items-center gap-1"><RarityBadge rarity={item.rarity}/><span className="text-[10px] font-bold text-muted-foreground">{equipped ? "Equipped" : owned ? "Owned" : previewed ? "Previewing" : canAfford ? "Available" : "Locked"}</span></div>{!owned && <div className="mt-1.5"><PriceTag price={item.price}/></div>}</div></div><p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{item.desc}</p>{error && <p role="alert" className="mt-2 rounded-xl bg-rose-50 p-2 text-xs font-semibold text-rose-700 dark:bg-rose-950/40 dark:text-rose-300">{error}</p>}<div className="mt-2 grid grid-cols-2 gap-2 sm:mt-3"><button type="button" aria-pressed={previewed} onClick={onPreview} className="min-h-11 rounded-xl border border-border text-xs font-bold transition-[background-color,border-color,box-shadow] hover:bg-muted">{previewed ? "Previewing" : "Preview"}</button><button type="button" disabled={buying || equipping || (!owned && !canAfford)} onClick={owned ? onEquip : onBuy} className="min-h-11 rounded-xl bg-primary px-2 text-xs font-bold text-primary-foreground transition-[background-color,box-shadow] hover:shadow-sm disabled:bg-muted disabled:text-muted-foreground">{buying ? "Buying…" : equipping ? "Saving…" : owned ? equipped ? "Unequip" : "Equip" : "Buy"}</button></div></article>
}

function PreviewContent({ preview, inventory, displayName }: { preview: CosmeticPreview; inventory: Record<string,number>; displayName: string }) { const find = (type: CosmeticSection) => STORE_ITEMS.find(i => i.id === preview[type]); const title=find("title"), frame=find("frame"), highlight=find("highlight"), avatar=find("avatar"); return <><CosmeticPreviewStage avatarId={avatar?.id} frameId={frame?.id} highlightId={highlight?.id} titleId={title?.id} displayName={displayName}/><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{(["title","frame","highlight","avatar"] as CosmeticSection[]).map(type => { const item=find(type); return <div key={type} className="min-w-0 rounded-xl border border-white/10 bg-white/5 p-3"><p className="text-[10px] font-bold uppercase text-slate-400">{type}</p><p className="mt-1 truncate text-xs font-bold">{item?.name ?? "Not selected"}</p>{item && <p className="mt-1 text-[10px] text-slate-300">{inventory[item.id] ? "Owned" : `${item.price.toLocaleString()} NP`}</p>}</div>})}</div></> }

export function NexusStoreCosmeticsPage({ onBack }: { onBack: () => void }) {
  const { balance, inventory, purchase, equippedCosmetics, equipCosmetic } = useEconomy(); const { user } = useApp(); const [section,setSection]=useState<CosmeticSection>("title"), [rarity,setRarity]=useState<typeof rarities[number]>("all"), [filterOpen,setFilterOpen]=useState(false), [roomOpen,setRoomOpen]=useState(false), [preview,setPreview]=useState<CosmeticPreview>(emptyPreview), [buying,setBuying]=useState<string|null>(null), [equipping,setEquipping]=useState<string|null>(null), [errors,setErrors]=useState<Record<string,string>>({}), [status,setStatus]=useState(""); const productsRef=useRef<HTMLDivElement>(null)
  const items=useMemo(()=>STORE_ITEMS.filter(i=>i.category==="cosmetic"&&i.cosmeticType===section&&((i.status!=="retired"&&i.status!=="legacy")||(inventory[i.id]??0)>0)&&(rarity==="all"||i.rarity===rarity)),[section,rarity,inventory]); const count=Object.values(preview).filter(Boolean).length
  const showProducts=()=>requestAnimationFrame(()=>productsRef.current?.scrollIntoView({behavior:"smooth",block:"start"})); const changeSection=(value:CosmeticSection)=>{setSection(value);showProducts()}; const changeRarity=(value:typeof rarities[number])=>{setRarity(value);showProducts()}
  async function buy(item:StoreItem){if(buying)return;setBuying(item.id);setErrors(e=>({...e,[item.id]:""}));const result=await purchase(item.id);setBuying(null);if(result.ok)setStatus(`Purchased ${item.name}. ${result.balance??balance} NP remaining.`);else setErrors(e=>({...e,[item.id]:result.error??"Purchase failed. Try again."}))}
  async function equip(item:StoreItem){if(equipping)return;setEquipping(item.id);const equipped=equippedCosmetics[section]===item.id,result=await equipCosmetic(section,equipped?null:item.id);setEquipping(null);if(result.ok)setStatus(`${item.name} ${equipped?"unequipped":"equipped"}.`);else setErrors(e=>({...e,[item.id]:result.error??"Could not update this item."}))}
  const tabs=[{id:"title" as const,label:"Titles",Icon:Tag},{id:"frame" as const,label:"Frames",Icon:Frame},{id:"highlight" as const,label:"Highlights",Icon:Sparkles},{id:"avatar" as const,label:"Avatars",Icon:CircleUserRound}]
  const toolbar=<div className="rounded-2xl border border-border bg-background p-1 shadow-sm sm:mt-2 sm:border-0 sm:bg-transparent sm:p-0 sm:shadow-none"><div className="grid grid-cols-4 gap-1 rounded-xl bg-muted p-1">{tabs.map(({id,label,Icon})=><button key={id} type="button" aria-pressed={section===id} onClick={()=>changeSection(id)} className={`flex min-h-11 min-w-0 flex-col items-center justify-center rounded-lg px-0.5 text-[9px] font-bold min-[360px]:text-[10px] sm:flex-row sm:gap-1.5 sm:text-xs ${section===id?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}><Icon size={15}/><span className="truncate">{label}</span></button>)}</div><button type="button" onClick={()=>setFilterOpen(true)} className="mt-1 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-xs font-bold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:hidden"><Filter size={16}/>Filter · {rarity==="all"?"All rarities":rarity}</button><div className="mt-2 hidden flex-wrap gap-2 sm:flex" aria-label="Filter cosmetics by rarity">{rarities.map(r=><button key={r} type="button" aria-pressed={rarity===r} onClick={()=>changeRarity(r)} className={`min-h-11 rounded-full px-4 text-xs font-bold capitalize ${rarity===r?"bg-foreground text-background":"border border-border bg-card"}`}>{r==="all"?"All rarities":r}</button>)}</div></div>
  return <SubPageShell title="Cosmetics" onBack={onBack} balance={balance} toolbar={toolbar}>
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom,0px))] z-[70] flex justify-center sm:bottom-6">{status&&<div className="pointer-events-auto flex max-w-lg items-center gap-3 rounded-2xl bg-foreground px-4 py-3 text-sm font-semibold text-background shadow-xl"><span className="min-w-0 flex-1">{status}</span>{status.startsWith("Purchased")&&<button type="button" onClick={()=>{const item=STORE_ITEMS.find(i=>status.includes(i.name));if(item)void equip(item)}} className="min-h-11 shrink-0 rounded-xl bg-background px-3 text-foreground">Equip now</button>}</div>}</div>
    <section className="mb-3 rounded-2xl border border-violet-300/40 bg-gradient-to-br from-slate-950 to-violet-950 p-2.5 text-white sm:hidden"><div className="flex items-center gap-2.5"><div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-white/10">{preview.avatar?<AvatarImage avatarId={preview.avatar} fallback="" className="h-full w-full object-cover"/>:<CircleUserRound className="m-2.5 h-5 w-5 text-violet-200"/>}</div><div className="min-w-0 flex-1"><h2 className="text-xs font-bold">Dressing room</h2><p className="text-[11px] text-slate-300">{count} item{count===1?"":"s"} selected</p></div><button type="button" onClick={()=>setRoomOpen(true)} aria-label="Open dressing room" className="min-h-11 shrink-0 rounded-xl bg-white px-3 text-xs font-bold text-slate-950">Open</button></div></section>
    <section className="mb-6 hidden rounded-3xl border border-violet-700/40 bg-gradient-to-br from-slate-950 to-violet-950 p-5 text-white sm:block"><div className="mb-4 flex items-center justify-between"><div><p className="text-xs font-bold uppercase tracking-widest text-violet-300">Multiplayer look lab</p><h2 className="text-lg font-extrabold">Dressing room</h2></div><button type="button" onClick={()=>setPreview(emptyPreview)} className="min-h-11 rounded-full border border-white/20 px-4 text-xs font-bold">Reset preview</button></div><PreviewContent preview={preview} inventory={inventory} displayName={user?.name||"Your Name"}/></section>
    <div ref={productsRef} className="scroll-mt-44 sm:scroll-mt-52"><p className="mb-2 text-xs text-muted-foreground sm:mb-3 sm:text-sm">{items.length} {rarity==="all"?"":rarity} {section} option{items.length===1?"":"s"}</p><div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">{items.map(item=><CosmeticCard key={item.id} item={item} owned={(inventory[item.id]??0)>0} equipped={equippedCosmetics[section]===item.id} previewed={preview[section]===item.id} buying={buying===item.id} equipping={equipping===item.id} canAfford={balance>=item.price} error={errors[item.id]} onBuy={()=>buy(item)} onEquip={()=>equip(item)} onPreview={()=>setPreview(p=>({...p,[section]:item.id}))}/>)}</div></div>
    <BottomSheet open={filterOpen} title="Filter by rarity" onClose={()=>setFilterOpen(false)} footer={<div className="flex gap-2"><button type="button" onClick={()=>changeRarity("all")} className="min-h-11 flex-1 rounded-xl border border-border font-bold">Clear filters</button><button type="button" onClick={()=>setFilterOpen(false)} className="min-h-11 flex-1 rounded-xl bg-primary font-bold text-primary-foreground">Show items</button></div>}><div className="grid gap-2">{rarities.map(r=><button key={r} type="button" aria-pressed={rarity===r} onClick={()=>changeRarity(r)} className={`min-h-11 rounded-xl border px-4 text-left text-sm font-bold capitalize ${rarity===r?"border-primary bg-primary/10 text-primary":"border-border"}`}>{r==="all"?"All rarities":r}</button>)}</div></BottomSheet>
    <BottomSheet open={roomOpen} title="Dressing room" onClose={()=>setRoomOpen(false)} footer={<button type="button" onClick={()=>setRoomOpen(false)} className="min-h-11 w-full rounded-xl bg-primary font-bold text-primary-foreground">Close and shop</button>}><div className="-m-4 min-h-full bg-gradient-to-br from-slate-950 to-violet-950 p-4 text-white"><div className="mb-3 flex justify-end"><button type="button" onClick={()=>setPreview(emptyPreview)} disabled={!count} className="min-h-11 rounded-xl border border-white/20 px-4 text-xs font-bold disabled:opacity-40">Reset</button></div><PreviewContent preview={preview} inventory={inventory} displayName={user?.name||"Your Name"}/></div></BottomSheet>
  </SubPageShell>
}

export function NexusStoreVaultPage({ onBack }: { onBack: () => void }) { const { balance }=useEconomy(); return <SubPageShell title="The Vault" description={<p className="text-xs text-muted-foreground">New clinical simulations are being prepared.</p>} onBack={onBack} balance={balance}><div className="rounded-2xl border border-dashed border-border p-8 text-center"><ShieldCheck className="mx-auto text-muted-foreground"/><h2 className="mt-3 font-bold">Coming soon</h2><p className="mt-1 text-sm text-muted-foreground">There is currently no purchasable Vault content.</p></div></SubPageShell> }
