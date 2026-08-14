import type { CosmeticRendererProps } from "../types"
import "./titles.css"

export function ReactiveTitleRenderer({ children }: CosmeticRendererProps) {
  return <span className="reactive-title__plate"><span className="reactive-title__mark" aria-hidden="true"/><span className="reactive-title__text">{children}</span><span className="reactive-title__trace" aria-hidden="true"/></span>
}
