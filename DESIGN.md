# Hedge or Pledge — Design System

**Status:** matches the shipped single-file prototype (`Hedge-or-Pledge.html`) as of 27 Aug 2026.
This document describes what is actually built, so future changes have a baseline to push against.

The product thesis lives in the [PRD](Hedge-or-Pledge-PRD.md). This document covers the visual and interaction layer only.

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
- Match: two columns of chips; correct pairs lock green. A **wrong pairing judges the prompt immediately** — the sheet docks a heart and names the mix-up, and the re-shuffled match re-queues right after feedback so the player can still finish the pairs. No Check button; the prompt cannot be silently retried to 100%.

**Complete.** Confetti burst, hedgehog mascot, "Flawless." (perfect) or "Lesson done.", accuracy line, yellow XP breakdown card, up to 3 "you mix these up" chips (term vs its mix-up). Buttons always offer the path: Next lesson (primary), "Practice those" (green, only when there were misses), "Back to the path" (ghost). Practice rounds show a per-answer XP line instead of the lesson breakdown.

**Fail (0 hearts).** 💔, "Out of hearts.", retry refills immediately — no wait gate, no guilt copy.

**Practice.** Hedgehog hero, miss-count line, one button. Rounds of 10 prompts ending in the complete screen; "Practice again" starts a fresh round. Hearts still apply. Practice pays +10 XP per correct answer only — no completion/perfect bonus, and it never touches the streak — so XP and streak keep measuring lessons on the path. The pool is capped at unlocked lessons; a brand-new player (no misses) drills Unit 1 Lessons 1–2 only, never content a lesson ahead.

**Glossary.** Search box (no auto-focus, so mobile keyboards don't pop up uninvited), compact unit banners, term cards (definition, example, mix-up, green ✓ once seen). Search updates **only the list** (IME-safe); empty state suggests starting terms. Footer: "Not investment advice. Words, not recommendations." — the only disclaimer in the app.

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
- Banana distractors are banned: three joke answers that slipped into Unit 1–2 were replaced with real sibling terms (PRD §4.2). The `joke` art remains only as a fallback for art lookups, never as a distractor.
- Build shape remains a single typed HTML file (PRD §12 allowed Vite+React+TS as a recommendation, not a requirement). Content is still data (`TERMS` / `UNITS` / `LESSONS`), so a later port stays mechanical.
