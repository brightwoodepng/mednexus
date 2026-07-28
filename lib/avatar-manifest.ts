import type { CosmeticRarity } from "@/lib/economy"

export type AvatarPreviewBackground = "light" | "dark" | "neutral"

export interface AvatarManifestEntry {
  id: string
  sourceAsset: string
  optimizedAssets: ReadonlyArray<{
    width: 128 | 256
    height: 128 | 256
    src: string
    format: "webp-or-avif"
    quality: number
  }>
  focalPoint: Readonly<{ x: number; y: number }>
  altLabel: string
  rarity: CosmeticRarity
  previewBackgroundPreference: AvatarPreviewBackground
  fallbackIcon: string
}

const avatar = (
  id: string,
  file: string,
  altLabel: string,
  rarity: CosmeticRarity,
  previewBackgroundPreference: AvatarPreviewBackground,
  fallbackIcon: string,
): AvatarManifestEntry => {
  const sourceAsset = `/avatars/${file}.png`
  const optimizedAsset = (size: 128 | 256) => ({
    width: size,
    height: size,
    src: `/_next/image?url=${encodeURIComponent(sourceAsset)}&w=${size}&q=82`,
    format: "webp-or-avif" as const,
    quality: 82,
  })

  return {
    id,
    sourceAsset,
    optimizedAssets: [optimizedAsset(128), optimizedAsset(256)],
    focalPoint: { x: 0.5, y: 0.5 },
    altLabel,
    rarity,
    previewBackgroundPreference,
    fallbackIcon,
  }
}

/** Canonical asset and presentation metadata for every purchasable avatar. */
export const AVATAR_MANIFEST = {
  avatar_scrub_tech: avatar("avatar_scrub_tech", "scrubs", "Clinician wearing blue surgical scrubs", "rare", "light", "ST"),
  avatar_coffee_drip: avatar("avatar_coffee_drip", "coffee-iv", "Coffee-filled intravenous drip bag", "rare", "light", "CD"),
  avatar_lab_rat: avatar("avatar_lab_rat", "lab-rat", "Laboratory rat wearing goggles and a white coat", "epic", "neutral", "LR"),
  avatar_night_shift: avatar("avatar_night_shift", "night-shift", "Night-shift clinician holding a flashlight", "epic", "light", "NS"),
  avatar_gold_steth: avatar("avatar_gold_steth", "gold-steth", "Golden clinical stethoscope", "legendary", "dark", "GS"),
  avatar_plague_doctor: avatar("avatar_plague_doctor", "plague-doctor", "Historical plague doctor mask", "legendary", "light", "PD"),
  avatar_cyber_surgeon: avatar("avatar_cyber_surgeon", "cyber-surgeon", "Futuristic cyber surgeon", "legendary", "dark", "CS"),
  avatar_ascended: avatar("avatar_ascended", "ascended", "Ethereal ascended healer", "mythic", "dark", "AH"),
  avatar_marble: avatar("avatar_marble", "marble", "Classical marble physician figure", "mythic", "dark", "MH"),
  avatar_vital_sign: avatar("avatar_vital_sign", "vital-sign", "Living electrocardiogram waveform", "mythic", "dark", "VS"),
} as const satisfies Readonly<Record<string, AvatarManifestEntry>>

export function getAvatarManifestEntry(id: string): AvatarManifestEntry | undefined {
  return AVATAR_MANIFEST[id as keyof typeof AVATAR_MANIFEST]
}
