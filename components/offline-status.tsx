"use client"

import { useEffect, useState } from "react"
import { Cloud, CloudOff } from "lucide-react"
import { flushOfflineOutbox } from "@/lib/offline-storage"

export function OfflineStatus() {
  const [online, setOnline] = useState(true)
  const [showRestored, setShowRestored] = useState(false)

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") void navigator.serviceWorker.register("/sw.js")
    const update = () => {
      const next = navigator.onLine
      setOnline(previous => {
        if (!previous && next) { setShowRestored(true); void flushOfflineOutbox(); window.setTimeout(() => setShowRestored(false), 3000) }
        return next
      })
    }
    setOnline(navigator.onLine)
    if (navigator.onLine) void flushOfflineOutbox()
    window.addEventListener("online", update)
    window.addEventListener("offline", update)
    return () => { window.removeEventListener("online", update); window.removeEventListener("offline", update) }
  }, [])

  if (online && !showRestored) return null
  return <div role="status" aria-live="polite" className={`fixed bottom-4 left-1/2 z-[100] flex -translate-x-1/2 items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold shadow-xl ${online ? "bg-emerald-600 text-white" : "bg-amber-500 text-black"}`}>
    {online ? <Cloud size={16}/> : <CloudOff size={16}/>} {online ? "Back online" : "Offline mode"}
  </div>
}
