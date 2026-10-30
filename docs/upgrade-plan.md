# Kachi backlog

> Only lists what is **not done yet**. Finished work leaves no trace here — it lives in the code or in the git history.

## Structural background

The art system uses external image files plus a manifest: `public/art/{id}.webp` with `content/art-manifest.json`, where `src/art-assets.ts` owns the size mapping and `art.test.ts` asserts that every concept id has a file. That shape is deliberate, because hand-drawn art does not scale: at 238 concepts, 172 generated illustrations coexist with 40 hand-drawn ones (hand-drawn wins where both exist). Keep this shape when changing the art pipeline again.

## 1. Product differentiation

### Pre-generating example-sentence audio (optional)

Headword audio is already pre-generated with fish.audio (201 words × US/UK = 6MB, `scripts/generate-audio.mjs`). Example sentences still go through runtime synthesis: they are roughly 8× longer, so pre-generating everything would push the offline bundle from 9MB to 26MB.

To add it, extend the same script. Network caveat: this machine's DNS returns a poisoned address for `api.fish.audio`, so the script resolves through Cloudflare DoH itself and issues requests with `--resolve`. Do not switch it to system resolution. The free model is only `s2.1-pro-free`.

## 2. Content

### Adding a pack

The six-tier plan is fully shipped (T1 42 / T2 49 / T3 38 / T4 37 / T5 32 / T6 40 — 238 concepts). To extend further:

1. Check the word list against a corpus first — every word must appear in its target corpus (the corpus gate in `scripts/validate-content.mjs` enforces this).
2. Write `UNITS` / `CONCEPTS` / `EN` + `SOURCES` in `content/packs/<id>/source.mjs`.
3. `pnpm generate:course --pack <id>` produces the bilingual `course.json`.
4. `pnpm generate:art --pack <id>` produces the illustrations (about 2–4 minutes each).
5. Register it in `content/packs/index.json` and add a chunk to `LOADERS` in `src/course.ts`.

**Provenance attaches automatically**: `SOURCES` registers real articles (with `file` pointing at the corpus) and the generator matches with the same `corpusHasTerm`. Textbooks and papers map explicitly through `CITES` (no `file` needed). Do not register roundups or original demo copy as sources — they create a false impression of having a citation.

## Explicitly not doing

| Not doing                                     | Why                                                                                                                                                                                                                     |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Dark mode                                     | Ink-on-paper "notebook" _is_ the brand (decision 2026-10-04). Revisit only with a real night-reading use case                                                                                                           |
| FSRS adaptive scheduling                      | The fixed ladder [1,3,7,14,30,60] and an adaptive system show no difference at this scale. Revisit when there are many more packs                                                                                       |
| Replacing the chord diagram with a star graph | The chord diagram expresses word-to-word confusion, which is the differentiator. A star graph only expresses mastery. They coexist; neither replaces the other                                                          |
| Replacing hand-drawn SVG with AI art          | 172 generated illustrations currently coexist with 40 hand-drawn ones (hand-drawn wins). The two-palette discipline in `art.tsx` is the brand itself                                                                    |
| Adding a native shell                         | Web Push is the first genuine backend requirement                                                                                                                                                                       |
| Re-ordering the T6 question bank              | Re-checked: every lesson has ≥3 question types, 9.0 questions per lesson, and a median of 6 exposures per word — structurally compliant. The 15 `hedge` occurrences come from the course throughline, not from a defect |

---

中文版见 [upgrade-plan.zh-CN.md](upgrade-plan.zh-CN.md)。
