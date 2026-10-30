# Kachi vocabulary system

**English** · [简体中文](vocabulary-system.zh-CN.md)

Kachi teaches finance English through **confusable word pairs**. This document
describes how the word list is organised, how the content is verified, and how
to add a pack. Current counts come from `content/packs/index.json`; that
registry is the single source of truth.

## 1. Six packs, layered by what you read

Layers follow _what you are reading_, not _which discipline a word belongs to_.
Each layer has one explicit acceptance sentence: what you can read when it is
done.

| Pack                             | Concepts | Lessons | Acceptance                                                                 |
| -------------------------------- | -------: | ------: | -------------------------------------------------------------------------- |
| T1 · Read the finance front page |       42 |      21 | Open any finance app's first screen and understand every headline          |
| T2 · Read an earnings release    |       49 |      21 | Read a quarterly earnings bulletin and know whether it is good or bad news |
| T3 · Bonds and rates             |       38 |      21 | Follow bond-market news — yields, auctions, maturities                     |
| T4 · FX and macro                |       37 |      21 | Understand news about exchange rates, central banks and policy             |
| T5 · Research and quant          |       32 |      18 | Spot where a backtest conclusion does not hold up                          |
| T6 · Borrow and hedge            |       40 |      23 | Read private-bank and structured-product material                          |

**238 concepts / 201 unique words / 6 packs / 125 lessons.**

Word lists live in `content/packs/<id>/source.mjs` under `UNITS` and `CONCEPTS`.
Read them there rather than here; a copy in prose goes stale.

T5 pairs its terms with an audit question type: every word it teaches names a
specific way of fooling yourself, so the vocabulary and the exercise pull in the
same direction.

## 2. Confusion pairs carry a type

`mixUp` is the core mechanism — the chord diagram, mastery scheduling and
practice pool all build on it. A pair only earns its place if the two words
would genuinely be confused, so every pair names why:

| Type        | Criterion                                     | Example                                   |
| ----------- | --------------------------------------------- | ----------------------------------------- |
| `opposite`  | Two ends of one dimension                     | `supply` / `demand`, `hike` / `cut`       |
| `coexist`   | Appear in one sentence, easy to swap          | `profit` / `revenue`, `margin` / `markup` |
| `hierarchy` | One is a subtype of the other                 | `option` / `derivative`                   |
| `form`      | Similar spelling or shared root               | `principal` / `principle`                 |
| `timing`    | One action at different moments               | `ex-dividend` / `record date`             |
| `scope`     | One total versus one ratio or per-unit figure | `profit` / `margin`                       |
| `direction` | Opposite ends of a movement                   | `appreciate` / `depreciate`               |

This matters because mastery is counted per pair: `consecutiveCorrect` records
how many times in a row you got _this pair_ right. On a pair that is merely
topically adjacent, that number would measure "you memorised two unrelated
definitions" rather than "you no longer confuse them".

`validateCourse` rejects a `mixUpType` outside this list. The teach card renders
the label directly, so an unlisted value would otherwise render nothing.

## 3. Cross-pack deduplication

Of the 238 concepts, 201 are unique words: 37 entries repeat a word already
taught in an earlier pack.

Rules:

1. **Teach where it first appears.** Later packs show it only as a review item,
   and mastery is shared across packs through the same concept id.
2. `contentVersion` is per pack, but the mastery key is `pairIdForConcepts`, so
   it is reusable across packs by construction.
3. The pack-selection screen shows "N words already learned", so a learner knows
   the pack is not entirely new.

## 4. Two authoring gates

Both exist because the failure mode is not "the wrong words were chosen" but
"nothing checked the words".

1. **Every word must appear in its target corpus.** `scripts/validate-content.mjs`
   reads `content/corpus/<pack>.txt` and requires each `concept.term` to hit at
   least once. A word with no corpus either gets corpus added or an explanation
   of why it is taught anyway.
2. **Every confusion pair must declare a type.** An empty `mixUpType` is
   rejected, which forces the author to answer "why would these two be
   confused" rather than "they share a topic".

`validate-content` also holds the two locales structurally identical — same
ids, exercise types, answers, pairings — so one locale cannot drift from the
other. It reuses the app's own `validateCourse` rules rather than a hand-rolled
subset, so a pack cannot pass CI while violating course rules at runtime.

**Acceptance criterion:** once T1 is available, sample 20 real finance headlines
from that day and have someone who finished T1 judge each one "understood / not
understood". The hit rate should be at least 90%.

## 5. Adding a pack

1. Check the word list against a corpus first; the gate rejects words that never
   appear.
2. Write `UNITS` / `CONCEPTS` / `EN` / `SOURCES` in
   `content/packs/<id>/source.mjs`.
3. `pnpm generate:course --pack <id>` produces the bilingual `course.json`.
4. `pnpm generate:art --pack <id>` produces the illustrations (2–4 minutes each).
5. Register it in `content/packs/index.json` and add a chunk to `LOADERS` in
   `src/course.ts`.

Provenance attaches automatically: `SOURCES` registers real articles with `file`
pointing at the corpus, and the generator matches them with the same
`corpusHasTerm`. Textbooks and papers map explicitly through `CITES`. Do not
register roundups or original demo copy as sources — they create a false
impression of having a citation.

The `termZh` map in `localization.ts` is global and keyed by concept id, which is
unique by construction, so a new pack needs no change there.
