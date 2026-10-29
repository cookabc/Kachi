# Kachi

Finance-English learning PWA: an offline-capable course flow with vocabulary,
quizzes and shareable progress cards. **6 packs, 238 concepts, 125 lessons and
1,631 prompts** — no account, everything stays on device. Live at
[kachi-game.vercel.app](https://kachi-game.vercel.app).

The interface defaults to English; 中文 is one tap away. Content lives in
`content/` and is validated at build time.

<p align="center">
  <img src="docs/images/home.png" width="880" alt="Kachi home: lesson view on the left, course progress and learning path on the right">
</p>

The screenshot above shows the default pack (40 concepts) — the home screen always
reports the pack you are currently in, not the combined total.

## Courses

Packs unlock in level order; each pairs confusable terms so the distinction is
the lesson. Read a pack's `source.mjs` for its corpus evidence.

| Level | Pack | Focus | Concepts |
| --- | --- | --- | --- |
| 1 | `t1-finance-news` | Read the front page | 42 |
| 2 | `t2-company-earnings` | Read an earnings report | 49 |
| 3 | `t3-bonds-rates` | Bonds and rates | 38 |
| 4 | `t4-forex-macro` | FX and macro | 37 |
| 5 | `t5-quant-research` | Research and quant | 32 |
| 6 | `hedge-or-pledge` | Borrow and hedge (hand-written) | 40 |

Every pack ships in both `zh-CN` and `en-US` as separate `course.json` files;
the validator enforces structural parity between the two locales.

## Commands

```bash
pnpm install
pnpm run dev              # vite dev server
pnpm run test             # vitest
pnpm run check            # biome + content validation + tsc + vitest + vite build (PWA)
pnpm run generate:course  # regenerate content/packs/*/{zh-CN,en-US}/course.json from source.mjs
pnpm run generate:icons   # rebuild PNG icons from public/icon.svg (needs rsvg-convert)
```

## Notes

- The interface ships English by default; the stored preference is read from
  `localStorage`, and Chinese is offered in Settings.
- The **default pack** (`hedge-or-pledge`) is bundled in both locales so the
  first screen can always render offline. Every other pack is a lazy chunk the
  service worker precaches, so all courses stay available offline after one
  online visit — keep behaviour changes reflected in the build output, not just
  source.
- CI (`.github/workflows/ci.yml`) runs `pnpm run check` on every push/PR.
- Pre-commit hook (lefthook) runs biome on staged files.
- `public/icon.svg` is the source of truth for app icons; commit the generated
  PNG variants, like `og-image.png`.
- Dark mode is deliberately not implemented: the ink-on-paper "notebook" look
  is the brand. Revisit only with a real night-reading use case, not "because
  it's missing".

## License

- Code: [AGPL-3.0-only](LICENSE).
- Original course and teaching content (`content/`): CC-BY-SA-4.0.
- Third-party news quotations, links and brands keep their own rights and are
  not relicensed with the course pack.

中文说明见 [README.zh-CN.md](README.zh-CN.md)。
