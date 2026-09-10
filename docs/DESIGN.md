# Kachi — Design System

**Status:** matches the React implementation (`src/`) as of 7 Sep 2026; baseline carried over from the retired single-file prototype (27 Aug 2026).
This document describes what is actually built, so future changes have a baseline to push against.

The product thesis lives in the [PRD](PRD.md). This document covers the visual and interaction layer only.

---

## 1. Feel

Duolingo-style, light, friendly, game-first. Not a fintech dashboard, not dark-mode "serious finance."

- Cream/white cards floating on a pale sky-to-mint gradient.
- Chunky rounded type, everything bold, sentence case for content, uppercase kickers for labels.
- One idea per screen. Big tap targets (options ≥ 56px tall, primary buttons 58px).
- Progress is always visible: pips in a lesson, glowing "next" node on the path, XP/streak/hearts in the header.

## 2. Color

| Token | Value | Use |
|---|---|---|
| `--sky` | `#E8F7FF` | app background base |
| `--mint-hint` | `#D8F8EC` | app background lower half |
| `--card` | `#FFFFFF` | cards, options, nav |
| `--ink` | `#1B2E24` | primary text |
| `--ink-soft` | `#4A6B58` | secondary text |
| `--muted` | `#5F7D6E` | tertiary text (≥4.5:1 on card bg) |
| `--green` | `#58CC02` | primary action, correct, "done" |
| `--green-2` / `--green-deep` / `--green-dark` | `#89E219` / `#46A302` / `#3D8C00` | gradients, pressed/dark shades |
| `--green-soft` | `#E7FFD4` | story/example panels |
| `--yellow` / `--yellow-deep` | `#FFC800` / `#E6A100` | XP, streak, "in progress" pip, mix-up highlights |
| `--sky-blue` / `--sky-deep` | `#1CB0F6` / `#1899D6` | teach-mode progress pips, accent, focus ring |
| `--heart` / `--heart-empty` | `#FF4B4B` / `#E2E8EA` | hearts |
| `--right` / `--right-bg` | `#58CC02` / `#E3FFD1` | correct state + feedback sheet |
| `--wrong` / `--wrong-bg` / `--peach` | `#FF8A65` / `#FFE8D6` | wrong state + fail sheet (coral, never pure red) |
| `--locked` | `#EEF2F4` | locked nodes |

**Unit banner identity** (rotating so the path doesn't read as one green blob):

- Units 1, 5 → `135deg, #58CC02 → #89E219 (→ #1CB0F6 on u1)`
- Units 2, 4 → `135deg, #1CB0F6 → #58CC02`
- Unit 3 → `135deg, #89E219 → #FFC800`

Rule: green owns "go/correct," yellow owns "reward/attention," coral owns "wrong but safe to retry." Nothing else gets saturated color.

## 3. Type

- Family: `"Nunito"` (Google Fonts, 700/800/900) → `ui-rounded` → `Trebuchet MS` fallback.
- Brand wordmark 20px/800 with italic green "or". Unit banner h2 21px. Question stem 23px/800. Teach term 34px/800 as the moment of the card.
- Kickers (MEANING, NEW WORD, UNIT 1): 11–12px, 800, uppercase, letter-spacing `.12–.14em`.
- Body never below 13px except micro-captions (11.5px glossary footer).

## 4. App shell

- Single `#app` column, `max-width: 420px`, full `100dvh` height.
- ≥480px viewports: centered phone frame, 32px radius, white 3px border, floating shadow.
- Fixed bottom nav (68px + safe-area), content scrolls between header and nav.
- Bottom nav: three real `<button>`s (keyboard-focusable) — Learn · Practice · Glossary, SVG stroke icons, active = green + filled tint.

## 5. Screens

**Learn (home).** Brand + stats header (XP, streak — hearts live inside lessons only) → tagline → repeating [unit banner → vertical snake path]. Nodes are 76px circles (88px for "up next"), snake offsets `[0, 56, 8, -56]` px connected by a green/yellow dashed spine. States: done (green + ✓), next (green, bobbing, shine sweep, halo), locked (gray, 🔒, not clickable). Node labels sit in white pill badges so the dashed line never strikes through text.

**Lesson — teach phase.** Card per new term: hero art (168px) → **caption** (one line explaining what the artwork shows and how it maps to the mechanism — the image must teach, not decorate) → term 34px → one-sentence definition → green example panel → yellow "Don't mix this up" panel with the sibling term's mini art. Unit reviews get a recap strip of pills instead. Progress pips in sky blue during teach.

**Lesson — quiz phase.** Header: × close, green pips (yellow = current), hearts. White prompt card: kicker by exercise type → stem → options. Feedback replaces the footer with a full-width sheet: green "You got it." / coral "Not quite.", one-line why (always names the mix-up), Continue button. `role="status"` so screen readers announce the verdict.

**Exercise rendering.**

- Meaning / scenario: 2×2 tile options, each with art (84px) + text — text is **never truncated**; long definitions shrink to 12.5px instead.
- True/false: two big tiles with ✓/✗ art.
- Fill: story with underlined blank that live-fills with the tapped bank chip.
- Match: two columns of chips; correct pairs lock green, and locking the **last pair judges the prompt immediately** as correct. A **wrong pairing judges the prompt immediately** — the sheet docks a heart and names the mix-up, and the re-shuffled match re-queues right after feedback so the player can still finish the pairs. No Check button; the prompt cannot be silently retried to 100%.

**Complete.** Confetti burst, hedgehog mascot, "Flawless." (perfect) or "Lesson done.", accuracy line, yellow XP breakdown card, up to 3 "you mix these up" chips (term vs its mix-up). Buttons always offer the path: Next lesson (primary), "Practice those" (green, only when there were misses), "Back to the path" (ghost). Practice rounds show a per-answer XP line instead of the lesson breakdown. (v1.1 — planned: a ghost "Save pair card" action lives on this screen; see Shareable pair card below.)

**Fail (0 hearts).** 💔, "Out of hearts.", retry refills immediately — no wait gate, no guilt copy.

**Practice.** Hedgehog hero, miss-count line, one button. Rounds of 10 prompts ending in the complete screen; "Practice again" starts a fresh round. Hearts still apply. Practice pays +10 XP per correct answer only — no completion/perfect bonus, and it never touches the streak — so XP and streak keep measuring lessons on the path. The pool is capped at unlocked lessons; a brand-new player (no misses) drills Unit 1 Lessons 1–2 only, never content a lesson ahead.

**Glossary.** Search box (no auto-focus, so mobile keyboards don't pop up uninvited), compact unit banners, term cards (definition, example, mix-up, green ✓ once seen). Search updates **only the list** (IME-safe); empty state suggests starting terms. Footer: "Not investment advice. Words, not recommendations." — the only disclaimer in the app. (v1.1 — planned: the term detail gains a ghost share icon that opens its declared pair; locked terms show nothing.)

**Shareable pair card (v1.1 — planned, not yet built; amended 10 Sep 2026).**

*Canvas.* 1080×1440 (3:4), 72px safe margin. Generated as one SVG string → Blob → `Image` → `canvas.toBlob("image/png")`. No html2canvas, no added dependency, no remote assets — it must export with the network offline.

*Composition, top to bottom.* Sky-to-mint field with one centered white card (32px radius, 56px inner padding, soft neutral shadow; text measure 824px). Kicker 30px/800 in the sky-blue uppercase style: pack name · unit. Two terms at 88px/900 `--ink` (max two lines, broken only at spaces or hyphens), each followed by its one-sentence fork at 42px/700 `--ink-soft`, line-height 1.45 (CJK breaks per character, Latin per word); a hairline between them carries a yellow ≠ chip. A `--green-soft` panel (40px padding, 744px measure) holds the existing `example` at 38px/700. Footer: hedgehog mark + Kachi wordmark at 34px/800 `--muted`, nothing else.

*Export legibility.* The scale is built for the post-tap full-screen view on a 390px-class phone (~0.36× scale), not the chat thumbnail — no card text can ever win at thumbnail size. Floors after adaptive shrink: term 72px, fork 36px, example 34px; nothing on the card ever renders below 30px. All text is 700–900 weight so recompression (WeChat and in-app browsers) cannot thin strokes into mush.

*Wrapping and fitting are layout math, not guesswork.* Term, fork, and example sizes step **together** through three sizes (88/42/38 → 80/39/36 → 72/36/34); the renderer picks the smallest size that satisfies both the per-block line caps and the 1440px vertical budget. A pure wrapping function breaks strings into `<tspan>` lines at the fixed measures above and is unit-tested against **every concept pair in both locale packs**, extremes included (22-character term, 136-character EN definition, 62-character ZH example). A pair that does not fit at the floor size fails the test — content is shortened in the data file instead of truncating silently or clipping.

*Entry and save UX.* Both entries open a preview sheet: the card scaled to fit, a primary "Save image" button, a small long-press hint beneath it (WeChat and in-app browsers may swallow programmatic download), and a secondary "Share…" button rendered only when `navigator.share` exists. From Complete, pairs of that lesson can be paged through; Glossary opens its own declared pair directly. Triggers are real buttons with `aria-label`; the preview image carries alt text naming the pair; preview entrance respects `prefers-reduced-motion`.

*Chrome strings* (kicker already derives from data; "Save image", long-press hint, "Share…") are added to both locale packs; no other new copy fields.

*Manual QA gate:* newest term and longest example in each locale, checked on iOS Safari, Android Chrome, and WeChat's in-app browser; thumbnail legibility at ~240px wide; export verified offline.

## 6. Term art

- `TERM_ART` maps every term id to art: 6 terms use embedded photographic JPEGs (hedge, pledge, haircut, put, call, margin call); the rest are hand-drawn inline SVGs in the palette above. Every option also gets art via `artIdForLabel`, with aliases ("short" → short selling, "capital gain" → capital gains, …) and a party-popper `joke` fallback for joke answers.
- Sizes: `xs` 30 (inline chips) · `sm` 34 (bank chips, recap pills) · `lg` 84 (quiz tiles) · `hero` 168 (teach cards). Auto-compacts to 64px on short screens.
- Every new term *must* have a `caption` line in `TERMS` — the teach card renders it under the hero art.

## 7. Motion

`bob` 1.7s (next node) · `shine` 2.4s (next node sweep) · `heartShrink` on loss · `shake` 380ms (wrong option/match) · `popGood` (correct) · `sheetPop` / `sheetShake` (feedback) · confetti bits 1.15s (lesson complete). All gestures ≤400ms except ambient loops. `prefers-reduced-motion: reduce` collapses every animation to ~0ms.

Press feedback is physical: buttons translate down 2px and lose bottom-border thickness (Duolingo "pressed" feel). Disabled buttons are flat gray, never translucent.

## 8. Input & accessibility

- Keyboard: `Enter` = continue/check; `1–4` pick options; `Enter` on complete/fail presses the primary CTA. Every flow is completable without a mouse.
- `:focus-visible` = 3px sky-blue ring. Bottom nav and path nodes are real buttons with `aria-label`s.
- Feedback sheet is a live region; disabled options stay in the DOM with `disabled` so state is inspectable.
- Contrast: muted text raised to ≥4.5:1; all text sits on white/cream cards, never directly on gradients.
- Viewports <720px tall compact tiles/art/stems so a full prompt never scrolls off-screen.

## 9. Content voice in UI chrome

- Correct: `Nice. / Exactly. / You got it. / Clean.` Wrong: `Not quite. / Mix-up. / That pair again. / Close, wrong fork.` — picked at random, one per prompt.
- Feedback always names the mix-up and states the fork ("You still own it. Pledge = collateral. Sell = it's gone.").
- No guilt copy on fail, no streak-shaming, no advice anywhere. One disclaimer, in the glossary footer only.

## 10. Known deviations from the PRD

- PRD §11 sketched "deep green + gold, dark-mode-first." Shipped: the light Duolingo-style system above. PRD §11 is updated to point here.
- Hearts, XP, streak, and path lock follow the PRD's v1 table, with two deliberate tightenings: practice rounds pay per correct answer only (no +20 completion/perfect bonus, no streak — the PRD only banned path unlocking, this keeps XP meaningful), and match prompts are judged live on a first wrong pairing (hearts −1 applies to every exercise type, closing the "match is always 100%" loophole).
- Practice is 10-prompt rounds, not literally "infinite until they quit" (PRD §10). Same engine, bounded rounds; a round of drills felt better than an endless mode.
- Banana distractors are banned: three joke answers that slipped into Unit 1–2 were replaced with real sibling terms (PRD §4.2). A later sweep (10 Sep 2026) caught five more in Units 4–5 across both locales (u4rd, u4rg, u5l1c ×2, u5rb) and replaced each with its concept's declared confusion pair — e.g. buy-borrow-die's joke options now point at securities-backed loan / capital gains. The `joke` art remains only as a fallback for art lookups, never as a distractor.
- The prototype stayed a single typed HTML file (PRD §12 allowed Vite+React+TS as a recommendation, not a requirement). Content remained data (`TERMS` / `UNITS` / `LESSONS`), which kept the port to Vite + React + TS mechanical — see §11.

## 11. The React app (`src/`)

The React app implements this system on Vite + TS, rendering from
`content/packs/hedge-or-pledge/zh-CN/course.json` through `src/engine`.
Port notes and deltas:

- CSS tokens, components, and motion are ported near-verbatim (`src/styles.css`); the DOM keeps the prototype's class names. Term art, aliases, and the mascot live in `src/art.tsx`, extracted from the prototype unchanged.
- UI chrome is Chinese (the rewrite's shipped direction): verdicts 「不错。/ 正是。/ 答对了。/ 漂亮。」 and 「还差一点。/ 混淆了。/ 又是这一对。/ 岔路走反了。」 replace the English §9 pools; kickers, buttons, and screen copy are translated. Course content (stems, options, whys, captions, examples) stays English — 中文界面、英文术语教学. Teach cards and feedback sheets add the term's Chinese definition / 辨析 line from `localization.ts` under the English copy.
- A fourth nav tab, 设置 (export/import learner data, privacy copy), exists beyond the prototype's three tabs.
- No remote font loading: the `Nunito` stack resolves only if installed locally (README's 本地优先 rule).
- Engine deltas that back the ported behavior: the +20 no-mistake bonus and the hearts-gated finish live in `src/engine` (`applyAnswer` with `heartsAfter`; a failed finish never completes the lesson), and a failed match re-queues itself via `requeuePrompt`. The practice focus set (recent misses ∪ due confusion pairs) derives from the attempt log via `recentMissTermIds`.
- Single display language (29 Aug 2026): the zh-CN course pack is native Chinese — stems, stories, options, whys, captions, examples, lesson titles, and unit blurbs are translated; the English terms themselves stay English (hedge, put, margin call) because the terms ARE the learning target, with 中文译名 as subtitles on teach cards and in the glossary. `localization.ts` carries only the term-name map, and the old bilingual helper lines are gone.
