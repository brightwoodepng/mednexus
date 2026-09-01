"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"

export default function AdminError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <section role="alert" className="mx-auto max-w-xl rounded-2xl border border-destructive/25 bg-card p-6 shadow-sm">
    <AlertTriangle className="text-destructive" size={28}/>
    <h1 className="mt-4 text-xl font-bold">This admin workspace could not finish loading</h1>
    <p className="mt-2 text-sm leading-6 text-muted-foreground">Your session and sidebar are still available. Retry this workspace without reloading the whole console.</p>
    <button type="button" onClick={reset} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-primary px-4 text-sm font-bold text-primary-foreground"><RefreshCw size={16}/>Retry workspace</button>
  </section>
}
