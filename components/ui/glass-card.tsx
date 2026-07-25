"use client"

/**
 * GlassCard — reusable Liquid Glass surface (Layer 2 in the visual stack).
 *
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  Visual layer stack (bottom → top)                                  │
 * │  Layer 1 — ThematicCanvas   fixed, z-index -10, animated orbs       │
 * │  Layer 2 — GlassCard        this component, refracts the canvas     │
 * │  Layer 3 — Children         text, icons, buttons — 100% opaque      │
 * └─────────────────────────────────────────────────────────────────────┘
 *
 * Layer 3 Rule guarantee:
 *   Background transparency is achieved with background-color alpha
 *   (bg-white/15) NOT with `opacity`.  CSS opacity cascades to children;
 *   background-color alpha does NOT.  Children are always fully opaque.
 *   `isolation: isolate` (via the .glass-surface CSS utility) also
 *   creates a fresh stacking context so no parent filter leaks into children.
 *
 * Usage:
 *   // Glass or solid, auto-detected from global isGlassEnabled state:
 *   <GlassCard className="rounded-2xl p-6">…</GlassCard>
 *
 *   // Override variant explicitly:
 *   <GlassCard variant="glass" className="rounded-xl p-4">…</GlassCard>
 *   <GlassCard variant="solid" className="rounded-xl p-4">…</GlassCard>
 *
 *   // Render as a different HTML element:
 *   <GlassCard as="section" className="rounded-3xl p-8">…</GlassCard>
 *   <GlassCard as="article" className="rounded-2xl p-5">…</GlassCard>
 */

import { useTheme } from "@/contexts/theme-context"
import { cn } from "@/lib/utils"
import {
  type ElementType,
  type ComponentPropsWithoutRef,
  type ReactNode,
  forwardRef,
} from "react"

// ── Types ────────────────────────────────────────────────────────────────────

type GlassCardVariant = "auto" | "glass" | "solid"

type GlassCardOwnProps<E extends ElementType> = {
  /** Content rendered inside. Always fully opaque (Layer 3 Rule). */
  children?: ReactNode
  /** Extra Tailwind classes (padding, rounding, size, etc.). */
  className?: string
  /**
   * Visual variant:
   * - `"auto"` (default) — reads `isGlassEnabled` from ThemeContext
   * - `"glass"`          — always renders glass regardless of global state
   * - `"solid"`          — always renders solid regardless of global state
   */
  variant?: GlassCardVariant
  /** HTML element to render as. Defaults to `"div"`. */
  as?: E
}

type GlassCardProps<E extends ElementType = "div"> = GlassCardOwnProps<E> &
  Omit<ComponentPropsWithoutRef<E>, keyof GlassCardOwnProps<E>>

// ── Component ────────────────────────────────────────────────────────────────

// Inner impl — forwardRef with generic polymorphism requires a cast trick.
function GlassCardInner<E extends ElementType = "div">(
  {
    as,
    variant = "auto",
    className,
    children,
    ...rest
  }: GlassCardProps<E>,
  ref: React.Ref<Element>,
) {
  const { isGlassEnabled } = useTheme()

  const useGlass =
    variant === "glass" || (variant === "auto" && isGlassEnabled)

  const Tag = (as ?? "div") as ElementType

  return (
    <Tag
      ref={ref}
      {...rest}
      className={cn(
        // Glass class adds only the overlay; solid mode preserves caller classes (see
        // globals.css for the full spec — no opacity prop is used here so
        // children are never made translucent by this wrapper).
        useGlass ? "glass-surface" : undefined,
        className,
      )}
    >
      {children}
    </Tag>
  )
}

// Cast so TypeScript accepts the generic forwardRef signature.
export const GlassCard = forwardRef(GlassCardInner) as <
  E extends ElementType = "div",
>(
  props: GlassCardProps<E> & { ref?: React.Ref<Element> },
) => ReturnType<typeof GlassCardInner>

// ── Hook convenience ─────────────────────────────────────────────────────────

/**
 * Returns the correct CSS class name string for the current glass state.
 * Use this when you need to inline the glass/solid class into a component
 * that cannot use GlassCard directly (e.g. a <tr>, <li>, or SVG wrapper).
 *
 * @example
 * const glassClass = useGlassClass()
 * return <li className={cn(glassClass, "rounded-xl p-3")}>…</li>
 */
export function useGlassClass(variant: GlassCardVariant = "auto"): string {
  const { isGlassEnabled } = useTheme()
  const useGlass =
    variant === "glass" || (variant === "auto" && isGlassEnabled)
  return useGlass ? "glass-surface" : ""
}
