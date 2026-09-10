import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MedNexus Clinical Study",
    short_name: "MedNexus",
    description: "Clinical MCQ and Theory study for medical students.",
    start_url: "/",
    display: "standalone",
    background_color: "#071c24",
    theme_color: "#071c24",
    orientation: "portrait-primary",
    icons: [
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/icon-192x192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512x512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
