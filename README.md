# Kachi

Finance-English learning PWA: offline-capable course flow with vocabulary,
quizzes, and shareable progress cards. Content lives in `content/` and is
validated at build time.

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
- Dark mode is deliberately not implemented: the ink-on-paper "notebook" look
  is the brand (decided 2026-10-04). Revisit only with a real night-reading
  use case, not "because it's missing".
