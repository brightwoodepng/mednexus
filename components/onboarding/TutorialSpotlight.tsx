import type { CSSProperties } from "react"
export function TutorialSpotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null
  const style: CSSProperties = { left: rect.left - 6, top: rect.top - 6, width: rect.width + 12, height: rect.height + 12 }
  return <div aria-hidden className="pointer-events-none fixed z-[82] rounded-xl ring-4 ring-primary ring-offset-4 ring-offset-background transition-[left,top,width,height] motion-reduce:transition-none" style={style}/>
}
