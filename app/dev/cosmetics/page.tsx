import { notFound } from "next/navigation"
import { CosmeticAvatar, CosmeticFrame, CosmeticHighlight } from "@/components/cosmetics"
import { COSMETIC_RARITY_LABELS, SELLABLE_STORE_ITEMS } from "@/lib/economy"

const TYPES = ["frame", "highlight", "avatar"] as const

export default function CosmeticGalleryPage() {
  if (process.env.NODE_ENV === "production") notFound()
  return <main className="min-h-screen bg-background px-4 py-8 text-foreground sm:px-8" data-preview-context="gallery">
    <header className="mx-auto max-w-7xl border-b border-border pb-6">
      <p className="text-xs font-black uppercase tracking-[.24em] text-cyan-600 dark:text-cyan-300">MedNexus · visual QA</p>
      <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Clinical cosmetics gallery</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">Renderer parity, responsive scale, theme contrast, and motion states for the complete clinical collection.</p>
    </header>
    <div className="mx-auto max-w-7xl">
      {TYPES.map(type => {
        const items = SELLABLE_STORE_ITEMS.filter(item => item.cosmeticType === type)
        return <section key={type} id={`${type}-catalog`} className="py-8" aria-labelledby={`${type}-heading`}>
          <div className="mb-4 flex items-end justify-between border-b border-border pb-3">
            <h2 id={`${type}-heading`} className="text-xl font-black capitalize">{type} catalog</h2>
            <span className="font-mono text-xs text-muted-foreground">{items.length} active</span>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {items.map(item => {
              const content = <div className="flex h-20 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-slate-100 to-slate-300 text-2xl dark:from-slate-800 dark:to-slate-950">{type === "avatar" ? null : "MN"}</div>
              const preview = type === "frame"
                ? <CosmeticFrame cosmeticId={item.id} size="store-preview" motionState="ambient" className="rounded-2xl">{content}</CosmeticFrame>
                : type === "highlight"
                  ? <CosmeticHighlight cosmeticId={item.id} size="store-preview" motionState="ambient" className="rounded-2xl p-2">{content}</CosmeticHighlight>
                  : <CosmeticAvatar cosmeticId={item.id} size="store-preview" className="mx-auto h-20 w-20 overflow-hidden rounded-2xl bg-slate-200" />
              return <article key={item.id} className="min-w-0 rounded-2xl border border-border bg-card p-3 shadow-sm">
                {preview}
                <h3 className="mt-3 truncate text-sm font-extrabold">{item.name}</h3>
                <div className="mt-1 flex items-center justify-between gap-2 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  <span>{COSMETIC_RARITY_LABELS[item.rarity!]}</span><span>{item.price.toLocaleString()} NP</span>
                </div>
              </article>
            })}
          </div>
        </section>
      })}
      <section id="interaction-states" className="py-8">
        <h2 className="border-b border-border pb-3 text-xl font-black">Interaction states</h2>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          {(["static", "ambient", "focused", "celebrating", "reduced"] as const).map(state => <div key={state} className="rounded-2xl border border-border bg-card p-3 text-center">
            <CosmeticFrame cosmeticId="frame_cardiac_conduction" size="compact" motionState={state} reducedMotion={state === "reduced"} className="mx-auto h-16 w-16 rounded-full"><CosmeticAvatar cosmeticId="avatar_scrub_tech" size="compact" className="h-full w-full overflow-hidden rounded-full" /></CosmeticFrame>
            <p className="mt-3 text-xs font-bold capitalize">{state}</p>
          </div>)}
        </div>
      </section>
    </div>
  </main>
}
