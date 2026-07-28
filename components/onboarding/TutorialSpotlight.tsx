import type { CSSProperties } from "react"
export function TutorialSpotlight({ rect, interactive = false }: { rect: DOMRect | null; interactive?: boolean }) {
  if (!rect) return null
  const style: CSSProperties = { left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }
  return <div aria-hidden className={`${interactive ? "pointer-events-none" : "pointer-events-none"} fixed z-[82] rounded-xl ring-4 ring-primary ring-offset-4 ring-offset-background transition-[left,top,width,height] duration-200 motion-reduce:transition-none`} style={style}/>
}
