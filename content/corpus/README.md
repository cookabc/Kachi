# Corpus notes / 语料说明

The files here are **evidence for how the word list was tiered**, not course content. Every "this word should be taught" judgement in `docs/vocabulary-system.md` should be traceable to something in this directory.

## Files

| File | Contents | Purpose |
| --- | --- | --- |
| `headlines.json` | 172 real finance headlines (`econ` / `metal` / `company` / `forex` domains) | Validates tier T1: can you read a front page after finishing it |
| `1.txt`–`6.txt` | 6 full articles (about 2,300 words): bank earnings, FX macro, Indian bonds, refining margins, mining results, company bulletins | Validates tiers T2–T5: terminology density in body text is far higher than in headlines |

## Why body text, not just headlines

Headlines are compressed. Measured on the same batch of news:

- Headlines carry macro words such as `bond` / `yield` / `inflation`, but almost never `earnings-per-share`, `funding costs`, `credit quality`, `capital ratios`, `book values` or `unrealised losses`;
- A single article brings out six or seven of those terms.

**Building the word list from headlines alone would turn it into a macro-news glossary.**

## How it was collected

- Headlines: the commodity-news MCP's `search_news`, categories `Economics` / `Metal` / `TopNews` / `Forex`, covering 2026-08 to 2026-10.
- Articles: the same source's `get_news_detail`, choosing the high-density categories (bank earnings, weekly FX commentary, bond markets, refining margins, mining results).

## Licensing

Both headlines and articles come from public news and are **used only for word-frequency measurement and validation; they do not enter the course content**. Example sentences in the course are all original (see the `sources` field of `content/packs/*/course.json`) and never reuse the text here. This directory is kept so that "why is this word taught" can be re-checked.

## How the check uses it

`scripts/validate-content.mjs` reads these files and checks that every pack's `concept.term` appears at least once in the corresponding corpus. When adding a pack, add the corpus first, then write the word list.
