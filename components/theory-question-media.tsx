import type { TheoryMediaItem } from "@/lib/theory-media"
import { isSafeTheoryMediaUrl } from "@/lib/theory-media"

export function TheoryQuestionMedia({ media, compact = false }: { media: TheoryMediaItem[]; compact?: boolean }) {
  const visible = media.filter((item, index, items) => item && typeof item.url === "string" && isSafeTheoryMediaUrl(item.url) && items.findIndex(candidate => candidate?.url === item.url) === index)
  if (!visible.length) return null

  return (
    <div className={`grid gap-3 ${visible.length > 1 ? "sm:grid-cols-2" : ""}`}>
      {visible.map((item, index) => (
        <figure key={`${item.url.slice(0, 80)}-${index}`} className="overflow-hidden rounded-xl border border-border/70 bg-muted/20">
          <img
            src={item.url}
            alt={item.alt || `Question image ${index + 1}`}
            className={`w-full object-contain ${compact ? "max-h-40" : "max-h-[32rem]"}`}
          />
          {item.alt && <figcaption className="border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">{item.alt}</figcaption>}
        </figure>
      ))}
    </div>
  )
}
