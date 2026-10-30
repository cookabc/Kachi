import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        id: "/",
        name: "Kachi — Financial English",
        short_name: "Kachi",
        description: "Offline financial English practice in English and Chinese.",
        lang: "en-US",
        theme_color: "#fff8ec",
        background_color: "#fff8ec",
        display: "standalone",
        icons: [
          {
            src: "/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any",
          },
          {
            src: "/icon-maskable-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable",
          },
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any",
          },
        ],
      },
      workbox: {
        // Art is 42+ generated images per pack; without webp here they would be
        // fetched on every cold start instead of living in the offline bundle.
        // Audio is 402 term clips (6MB). Without mp3 here the clips would be
        // re-fetched on every cold start instead of living in the offline bundle.
        globPatterns: ["**/*.{js,css,html,svg,json,woff2,webp,png,mp3}"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
