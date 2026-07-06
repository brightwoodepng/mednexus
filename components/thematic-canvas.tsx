/**
 * ThematicCanvas — Layer 1: The Thematic Background
 *
 * A fixed, full-viewport layer at z-index -10 (behind all application content).
 * Renders the base background colour (var(--background)) plus five animated
 * soft-glow orbs whose colours are driven entirely by CSS custom properties
 * (--canvas-orb-1 and --canvas-orb-2) defined per data-theme in globals.css.
 *
 * No JavaScript animation — everything is pure CSS keyframes, so this is
 * zero runtime overhead. When the active theme changes, the orbs cross-fade
 * to the new palette via CSS transitions.
 *
 * Glass-mode foreground components (sidebar, cards, modals) refract this layer
 * through their backdrop-filter: blur() rule, producing the Liquid Glass effect.
 */
export function ThematicCanvas() {
  return (
    <div aria-hidden="true" className="thematic-canvas">
      {/* Orb A — large primary bloom, anchored top-left */}
      <div className="canvas-orb canvas-orb-a" />
      {/* Orb B — large primary bloom, anchored bottom-right */}
      <div className="canvas-orb canvas-orb-b" />
      {/* Orb C — secondary accent, anchored top-right */}
      <div className="canvas-orb canvas-orb-c" />
      {/* Orb D — secondary whisper, anchored bottom-left */}
      <div className="canvas-orb canvas-orb-d" />
      {/* Orb E — centre depth glow for atmosphere */}
      <div className="canvas-orb canvas-orb-e" />
    </div>
  )
}
