import { Loader2 } from "lucide-react"

export default function AdminLoading() {
  return <div role="status" className="mx-auto grid min-h-[55vh] max-w-6xl place-items-center">
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 shadow-sm">
      <Loader2 size={18} className="animate-spin text-primary" />
      <span className="text-sm font-semibold">Opening workspace</span>
    </div>
    <span className="sr-only">Loading admin workspace</span>
  </div>
}
