import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Kachi — 财经英语学习",
        short_name: "Kachi",
        description: "面向中文用户的财经英语学习应用。",
        theme_color: "#f5f1e9",
        background_color: "#f5f1e9",
        display: "standalone",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable",
          },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json}"],
      },
    }),
  ],
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
