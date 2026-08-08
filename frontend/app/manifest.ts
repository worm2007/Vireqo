import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Vireqo",
    short_name: "Vireqo",
    description: "AI CRM workspace for smarter lead follow-ups.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f5ef",
    theme_color: "#163a2d",
    icons: [
      {
        src: "/icon.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
    ],
  };
}
