---
name: Visual Layer Architecture
description: 3-layer visual stack — ThematicCanvas, GlassCard, children. Rules for dark/light CSS, z-index, and Layer 3 opacity guarantee.
---

## Layer stack (bottom → top)
1. **ThematicCanvas** — `fixed inset-0 z-index:-10`, provides `var(--background)` + 5 animated orbs. Mounted once in `app/page.tsx` as first child of ThemeProvider.
2. **GlassCard** — `components/ui/glass-card.tsx`, applies `.gc-glass` or `.gc-solid` CSS class.
3. **Children** — always 100% opaque (Layer 3 Rule — see below).

## GlassCard API
```tsx
<GlassCard className="rounded-2xl p-6">…</GlassCard>
<GlassCard variant="glass" as="section">…</GlassCard>   // always glass
<GlassCard variant="solid">…</GlassCard>                 // always solid
```
Also exports `useGlassClass(variant?)` hook for elements that can't use GlassCard directly.

## CSS classes (globals.css @layer utilities)
- `.gc-glass` — `backdrop-filter: blur(48px) saturate(1.6)` + `light-dark()` background/border/shadow + `isolation: isolate`
- `.gc-solid` — `background: var(--card)` + `border: 1px solid var(--border)` + `isolation: isolate`

## Light/dark awareness
The project uses CSS `color-scheme` property (set per `[data-theme]` block) with CSS `light-dark()` function — NOT Tailwind `dark:` prefix. Tailwind dark: requires a `.dark` class which is never added.

**Why:** MedNexus themes each declare `color-scheme: light` or `color-scheme: dark`. This makes `light-dark(lightVal, darkVal)` work automatically for any theme without JS.

## Layer 3 Rule — children always opaque
- `background: rgba(255,255,255,0.15)` sets **background-color alpha** — does NOT cascade to children.
- We never use `opacity: 0.x` on GlassCard wrapper (that would cascade).
- `isolation: isolate` creates a fresh stacking context so no parent filter bleeds into children.

## Background stripping
All full-page layout wrappers had `bg-background` removed (ThematicCanvas provides it):
- `app/layout.tsx` body and html
- `mednexus-app.tsx` root divs (loading, quiz, main)
- `auth-screen.tsx` main wrapper
- `@layer base body` rule changed to text-foreground only

Input fields keep their `bg-background` — intentional.

## ThematicCanvas CSS vars
Each `[data-theme]` block defines `--canvas-orb-1` and `--canvas-orb-2` using `color-mix(in oklch, …)`. These drive the 5 animated orb divs. All 11 themes covered including legacy liquid-glass-light/dark.
