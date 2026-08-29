import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  root: "apps/web",
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      manifest: {
        name: "Kachi — 财经英语学习",
        short_name: "Kachi",
        description: "面向中文用户的财经英语学习应用。",
        theme_color: "#58CC02",
        background_color: "#E8F7FF",
        display: "standalone",
        icons: [
          {
            src: "/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any maskable"
          }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,json}"]
      }
    })
  ],
  resolve: {
    alias: {
      "@kachi/domain": fileURLToPath(new URL("./packages/domain/src/index.ts", import.meta.url)),
      "@kachi/learning-engine": fileURLToPath(new URL("./packages/learning-engine/src/index.ts", import.meta.url)),
      "@kachi/content-schema": fileURLToPath(new URL("./packages/content-schema/src/index.ts", import.meta.url))
    }
  },
  build: {
    outDir: "../../dist",
    emptyOutDir: true
  },
  test: {
    environment: "jsdom",
    include: ["../../packages/**/*.test.ts", "src/**/*.test.ts", "src/**/*.test.tsx"]
  }
});
