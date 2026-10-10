# Kachi

Finance-English learning PWA: offline-capable course flow with vocabulary,
quizzes, and shareable progress cards. 40 finance concepts across 23 lessons,
208 quiz questions and a concept graph; no account — everything stays on
device. Live at [kachi-game.vercel.app](https://kachi-game.vercel.app).
Content lives in `content/` and is validated at build time.

<p align="center">
  <img src="docs/images/home.png" width="880" alt="Kachi home: lesson view on the left, course progress and learning path on the right">
</p>

## Commands

```bash
pnpm install
pnpm run dev      # vite dev server
pnpm run test     # vitest
pnpm run check    # biome + content validation + tsc + vitest + vite build (PWA)
```

## Notes

- The service worker precaches the app shell; the English course pack loads
  lazily — keep behavior changes reflected in the build output, not just source.
- CI (`.github/workflows/ci.yml`) runs `pnpm run check` on every push/PR.
- Pre-commit hook (lefthook) runs biome on staged files.
- `public/icon.svg` is the source of truth for app icons. `pnpm run generate:icons`
  (needs `rsvg-convert`) regenerates the PNG variants the manifest and iOS
  apple-touch-icon consume — commit them, like og-image.png.
- Dark mode is deliberately not implemented: the ink-on-paper "notebook" look
  is the brand (decided 2026-10-04). Revisit only with a real night-reading
  use case, not "because it's missing".

## License

MIT — see [LICENSE](LICENSE).
