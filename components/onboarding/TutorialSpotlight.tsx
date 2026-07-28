import type { CSSProperties } from "react"
export function TutorialSpotlight({ rect }: { rect: DOMRect | null }) {
  if (!rect) return null
  // A ring around a drawer or another full-screen container reads like a second
  // overlay on phones and can obscure the UI it is meant to explain.
  if (typeof window !== "undefined" && (rect.width > window.innerWidth * .86 || rect.height > window.innerHeight * .72)) return null
  const inset = 6
  const left = Math.max(inset, rect.left - inset)
  const top = Math.max(inset, rect.top - inset)
  const style: CSSProperties = {
    left,
    top,
    width: Math.max(0, Math.min(rect.width + inset * 2, window.innerWidth - left - inset)),
    height: Math.max(0, Math.min(rect.height + inset * 2, window.innerHeight - top - inset)),
  }
  return <div aria-hidden className="pointer-events-none fixed z-[82] rounded-xl ring-[3px] ring-primary ring-offset-2 ring-offset-background transition-[left,top,width,height] duration-200 motion-reduce:transition-none" style={style}/>
}
