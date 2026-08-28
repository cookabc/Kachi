# Hedge or Pledge
## Product Requirements Document — v0.1
**Status:** accepted — 27 Aug 2026, defaults approved as written
**Product:** a Duolingo-style game that teaches financial vocabulary
**Date:** 26 Aug 2026 (accepted 27 Aug 2026)

---

## 1. Why this exists

People do not fail finance because the ideas are that hard. They fail because the words sit on top of each other.

*Hedge* and *insurance* feel the same until one is a market position and the other is a contract. *Pledge* sounds like a promise, but here it means "this asset can be taken." *Margin* and *leverage* get used as synonyms until a margin call shows they are not. A glossary does not fix that. Reading a definition once does not fix that. You have to be *wrong in public, immediately, about the exact pair you confuse*, then try again tomorrow.

Duolingo already solved the loop: tiny sessions, retrieval under a little pressure, mix-ups as the curriculum, a reason to come back tomorrow. It has not been aimed at this vocabulary. Textbooks have the vocabulary and none of the loop.

Hedge or Pledge is that loop, pointed at the words that make markets readable.

---

## 2. Who it is for

**Primary:** a curious beginner who keeps hitting words in the news, at work, or in a conversation, and does not want a CFA course. They will give us 8 minutes, not 80. They want to stop nodding along.

**Secondary:** the same person a month later, reviewing, not learning from zero.

**Not for:** traders who need position simulators, students cramming a specific exam, anyone who wants portfolio advice. We teach *what the word means in use*. We do not tell you what to buy.

The first real user is Chuangcius, already mid-conversation on hedge vs pledge. The product should feel like that conversation continued, not a pivot into "Intro to Finance 101."

---

## 3. Product thesis

**The atomic unit is the confusion pair, not the term.**

A lesson that teaches "hedge" in isolation will produce people who can recite a definition and still mix it with insurance, diversification, or a stop-loss. A lesson that forces *hedge vs pledge*, *put vs call*, *margin vs leverage* will produce people who can read a sentence in the Journal and know which thing happened.

Everything else (hearts, XP, path, mascot) is there to make that discrimination practice happen daily.

---

## 4. Principles

1. **Plain speech.** One-sentence definitions a friend would actually say. If it needs "ceteris paribus," rewrite it.
2. **Wrong answers must be the real mix-up.** Never "banana." The distractor is the term they would have used at dinner.
3. **Scenario over translation.** Finance words earn their meaning in a situation ("you still own the stock, the bank can take it"). Translate-the-definition drills are a warm-up, not the meal.
4. **Short and finishable.** A lesson is 8–12 prompts, under five minutes. The path should look completable, not infinite.
5. **Mechanics serve memory.** Keep hearts, XP, streak only where they increase retrieval. Drop anything that is guilt, grind, or leaderboard theater for v1.
6. **No advice.** We will not imply "you should pledge your shares." We will explain what pledging *is*, including the ugly part.

---

## 5. The loop

Open app → see today's lesson on a path → 5-minute session of mixed prompts → instant green/red + one-line why → hearts if wrong → lesson complete (XP, accuracy, 2–3 saved mix-ups) → tomorrow, a review that re-serves what you missed.

If the player does nothing else, they still met the product. Practice and Glossary are supporting surfaces, not the home.

**Session budget:** 5 minutes target, 8 minutes max. If a lesson runs longer, it is too big.

---

## 6. How learning actually happens here

Borrow the parts of language apps that are load-bearing, ignore the rest.

| Idea | How we use it |
|---|---|
| Retrieval practice | Every prompt makes them produce or choose the word, not re-read it |
| Interleaving | A lesson mixes 4–6 related terms, never drills one term for 10 cards |
| Desirable difficulty | Confusion pairs and scenarios before raw recall is fluent |
| Spaced review | Missed items go into Practice; Practice is biased toward recent misses and older weak terms |
| Immediate feedback | The "why" is one sentence, shown before Continue. No essay. |

We will **not** copy Duolingo leagues, gems-as-paywall, or timed anxiety drills in v1. Those optimize engagement, not discrimination of *put* vs *call*.

Hearts exist to make a wrong answer sting just enough to pay attention, and to end a spiraling session. They refill on retry. No clock. This is vocabulary, not a life-or-death streak.

---

## 7. Curriculum

Five units. Order is conceptual, not alphabetical: you need *collateral* sitting next to *pledge* before *margin call* makes sense.

### Unit 1 — Hedge or Pledge
The name of the game, and the first fork in the road.
- Terms: hedge, pledge, collateral, haircut, margin, margin call
- Job: stop treating "protect" and "borrow against" as the same move
- Signature scenario: you own stock. Do you buy a put, or do you pledge it for a loan? What happens if it drops 40%?

### Unit 2 — A bigger bet
- Terms: leverage, derivative, option, put, call, short selling
- Job: names for bets, including bets used as hedges
- Signature mix-up: put vs call; short as hedge vs short as speculation

### Unit 3 — Money in motion
- Terms: liquidity, notional, premium, yield, duration, basis risk
- Job: the words that show up the moment someone talks size, price of protection, or "the hedge didn't quite work"

### Unit 4 — Markets and damage
- Terms: long, volatility, diversification, counterparty, default, mark-to-market
- Job: how books move and where the other person can fail you

### Unit 5 — How the rich actually do it
- Terms: securities-backed loan, capital gains, buy-borrow-die (as a *description*, not a recommendation), futures, swap
- Job: connect Units 1–2 to sentences they will actually read. This unit is earned. It stays honest about tax, margin calls, and forced sales.

**Content rules for every term**
- One-sentence definition
- One concrete example with numbers when numbers help ("$1M stock, 30% haircut, $700k loan")
- At least one named mix-up
- At least two prompts in the live curriculum, in two different exercise types

Lessons unlock in order. A unit review sits at the end of each unit and reuses that unit's terms plus a mix-up-driven callback from earlier units — usually one, but a confusion pair can reach further back (basis risk's pair is *hedge* from Unit 1; securities-backed loan's is *pledge*). A review never tests a term from a later unit. (Amended 29 Aug 2026: the old "one callback from the previous unit" rule fought the confusion-pair thesis in §3 — the shipped reviews follow the pairs. The enforceable part — no untaught terms in reviews, ≥3 exercise types per lesson, scenario mandatory after u1l1, two prompts in two types per term — is now enforced by the content validator.)

---

## 8. Exercise types

A lesson must use at least three of these. Scenario is mandatory after Unit 1 Lesson 1. Matching-only lessons are banned.

1. **Meaning pick (multiple choice).** "What does X mean?" Four options. Three are sibling terms.
2. **Matching.** Four pairs, term ↔ short definition. Warm-up, not a whole lesson.
3. **Fill the word.** A two-line story with the key term blanked. Tap from a short bank, do not free-type in v1 (mobile, typos, "margin call" vs "margincall").
4. **Scenario.** 2–4 sentences. Then "what is this called?" or "which move is this?" This is the load-bearing type.
5. **True / false, with teeth.** The false version is the mix-up ("Pledging stock means you sold it"). After answer, one-line why.

**Feedback copy:** always name the mix-up. Bad: "Incorrect." Good: "You still own it. Pledge = collateral. Sell = it's gone."

---

## 9. Game systems (v1)

| System | v1 rule | Why |
|---|---|---|
| Hearts | 5 per lesson. −1 on wrong — **every** exercise type, match judged live on a wrong pairing. 0 = lesson failed, retry refills | Stops a death spiral without a wait-gate |
| XP | +10 correct, +20 lesson complete, +20 no-mistake bonus. **Practice rounds: +10/correct only, no bonuses** | Visible progress, not a career |
| Streak | +1 if ≥1 *lesson* (not practice round) completed today | Come-back hook. No streak freeze, no guilt copy |
| Path | Vertical unit path, next lesson unlocked on complete | Duolingo home, completable length |
| Practice | Weighted toward misses + weak terms; pool capped at unlocked lessons; 10-prompt rounds; pays XP but never unlocks or feeds streak | The actual memory product |
| Glossary | All terms, searchable, checkmark once seen in a lesson | Reference without leaving the app |

**Explicitly out of v1:** accounts, leaderboards, leagues, energy timers, push notifications, paid hearts, audio, streaks that punish a skipped Saturday as if it were a character flaw.

---

## 10. Surfaces

**Learn (home).** Brand header (XP, streak — hearts live inside lessons only; updated 27 Aug 2026, see [DESIGN.md](DESIGN.md) §5). Vertical path of units and lessons. One clearly marked "up next."

**Lesson.** Full-screen prompt. Big tap targets. Check → feedback sheet → Continue. No chrome except hearts + progress pips.

**Complete.** XP, accuracy, up to three "you mix these up" chips, CTA: next lesson or Practice those chips.

**Practice.** Same engine, no path progress, does not unlock lessons. Infinite until they quit. Hearts still apply so it is not mindless.

**Glossary.** Search + list. Term, one-sentence definition, example, mix-up. Not a Wikipedia dump.

Bottom nav: Learn · Practice · Glossary.

---

## 11. Voice

Sounds like the teacher in this chat: warm, short, slightly dry. Not a fintech brand, not a professor.

- "A hedge is insurance on a bet you already have."
- Not: "A hedge is a risk-management strategy designed to offset potential losses…"

Numbers when they make the mechanism visible. No ticker symbols, no "not financial advice" wallpaper on every screen. One quiet line in Glossary footer is enough.

**Visual system (updated 27 Aug 2026):** the prototype shipped with a light, Duolingo-style system — white cards on a sky/mint gradient, green = correct/go, yellow = reward, coral = wrong-but-safe, a hedgehog mascot, and a teach-card caption that explains what each piece of term art shows. The original sketch ("deep green + gold, dark-mode-first") is superseded. Full tokens, components, motion, and accessibility rules live in [DESIGN.md](DESIGN.md); change the look there, not ad hoc in the HTML.

---

## 12. MVP scope

**Must ship**
- Full Unit 1 + Unit 2 playable end-to-end (the conversation we already started)
- Units 3–5 content present in data, even if later lessons are shorter
- All five exercise types
- Hearts, XP, streak, path lock, Practice, Glossary
- Progress on-device in IndexedDB, no account (updated 29 Aug 2026 from "localStorage"; export/import covers portability)
- Mobile-first web, usable on desktop
- ≥40 unique prompts, every v1 term at least twice

**Must not ship**
- Auth, backend, payments
- Advice, portfolio tracking, live prices
- Social, leagues, sharing cards (nice later)
- Sound as a required path (optional later)
- CMS / admin. Content lives in a typed file a human can edit

**Build shape (recommendation, not a religion):** Vite + React + TypeScript. Content as data. The game engine should not care which unit it is rendering.

---

## 13. What "good" looks like

We will not have analytics in v1, so quality is felt:

- A new player finishes Unit 1 Lesson 1 in under five minutes without help.
- After Unit 1, they can explain hedge vs pledge in one spoken sentence, including the ugly case (margin call).
- Wrong answers feel unfair only if *our distractor was sloppy*, not because the UI was.
- Coming back the next day, Practice is obviously feeding them yesterday's misses, not a random quiz.

If we later add analytics: lesson completion, accuracy by confusion pair, day-2 return. Not DAU cosplay.

---

## 14. Open decisions (need you)

**Resolved 27 Aug 2026: all defaults approved.**

1. **Audience tightness.** Keep it "news-literate beginner," or tilt toward someone who will actually pledge/hedge at work?
   → **Default kept:** news-literate beginner.
2. **Hearts on / off.** Some people hate losing a run to one mix-up. We can do XP-only if you want kinder.
   → **Default kept:** hearts on, 5 per lesson, retry refills.
3. **Unit 5 tone.** Descriptive "this is the move wealthy people use" vs skip buy-borrow-die entirely to avoid looking like a tax pitch.
   → **Default kept:** descriptive; buy-borrow-die stays as description, with tax/margin-call/forced-sale consequences shown.
4. **Name lock.** Hedge or Pledge is the working title. Keep it?
   → **Default kept:** Hedge or Pledge.

Everything else in this doc is a recommended default. Push back on the thesis (confusion pairs) if you want a more glossary-like product; that would be a different game.

---

## 15. Build trigger

Accepted 27 Aug 2026 — build is approved. Thesis stands, Unit 1–2 list confirmed, all four open decisions resolved to their defaults.
