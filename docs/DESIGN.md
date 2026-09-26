# Kachi — Design System

**Status:** matches the React implementation (`src/`) as of 25 Sep 2026; the Contrast Lab direction replaces the game-map visual layer.
This document describes what is actually built, so future changes have a baseline to push against.

The product thesis lives in the [PRD](PRD.md). This document covers the visual and interaction layer only.

---

## 1. Feel

Contrast Lab: a field notebook for learning the difference between ideas that sound alike. The visual language is editorial and calm, with one decisive action per screen.

- Warm paper, deep ink blue, coral signals, and restrained mint feedback.
- Serif display for concepts and course names; sans-serif for instruction; monospaced labels for numbering and progress.
- One idea per screen. Big tap targets (options ≥ 56px tall, primary buttons 58px).
- Progress is always visible: lesson pips, course fraction, XP/streak, and hearts inside lessons. The next lesson is a full-width row and a clear primary action.

## 2. Color

| Token | Value | Use |
|---|---|---|
| `--sky` | `#F5F1E9` | paper background |
| `--card` | `#FFFDF8` | reading and choice surfaces |
| `--ink` | `#152A38` | primary text and action surface |
| `--ink-soft` | `#4B5E66` | secondary text |
| `--green` | `#2CAE9B` | correct/complete state |
| `--green-soft` | `#E0F6ED` | examples and success |
| `--yellow` | `#FF8E68` | current step and contrast signals |
| `--sky-blue` | `#70ABC8` | focus and teaching progress |
| `--heart` | `#EC695F` | hearts |
| `--wrong-bg` | `#FCE8DB` | recoverable errors |

The lesson cover uses ink blue, coral and mint directly. Units share one paper-card design and differ through number, title and progress rather than rotating gradients.

## 3. Type

- UI family: Avenir Next → PingFang SC → system sans-serif. No remote font request. Concept titles use Georgia → Songti SC → serif.
- Brand wordmark 24px/900. Course-cover terms are 46–61px serif; unit titles 21px serif. Question stems are 25px serif; teach terms use the same family.
- Kickers (MEANING, NEW WORD, UNIT 1): 11–12px, 800, uppercase, letter-spacing `.12–.14em`.
- Body never below 13px except micro-captions (11.5px glossary footer).

## 4. App shell

- Small viewports: a single 420px-max column at full `100dvh` height.
- ≥960px: an editorial guide sits beside the functioning app window. The guide offers a real next-lesson action and progress fraction; the course remains the same app, not a mockup.
- Fixed bottom nav (68px + safe-area), content scrolls between header and nav.
- Bottom nav: four real `<button>`s — Learn · Practice · Glossary · Settings. Ink-blue background, mint active label and coral position dot.

## 5. Screens

**Learn (home).** Brand + XP/streak header → ink-blue Hedge/Pledge course cover with progress and a direct next-lesson action → five numbered unit cards. Each lesson is a full-width row; done, next and locked states use a check, arrow or quiet dot. Locked rows remain disabled. This is a scannable syllabus, not a snake path.

**Lesson — teach phase.** Card per new term: hero art (168px) → **caption** (one line explaining what the artwork shows and how it maps to the mechanism) → serif term → one-sentence definition → mint example panel → warm "Don't mix this up" panel with sibling art. Unit reviews get a recap strip of pills. Progress pips use teal and coral.

**Lesson — quiz phase.** Header: × close, teal pips (coral = current), hearts. Paper prompt card: kicker by exercise type → stem → options. Feedback replaces the footer with a full-width mint or coral sheet and one-line reason. `role="status"` announces the verdict.

**Exercise rendering.**

- Meaning / scenario: 2×2 tile options, each with art (84px) + text — text is **never truncated**; long definitions shrink to 12.5px instead.
- True/false: two big tiles with ✓/✗ art.
- Fill: story with underlined blank that live-fills with the tapped bank chip.
- Match: two columns of chips; correct pairs lock green, and locking the **last pair judges the prompt immediately** as correct. A **wrong pairing judges the prompt immediately** — the sheet docks a heart and names the mix-up, and the re-shuffled match re-queues right after feedback so the player can still finish the pairs. No Check button; the prompt cannot be silently retried to 100%.

**Complete.** Confetti burst, hedgehog mascot, "Flawless." (perfect) or "Lesson done.", accuracy line, warm XP breakdown card, up to 3 "you mix these up" chips (term vs its mix-up). Buttons offer Next lesson, Practice those (only after misses), and Back to the path. Practice rounds show a per-answer XP line. The lesson stage still pairs the two terms around a ≠ stamp; the legacy artwork remains while the surrounding UI uses the Contrast Lab palette. `lessonPair(course, lessonId)` in `src/flow.ts` selects the pair.

**Fail (0 hearts).** 💔, "Out of hearts.", retry refills immediately — no wait gate, no guilt copy.

**Practice.** Hedgehog hero, miss-count line, one button. Rounds of 10 prompts ending in the complete screen; "Practice again" starts a fresh round. Hearts still apply. Practice pays +10 XP per correct answer only — no completion/perfect bonus, and it never touches the streak — so XP and streak keep measuring lessons on the path. The pool is capped at unlocked lessons; a brand-new player (no misses) drills Unit 1 Lessons 1–2 only, never content a lesson ahead.

**Glossary.** Search box (no auto-focus), compact ink-blue unit banners, paper term cards (definition, example, mix-up, teal ✓ once seen). Search updates **only the list** (IME-safe); empty state suggests starting terms. The term card's share icon opens its declared pair when seen.

**Shareable pair card (v1.1 — built 10 Sep 2026; spec amended same day).**

*Canvas.* 1080×1440 (3:4), 72px safe margin. Generated as one SVG string → Blob → `Image` → `canvas.toBlob("image/png")`. No html2canvas, no added dependency, no remote assets — it must export with the network offline.

*Composition, top to bottom.* Warm paper field with a centered ivory card (32px radius, 56px inner padding; text measure 824px). Kicker 30px/800 in the coral uppercase style: pack name · unit. Two centered terms at 88px/900 ink blue (max two lines), each followed by its one-sentence fork at 42px/700. A mint panel holds the existing `example`. The two `HERO_ART` scenes face each other across a coral ≠ stamp; the footer keeps the hedgehog and wordmark. Block gaps and adaptive text sizing remain governed by the fit algorithm below.

*Export legibility.* The scale is built for the post-tap full-screen view on a 390px-class phone (~0.36× scale), not the chat thumbnail — no card text can ever win at thumbnail size. Floors after adaptive shrink: term 72px, fork 36px, example 34px; nothing on the card ever renders below 30px. All text is 700–900 weight so recompression (WeChat and in-app browsers) cannot thin strokes into mush.

*Wrapping and fitting are layout math, not guesswork.* Term, fork, and example sizes step **together** through three sizes (88/42/38 → 80/39/36 → 72/36/34); the renderer picks the smallest size that satisfies both the per-block line caps and the 1440px vertical budget. A pure wrapping function breaks strings into `<tspan>` lines at the fixed measures above and is unit-tested against **every concept pair in both locale packs**, extremes included (22-character term, 136-character EN definition, 62-character ZH example). A pair that does not fit at the floor size fails the test — content is shortened in the data file instead of truncating silently or clipping.

*CJK typography rules (added 10 Sep 2026 after browser QA; amended 11 Sep 2026).* Original spaces between CJK and Latin are preserved ("单元 1", "一张 put"); spaces between two CJK characters are dropped. Kinsoku (避头尾): closing punctuation ，。；：？！、…」』）》〉 never starts a line — it overhangs the previous line by one character instead; opening punctuation 「『（《〈 never ends a line — it carries to the next. **Orphan balance (11 Sep 2026):** a last line under 30% of the measure is pulled back up by moving atoms (CJK per character, Latin per word) off the previous line's tail — never past the measure, never landing closing punctuation at line start. Block spacing is computed from explicit ascent (0.8em) / descent (0.25em) so glyph boxes never overlap, and the whole flow is vertically centered within the budget with the footer pinned. All five rules are pinned by unit tests across every pair in both packs.

*Entry and save UX.* Both entries open a preview sheet: the **exported PNG itself** shown as an `<img>` (not inline SVG — long-press save must work on the preview, which is the WeChat fallback path), a primary "Save image" button, a small long-press hint beneath it, and a secondary "Share…" button rendered only when `navigator.share` exists (falling back to download when `canShare` rejects files). From Complete, pairs of that lesson (or practice round) can be paged through, deduplicated by unordered pair key; Glossary opens its own declared pair directly. Triggers are real buttons with `aria-label`; the preview image carries alt text naming the pair; Escape closes the sheet.

*Chrome strings* (kicker already derives from data; "Save image", long-press hint, "Share…", pager labels, alt text, export-failure note) are added to both locale packs; no other new copy fields.

*Manual QA gate:* desktop-browser QA done 10 Sep 2026 (zh-CN + en-US cards visually inspected at full export size; pager boundaries; zero network requests during export — offline by construction). Still open: iOS Safari, Android Chrome, and WeChat's in-app browser on real devices; thumbnail legibility at ~240px wide.

*Social OG image (25 Sep 2026).* `public/og-image.png` (1200×630) is the `og:image`/`twitter:image`: an ink-blue grid, oversized serif HEDGE/PLEDGE title, coral divide, and a short concept comparison. `scripts/generate-og-image.mjs` generates it deterministically with `pnpm generate:og` and `rsvg-convert`.

## 6. Term art

- `TERM_ART` maps every term id to art: 6 terms use embedded photographic JPEGs (hedge, pledge, haircut, put, call, margin call); the rest are hand-drawn inline SVGs in the palette above. Every option also gets art via `artIdForLabel`, with aliases ("short" → short selling, "capital gain" → capital gains, …) and a party-popper `joke` fallback for joke answers.
- Sizes: `xs` 30 (inline chips) · `sm` 34 (bank chips, recap pills) · `lg` 84 (quiz tiles) · `hero` 168 (teach cards). Auto-compacts to 64px on short screens.
- Every new term *must* have a `caption` line in `TERMS` — the teach card renders it under the hero art.
- (v1.2 — built 11 Sep 2026: a second layer, `HERO_ART`, serves poster-grade scenes at hero size only — same palette and 64×64 viewBox, plus a ground shadow, a soft halo, and a second element acting out the caption. `artForSize(id, size)` resolves hero → scene → `TERM_ART` → joke; chip sizes never see scenes, so quiz tiles stay legible. Posterized batches: all five units — every published concept has a scene.)

## 7. Motion

The home syllabus has no looping motion. `heartShrink` on loss, `shake` on a wrong option, `popGood`, feedback-sheet motion and a one-shot confetti burst remain for learning feedback. `prefers-reduced-motion: reduce` collapses them to ~0ms.

Press feedback is physical: primary buttons translate down and lose shadow depth. Disabled options remain clearly inactive.

## 8. Input & accessibility

- Keyboard: `Enter` = continue/check; `1–4` pick options; `Enter` on complete/fail presses the primary CTA. Every flow is completable without a mouse.
- `:focus-visible` = 3px blue ring. Bottom nav and syllabus rows are real buttons with labels; disabled lessons cannot start.
- Feedback sheet is a live region; disabled options stay in the DOM with `disabled` so state is inspectable.
- Contrast: body text sits on opaque paper or ink-blue surfaces; accent colors identify status and action, not entire paragraphs.
- Viewports <720px tall compact tiles/art/stems so a full prompt never scrolls off-screen.

## 9. Content voice in UI chrome

- Correct: `Nice. / Exactly. / You got it. / Clean.` Wrong: `Not quite. / Mix-up. / That pair again. / Close, wrong fork.` — picked at random, one per prompt.
- Feedback always names the mix-up and states the fork ("You still own it. Pledge = collateral. Sell = it's gone.").
- No guilt copy on fail, no streak-shaming, no advice anywhere. One disclaimer, in the glossary footer only.

## 10. Known deviations from the PRD

- PRD §11's original dark green/gold sketch and the later game-map skin were superseded by the Contrast Lab direction above. The learning engine and lock rules remain unchanged.
- Hearts, XP, streak, and path lock follow the PRD's v1 table, with two deliberate tightenings: practice rounds pay per correct answer only (no +20 completion/perfect bonus, no streak — the PRD only banned path unlocking, this keeps XP meaningful), and match prompts are judged live on a first wrong pairing (hearts −1 applies to every exercise type, closing the "match is always 100%" loophole).
- Practice is 10-prompt rounds, not literally "infinite until they quit" (PRD §10). Same engine, bounded rounds; a round of drills felt better than an endless mode.
- Banana distractors are banned: three joke answers that slipped into Unit 1–2 were replaced with real sibling terms (PRD §4.2). A later sweep (10 Sep 2026) caught five more in Units 4–5 across both locales (u4rd, u4rg, u5l1c ×2, u5rb) and replaced each with its concept's declared confusion pair — e.g. buy-borrow-die's joke options now point at securities-backed loan / capital gains. The `joke` art remains only as a fallback for art lookups, never as a distractor.
- The prototype stayed a single typed HTML file (PRD §12 allowed Vite+React+TS as a recommendation, not a requirement). Content remained data (`TERMS` / `UNITS` / `LESSONS`), which kept the port to Vite + React + TS mechanical — see §11.

## 11. The React app (`src/`)

The React app implements this system on Vite + TS, rendering from
`content/packs/hedge-or-pledge/zh-CN/course.json` through `src/engine`.
Port notes and deltas:

- The course home and desktop guide are new React compositions; the lesson engine, term art, aliases and mascot remain in their existing modules. `src/styles.css` retains legacy selectors for those modules and adds the Contrast Lab layer for all active screens.
- UI chrome is Chinese (the rewrite's shipped direction): verdicts 「不错。/ 正是。/ 答对了。/ 漂亮。」 and 「还差一点。/ 混淆了。/ 又是这一对。/ 岔路走反了。」 replace the English §9 pools; kickers, buttons, and screen copy are translated. Course content (stems, options, whys, captions, examples) stays English — 中文界面、英文术语教学. Teach cards and feedback sheets add the term's Chinese definition / 辨析 line from `localization.ts` under the English copy.
- A fourth nav tab, 设置 (export/import learner data, privacy copy), exists beyond the prototype's three tabs.
- No remote font loading. UI type uses installed Avenir Next/PingFang SC fallbacks; serif concept titles use Georgia/Songti SC fallbacks.
- Engine deltas that back the ported behavior: the +20 no-mistake bonus and the hearts-gated finish live in `src/engine` (`applyAnswer` with `heartsAfter`; a failed finish never completes the lesson), and a failed match re-queues itself via `requeuePrompt`. The practice focus set (recent misses ∪ due confusion pairs) derives from the attempt log via `recentMissTermIds`.
- Single display language (29 Aug 2026): the zh-CN course pack is native Chinese — stems, stories, options, whys, captions, examples, lesson titles, and unit blurbs are translated; the English terms themselves stay English (hedge, put, margin call) because the terms ARE the learning target, with 中文译名 as subtitles on teach cards and in the glossary. `localization.ts` carries only the term-name map, and the old bilingual helper lines are gone.
- Bundling and persistence details (24 Sep 2026): the zh-CN pack ships in the main bundle and the en-US pack loads as a lazy chunk on first language switch (`loadCourse` in `src/course.ts`) — the service worker precaches the chunk, so a stored en-US preference still resolves offline after the first online visit; if that chunk cannot be fetched, the app falls back to the zh pack and resets the interface language so strings and course never disagree. IndexedDB holds one reused connection per page (dropped on `versionchange`), and the event store only writes attempt events it has not persisted yet; learner state is saved from a single effect after every committed change, so state updaters stay pure. The screen components live in `src/screens/` with shared chrome in `src/chrome.tsx`; `App.tsx` keeps the session state machine.
