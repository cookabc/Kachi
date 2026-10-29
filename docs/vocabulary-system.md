# Kachi vocabulary system design

> Written 2026-10-26. The basis is measured term frequency across 172 real finance headlines plus 6 full articles (about 2,300 words) — not a list picked by feel. Every tiering decision traces back to corpus evidence.
>
> **Status:** this is the plan that produced the shipped course. The per-tier counts below are the plan's original targets; what actually shipped is in `content/packs/index.json` (42 / 49 / 38 / 37 / 32 / 40 = 238 concepts). Where they differ, the registry is the current truth.

## 1. Why the word list had to be rebuilt

How the original 40 concepts performed against real corpora:

| Corpus | Original 40 hits | Detail |
| --- | --- | --- |
| 172 headlines | **10 / 40 (25%)** | The hits were `bond` (41), `yield` (18), `inflation` (8) and a few like them |
| 6 articles (2,300 words) | **12 / 40 (30%)** | Adding `premium`, `liquidity`, `futures`, `swap`, `hedge` |

The other 28–30 words appeared **not once** in real corpora: `pledge`, `haircut`, `notional`, `contango`, `backwardation`, `cost of carry`, `securities-backed loan`, `buy-borrow-die`, `mark-to-market`.

Conversely, not one of the most frequent words in the corpora was in the original list:

```
crude(11)  copper(11)  earnings(7)  capital(7)  profit(7)  demand(5)
capacity(4)  selloff(4)  policy(4)  investor(3)  dividend(3)  debt(3)
treasury(3)  hike(3)  benchmark(3)  portfolio(3)
```

**Conclusion: the original list was private-bank structured-product terminology, not finance English.** The product name and the content did not match. Someone who finished all 40 lessons could not read an ordinary BHP earnings story.

## 2. Three layers, not one pile of words

Layered by *what you are reading*, not by *which discipline it belongs to*. Each layer has one explicit acceptance sentence: what you can read when you are done.

### T1 · Read the finance front page (42 words)

**Acceptance: open any finance app's first screen and understand every headline.**

Corpus check: these 42 words hit **344 times** across the 172 headlines, with a 3% miss rate (1/42).

```
Stocks and markets   stock  share  market  index  investor  blue chip  rally  selloff  slump  rebound  rout
Price and supply     price  supply  demand  output  capacity  inventory  surplus  deficit  tariff
Company and results  profit  revenue  earnings  margin  dividend  forecast  estimate  consensus  guidance
Bonds and rates      bond  yield  treasury  auction  issuance  inflation  interest rate  rate hike  rate cut
Currency and macro   dollar  currency  central bank  monetary policy
```

**This is the core of the rebuild.** Only four of the original 40 — `bond` / `yield` / `inflation` / `interest rate` — qualify for this layer.

### T2 · Read a company earnings release (44 words)

**Acceptance: read a quarterly earnings bulletin and know whether the news is good or bad.**

`earnings` (7), `profit` (7), `dividend` (3), `consensus` (2) and `guidance` (1) are frequent in the corpus, while `revenue`, `buyback` and `valuation` get zero hits — but an earnings release is exactly where they live. This layer's corpus should be earnings releases, not news headlines.

```
Results basis       earnings  revenue  profit  margin  gross  net  eps  consensus  beat  miss
Guidance            guidance  forecast  estimate  outlook  headwinds  tailwinds
Shareholder return  dividend  buyback  payout  yield  shareholder  share issuance
Capital structure   capex  opex  debt  equity  leverage  net debt  working capital  free cash flow
Company events      ipo  listing  acquisition  merger  divestiture  spin-off  write-down  impairment  restructuring
Valuation           valuation  p/e  p/b  market cap  book value
```

### T3 · Read bonds and rates (37 words)

**Acceptance: follow bond-market news — yields, auctions, maturities.**

This was already the strongest domain in the original content (`bond` 41 hits, `yield` 18, `auction` 8), so it is kept and completed.

```
Basics              bond  yield  price  coupon  maturity  duration  principal
Issuance and trade  auction  issuance  bid-to-cover  cut-off yield  primary dealer  benchmark
Instrument types    treasury  gilt  sovereign  corporate bond  commercial paper  junk bond  investment grade
Spreads and curve   credit spread  spread widening  spread tightening  yield curve  term premium  inversion
Risk                default risk  credit rating  downgrade  upgrade  covenant  refinancing
Policy              policy rate  basis point  inflation-linked  fixed-rate  floating-rate
```

### T4 · Read FX and macro (36 words)

**Acceptance: understand news about exchange rates, central banks and policy.**

Corpus: `euro` (6) `yen` (6) `dollar` (4) `hike` (3) `policy` (4).

```
Rates               currency  exchange rate  dollar  euro  yen  sterling  yuan  peso  rupiah
Direction           appreciate  depreciate  weaken  strengthen
Central banks       central bank  rate hike  rate cut  hawkish  dovish  forward guidance  tapering
Policy              monetary policy  fiscal policy  quantitative easing  tightening  easing
Macro               inflation  deflation  stagflation  soft landing  current account  trade balance
Sentiment           risk appetite  risk-off  safe-haven  carry trade  intervention
```

### T5 · Read research and quant (32 words) — paired with the audit question type

**Acceptance: spot where a backtest conclusion does not hold up.**

The value of this layer is not the words themselves but that it naturally demands doubt: every word names a specific way of fooling yourself.

```
Backtesting     backtest  in-sample  out-of-sample  walk-forward  benchmark
Traps           overfitting  look-ahead bias  survivorship bias  data snooping  multiple testing
Performance     sharpe ratio  max drawdown  hit rate  expectancy  alpha  beta  tracking error
Portfolio       universe  rebalance  position sizing  turnover  correlation  exposure
Costs           transaction cost  slippage  capacity constraint  liquidity constraint
Risk            stress test  scenario analysis  value at risk  sensitivity  robustness
```

### T6 · Borrowing and hedging (the existing pack, kept as-is, 40 words)

**Acceptance: read private-bank and structured-product material.**

The original 40 words almost all belong here, so they are kept unchanged. It is genuinely specialist content; it just should not be the entry layer.

`hedge` `pledge` `collateral` `haircut` `margin` `margin call` `leverage` `derivative` `option`
`put` `call` `short selling` `notional` `premium` `volatility` `diversification` `counterparty`
`mark-to-market` `futures` `swap` `spot` `basis` `basis risk` `contango` `backwardation`
`cost of carry` `real rate` `securities-backed loan` `capital gains` `buy-borrow-die`
`duration` `yield curve` `quantitative easing` `default` `long` `interest rate` `bond`
`inflation` `yield` `liquidity`

> Note: `interest rate` / `bond` / `yield` / `inflation` / `liquidity` already appear in T1/T3.
> A word repeated across packs is **not taught twice**; it appears only as a review item inside that pack (see "Cross-pack deduplication" below).

**238 concepts / 201 unique words / 6 packs in total.** All 40 original words survive in T6 — none were dropped.

## 3. Confusion pairs had to be rebuilt: only 3 of the original 33 were real

`mixUp` is Kachi's core mechanism (the whole chord diagram, mastery scheduling and practice pool are built on it). I checked all 33 existing pairs one by one, asking whether the two words would actually be confused:

**Only 3 pairs are genuinely confusable (shared root, similar form, or high-frequency opposition in the same context):**
```
interest rate ↔ real rate      (nominal vs real)
yield ↔ yield curve            (a point vs a line)
basis ↔ basis risk             (the gap vs the damage the gap causes)
```

**The other 30 are "neighbouring concepts on the same topic", not "words that get mixed up":**
```
volatility ↔ diversification      one is single-asset volatility, the other portfolio spreading; nobody confuses them
counterparty ↔ default            "who it is" vs "did not perform" — semantically orthogonal
liquidity ↔ notional              unrelated
premium ↔ yield                   one is a price, the other a rate of return
```

This does not break the existing experience (as a conceptual contrast it still teaches), but **it cannot carry mastery's criterion**: `consecutiveCorrect` records how many times in a row you got *this pair* right. If the pair is not genuinely confusable, that number measures "you memorised two unrelated definitions", not "you no longer confuse them".

**Rebuild rule (apply to every new pack):**

| Confusion type | Criterion | Examples |
| --- | --- | --- |
| Form | Similar spelling or shared root | `depreciate` / `appreciate`, `principal` / `principle` |
| Opposite | Two ends of one dimension | `supply` / `demand`, `hike` / `cut`, `surplus` / `deficit` |
| Coexisting | Appear in one sentence and are easy to swap | `profit` / `revenue`, `margin` / `markup` |
| Hierarchy | One is a subtype of the other | `option` / `derivative`, `gilt` / `treasury` |
| Timing | One action at different moments | `ex-dividend` / `record date`, `auction` / `issuance` |

Examples of T1 confusion pairs (all corpus-verified high-frequency words):
```
supply ↔ demand          (opposite; corpus supply 3 / demand 5)
profit ↔ revenue         (coexisting; profit 7)
earnings ↔ profit        (coexisting; earnings 7)
hike ↔ cut               (opposite; hike 3 / cut 1)
surplus ↔ deficit        (opposite)
rally ↔ selloff          (opposite; selloff 4)
bond ↔ yield             (coexisting; bond 6 / yield 4, and they move in opposite directions — the classic finance misunderstanding)
```

## 4. Cross-pack deduplication and review

Of the 238 concepts, 32 words appear in more than one pack (37 extra repeated entries against 201 unique words), for example `bond` / `yield` / `inflation` / `interest rate` / `liquidity` / `premium` / `futures` / `swap` / `hedge` / `leverage` / `default` / `margin`.

Rules:
1. **Teach where it first appears.** Later packs show it only as a review item, and `mastery` is shared across packs (same concept id).
2. `contentVersion` is per pack, but the `mastery` key is `pairIdForConcepts`, so it is reusable across packs by construction.
3. The pack-selection screen shows "N words already learned" so the learner knows the pack is not entirely new.

## 5. Data structure changes (minimal)

The existing schema already supports multiple packs (`packId` / `contentVersion` / a `packs/` directory); three things were missing:

1. **Pack registry**: `content/packs/index.json`, listing each pack's `id` / `title` / `level` (T1–T6) / `prerequisite` / `conceptCount`.
2. **`loadCourse` accepts a pack**: it was hardcoded to `hedge-or-pledge`; change it to load the pack the learner selected.
3. **Per-pack progress isolation**: `completedLessonIds` needs a pack prefix, otherwise `u1l1` collides across packs.

The `termZh` map in `localization.ts` is global; with multiple packs it needs to be merged into one table keyed by concept id, which is unique by construction.

## 6. Content production pipeline (so this does not drift again)

The problem was not "the wrong words were chosen" — it was **that there was no verification step**. Two gates were added:

1. **Every word list must pass corpus checking first.** Every word in a new pack must appear at least once in its target corpus. `scripts/validate-content.mjs` reads `content/corpus/<pack>.txt` (that pack's target corpus) and checks that each `concept.term` hits at least once. A word with no corpus either gets corpus added or an explanation of why it is taught.
2. **Every confusion pair must have a type.** `mixUp` gains a `mixUpType` field (`form` / `opposite` / `coexist` / `hierarchy` / `timing`), and the validator rejects an empty value. This forces the author to answer "why would these two be confused", not "they share a topic".

## 7. Execution order

```
1. Fix the corpora   Store each of T1–T5's target corpora under content/corpus/ (3–5 headlines + articles each)
2. T1 first          40 words + confusion pairs + 23 lessons; the only layer that can immediately prove "you can read the front page"
3. Gates first       Add corpus checking and mixUpType validation to validate-content before writing T2
4. T2 → T5           In corpus-density order (T2 earnings, T3 bonds already has a base, T4 macro, T5 quant with the audit question type)
5. Keep T6           Rename the existing pack and mark it "advanced"; content unchanged
```

**Acceptance criterion (testable):** once T1 is done, sample 20 real finance headlines from that day and have a model (or person) who has "finished T1" judge each one "understood / not understood". The hit rate should be ≥90%.

---

中文版见 [vocabulary-system.zh-CN.md](vocabulary-system.zh-CN.md)。
