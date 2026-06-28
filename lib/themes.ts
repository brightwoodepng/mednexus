export type ThemeId =
  | "clinical-light"
  | "classic-dark"
  | "midnight-purple"
  | "ocean-breeze"
  | "sandstone"
  | "rose-quartz"
  | "forest-night"
  | "solar-flare"
  | "nebula"

export interface ThemeMeta {
  id: ThemeId
  name: string
  description: string
  mode: "light" | "dark"
  swatch: { bg: string; surface: string; primary: string }
  accent: string
}

export const THEMES: ThemeMeta[] = [
  {
    id: "clinical-light",
    name: "Clinical Light",
    description: "Crisp medical white with a calm teal accent.",
    mode: "light",
    swatch: { bg: "#f4f7f8", surface: "#ffffff", primary: "#1f9aa8" },
    accent: "#1f9aa8",
  },
  {
    id: "classic-dark",
    name: "Classic Dark",
    description: "Deep slate, easy on the eyes for night study.",
    mode: "dark",
    swatch: { bg: "#1b1f27", surface: "#252a33", primary: "#34c5cf" },
    accent: "#34c5cf",
  },
  {
    id: "midnight-purple",
    name: "Midnight Purple",
    description: "Indigo depths with a vivid violet glow.",
    mode: "dark",
    swatch: { bg: "#1c1830", surface: "#262138", primary: "#9b6cf0" },
    accent: "#9b6cf0",
  },
  {
    id: "ocean-breeze",
    name: "Ocean Breeze",
    description: "Airy blues for a fresh, focused feel.",
    mode: "light",
    swatch: { bg: "#eef4fb", surface: "#fafcff", primary: "#2f6bd6" },
    accent: "#2f6bd6",
  },
  {
    id: "sandstone",
    name: "Sandstone",
    description: "Warm, low-glare amber tones for long blocks.",
    mode: "light",
    swatch: { bg: "#f5efe4", surface: "#fffdf8", primary: "#b06a3a" },
    accent: "#b06a3a",
  },
  {
    id: "rose-quartz",
    name: "Rose Quartz",
    description: "Soft blush pinks — warm and elegant.",
    mode: "light",
    swatch: { bg: "#fdf4f5", surface: "#fffcfc", primary: "#e0435e" },
    accent: "#e0435e",
  },
  {
    id: "forest-night",
    name: "Forest Night",
    description: "Deep botanical green with vivid emerald.",
    mode: "dark",
    swatch: { bg: "#122718", surface: "#192e1f", primary: "#3ddc84" },
    accent: "#3ddc84",
  },
  {
    id: "solar-flare",
    name: "Solar Flare",
    description: "Bold amber-orange for high-energy sessions.",
    mode: "light",
    swatch: { bg: "#fdf6ea", surface: "#fffdf7", primary: "#e07c1a" },
    accent: "#e07c1a",
  },
  {
    id: "nebula",
    name: "Nebula",
    description: "Cosmic deep-violet with a hot-pink glow.",
    mode: "dark",
    swatch: { bg: "#1a112b", surface: "#211637", primary: "#e8429e" },
    accent: "#e8429e",
  },
]

export const DEFAULT_THEME: ThemeId = "clinical-light"
