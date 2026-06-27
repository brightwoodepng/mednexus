"use client"

import { useState } from "react"
import { useApp } from "@/contexts/app-context"
import { StethoscopeIcon, ArrowRightIcon } from "@/components/icons"

export function AuthScreen() {
  const { enterApp } = useApp()
  const [name, setName] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    await enterApp(name)
    setLoading(false)
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-background px-5 py-12 safe-area-inset">
      <div className="w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-xl">
            <StethoscopeIcon size={38} />
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">MedNexus</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Premium clinical Q-Bank for medical learners.
          </p>
        </div>

        {/* Onboarding card */}
        <div className="rounded-3xl border border-border bg-card p-7 shadow-2xl">
          <h2 className="mb-1 text-xl font-semibold tracking-tight">Welcome</h2>
          <p className="mb-6 text-sm text-muted-foreground leading-relaxed">
            What should we call you? Your progress will sync to the cloud automatically.
          </p>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-muted-foreground" htmlFor="name-input">
                Your name
              </label>
              <input
                id="name-input"
                type="text"
                autoFocus
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Dr. Jane Doe"
                className="w-full rounded-xl border border-input bg-background px-4 py-3 text-base outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/30"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="mt-1 flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3.5 text-sm font-semibold text-primary-foreground shadow-sm transition-opacity hover:opacity-90 active:opacity-80 disabled:opacity-60"
            >
              {loading ? "Setting up…" : "Enter MedNexus"}
              {!loading && <ArrowRightIcon size={16} />}
            </button>
          </form>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            No sign-up required. Progress syncs to the cloud on this device.
          </p>
        </div>
      </div>
    </main>
  )
}
