import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedNexus Clinical Study",
    short_name: "MedNexus",
    description: "Clinical MCQ and Theory study for medical students.",
    start_url: "/",
    display: "standalone",
    background_color: "#071f20",
    theme_color: "#0f766e",
    orientation: "portrait-primary",
    icons: [
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  }
}
