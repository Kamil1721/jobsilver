import type { MetadataRoute } from "next"

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "JobSilver",
    short_name: "JobSilver",
    description: "A focused workspace for discovering, preparing, and tracking job applications.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#FFFDFB",
    theme_color: "#FFFDFB",
    icons: [
      {
        src: "/jobsilver-mark-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/jobsilver-mark-512.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  }
}
