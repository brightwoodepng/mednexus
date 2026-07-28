# MedNexus Cosmetic Design Specification

## Purpose

MedNexus cosmetics should feel native to a clinical learning environment: precise, legible, and grounded in recognizable medical instruments, materials, imaging, physiology, or anatomy. This specification governs the visual language and review criteria for all future cosmetic concepts, including titles, frames, highlights, avatars, and effects.

Cosmetics must decorate content without obscuring identity, status, scores, controls, or other clinically relevant information. Rarity increases expressive depth, not visual noise.

## Palette

| Token | Hex | Intended role |
| --- | --- | --- |
| Monitor phosphor | `#53F6C3` | Vital-sign traces, healthy/active states, and precise luminous detail |
| Surgical cobalt | `#2D6FE8` | Primary structure, instrument surfaces, and authoritative accents |
| Oxygen cyan | `#36CFF2` | Airflow, scanning, cooling light, and secondary data signals |
| Arterial coral | `#FF5C6C` | Heartbeat, perfusion, urgent emphasis, and reactive states |
| Iodine amber | `#F5A524` | Warm contrast, antiseptic references, and cautionary detail |
| Theatre navy | `#071827` | Deep clinical ground, shadow, and high-contrast backdrop |

Use the palette intentionally rather than as a rainbow. A cosmetic should establish one dominant accent, with additional colors reserved for information, depth, or rarity behavior. Color alone must not communicate state; preserve readable contrast and pair state changes with shape, position, texture, or motion.

## Material vocabulary

Cosmetic surfaces should be interpreted through this approved material vocabulary:

- **Brushed surgical steel** — directional grain, cool reflection, clean machined edges.
- **Frosted diagnostic glass** — diffused translucency, controlled blur, and etched markings.
- **Translucent medical polymer** — molded depth, soft internal highlights, and sterile clarity.
- **Monitor phosphor** — crisp emissive traces with short, purposeful persistence.
- **Illuminated scan film** — layered radiographic density, backlighting, and diagnostic framing.
- **Engraved anatomy plates** — precise line work, restrained relief, and archival clinical detail.

Materials should remain identifiable at the cosmetic's actual display size. Avoid combining materials merely to signal expense; each material must reinforce the cosmetic's medical source and hierarchy.

## Motion vocabulary

Motion must communicate a medical or instrumental idea, not exist as ambient spectacle.

- **Heartbeat pulse** — a measured contraction or ECG-like cadence.
- **Monitor sweep** — a directional trace that reveals or refreshes information.
- **Diagnostic scan** — a deliberate pass that inspects, resolves, or exposes a layer.
- **Cellular drift** — slow, bounded particulate movement suggesting microscopic suspension.
- **Fluid flow** — continuous, directed movement inspired by perfusion or infusion.
- **Neural firing** — brief, branching impulses with a clear origin and decay.
- **Instrument aperture** — mechanical opening, focusing, or shuttering.
- **Light refraction** — restrained bending or splitting through clinical glass or polymer.

Motion should be calm enough for repeated use, should not compete with quiz interactions, and must avoid rapid flashing. Animation timing, amplitude, and layering should scale with rarity according to the rules below.

## Rarity behavior

Rarity describes behavioral complexity, not just brightness, saturation, or particle count.

| Rarity | Required behavior |
| --- | --- |
| **Common** | Primarily static, using one accent. Form, material, and silhouette carry the concept. |
| **Rare** | Adds a subtle hover or focus response while remaining static at rest. |
| **Epic** | Uses one controlled ambient animation with low amplitude and a clear medical purpose. |
| **Legendary** | Uses layered animation plus a meaningful state reaction, such as selection, success, or status change. |
| **Mythic** | Uses a signature animation plus restrained pointer interaction; the interaction enhances depth or diagnostic behavior without chasing the pointer or impairing control. |

Higher rarities inherit the discipline of lower tiers. They do not require constant motion in every layer, and state reactions must be triggered by real interface states rather than arbitrary loops.

## Rejected generic concepts

Do not approve the following concepts in generic form:

- plain fire
- generic lightning
- outer-space nebula
- generic gold ring
- unexplained neon glow

These motifs are permitted only when given a specific, legible medical reinterpretation. The reinterpretation must change more than the name: its form, material, motion, and behavior must derive from a medical source. For example, a glow may represent monitor phosphor persistence, and branching light may represent neural firing; a conventional neon aura or fantasy lightning effect is still out of scope.

## Required cosmetic brief

Every future cosmetic proposal and implementation must document all of the following before approval:

1. **Medical source** — the specific instrument, physiological process, imaging technique, material, or anatomical reference that grounds the concept.
2. **Material** — the approved material vocabulary used and how its surface qualities appear at production size.
3. **Motion purpose** — what each animation communicates, why it moves, and how that behavior matches the assigned rarity.
4. **Reduced-motion state** — the static or simplified replacement shown when `prefers-reduced-motion: reduce` is active. Essential state feedback must remain available without animation.
5. **Readable contexts** — the backgrounds, themes, component sizes, interaction states, and placements where the cosmetic remains recognizable and content remains legible.

A proposal missing any field is incomplete. Review cosmetics at their smallest supported size, on both light and dark surfaces when applicable, at rest and in every interactive state. If the medical source cannot be recognized without explanatory copy, revise the visual treatment rather than relying on the name alone.

## Avatar asset contract

Every new avatar must begin as transparent **1024×1024 master artwork**. Keep all meaningful artwork inside a consistent **12% outer safe area** on every edge, and use a consistent focal-point position so that the subject does not jump when users switch avatars. The focal point is recorded as normalized `x` and `y` coordinates from `0` (top/left) to `1` (bottom/right).

Masters must contain **no embedded text**, **no baked-in rarity border**, and **no baked-in background glow**. Frames, rarity treatments, and glow belong to the interface so they can respond correctly to theme, equipment, accessibility preferences, and product changes. The silhouette and important clinical details must remain highly readable at **40×40, 64×64, and 128×128** pixels.

Publish at least one optimized **WebP or AVIF derivative** alongside the lossless master; provide multiple sizes when doing so avoids downloading an oversized image. Every avatar also requires an accessible fallback icon or initials for missing, disabled, or failed artwork.

### Avatar manifest

`lib/avatar-manifest.ts` is the canonical inventory for avatar presentation. Each entry must contain:

- a stable **ID** matching the store/equipment ID;
- the lossless **source asset** path;
- all **optimized asset variants**, including format and pixel size;
- normalized **focal-point coordinates**;
- a concise, meaningful **alt label**;
- the avatar's **rarity**; and
- its **preview background preference** (`light`, `dark`, or `neutral`).

Do not add an avatar to the store until its manifest entry and optimized derivative are present. Derivative entries may point to the framework image optimizer, which negotiates WebP or AVIF at request time; generated binary output must not be checked into this repository. Renderers must declare intrinsic `width` and `height` to prevent layout shift, lazy-load artwork in store grids, and eagerly load only the currently selected preview.

### Pre-publication inspection

Before publishing any new avatar, inspect the production derivatives—not only the master—against every context below:

- light surfaces;
- dark surfaces;
- an equipped avatar frame;
- leaderboard rows and podiums;
- multiplayer lobbies; and
- small-mobile layouts, including the 40×40 minimum rendering.

Approval requires a clean crop, stable focal point, recognizable silhouette, sufficient foreground contrast, an unobscured frame, and a working accessible fallback in every context.
