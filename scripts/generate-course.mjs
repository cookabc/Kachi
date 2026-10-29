#!/usr/bin/env node
/**
 * generate-course.mjs — T1 pack 的内容生成器。
 *
 * 为什么要有生成器而不是手写 course.json：
 *   一个 pack 是「6 概念 × 7 单元 × 双语」的结构化内容，手写 json 有 5,000+ 行，
 *   中英两份必然漂移。源里每个概念写一次，中英题目由模板生成，结构和答案天然一致。
 *
 * 题目模板（每个概念 5 题）：
 *   meaning    看英文选中文释义（干扰项取自同单元的其他概念的释义）
 *   scenario   给一个场景，选这是哪个词
 *   truefalse  一句关于这个词的判断，真或假
 *   fill       挖空句子，从词库里选词
 *   match      每课一个：把本课 6 个词和释义配对
 *
 * 输出：content/packs/<packId>/{zh-CN,en-US}/course.json
 * 用法：node scripts/generate-course.mjs [--pack t2-company-earnings]
 *       不带 --pack 时生成全部有 source.mjs 的 pack。
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { blankTerm, fillLeaksAnswer } from "../src/fill.ts";
import { corpusHasTerm } from "./validate-content.mjs";

const ROOT = process.cwd();
const PACKS_DIR = path.join(ROOT, "content/packs");

/** Packs that carry a source.mjs — the generated ones. */
// Set once per pack by generatePack(). Module-level state is acceptable here:
// this is a one-shot script that processes one pack at a time, and threading
// five parameters through every helper would add noise without adding safety.
let CONCEPTS = [];
let UNITS = [];
let PACK = {};
let SOURCES = [];
let CERTIFIES = {};
let HEADLINE_DRILLS = [];
let OUT_DIR = "";

function availablePacks() {
  return readdirSync(PACKS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .filter((id) => existsSync(path.join(PACKS_DIR, id, "source.mjs")));
}

/**
 * Load one pack's source. headline drills are optional: they are T1-specific
 * (reading a real headline), so a pack without that file simply has none.
 */
async function loadPack(packId) {
  const sourceUrl = pathToFileURL(path.join(PACKS_DIR, packId, "source.mjs")).href;
  const source = await import(sourceUrl);
  const drillsPath = path.join(PACKS_DIR, packId, "headlines.mjs");
  const drills = existsSync(drillsPath)
    ? ((await import(pathToFileURL(drillsPath).href)).HEADLINE_DRILLS ?? [])
    : [];
  return { source, drills };
}

/** 每单元两课，第三课是复习。6 概念 → 每课 3 个。 */
function lessonsFor(unit, locale) {
  // Lesson titles derive from the unit title, so the suffix must be derived in
  // the target language too — otherwise the English course renders Chinese unit
  // names with a Chinese 「续 / 回顾」 tail on the learn screen.
  const title = locale === "en-US" ? (unit.titleEn ?? unit.title) : unit.title;
  const continued = locale === "en-US" ? `${title}, continued` : `${title}（续）`;
  const review = locale === "en-US" ? `${title} · review` : `${title} · 回顾`;
  const concepts = CONCEPTS.filter((c) => c.unit === unit.id);
  const half = Math.ceil(concepts.length / 2);
  return [
    { id: `u${unit.id}l1`, concepts: concepts.slice(0, half), review: false, title },
    { id: `u${unit.id}l2`, concepts: concepts.slice(half), review: false, title: continued },
    { id: `u${unit.id}r`, concepts, review: true, title: review },
  ];
}

/** 干扰项：同单元其他概念的释义，取 3 个；不够时用相邻单元补。 */
function distractors(concept) {
  const sameUnit = CONCEPTS.filter((c) => c.unit === concept.unit && c.id !== concept.id);
  const neighbours = CONCEPTS.filter((c) => Math.abs(c.unit - concept.unit) === 1 && c.id !== concept.id);
  const pool = [...sameUnit, ...neighbours, ...CONCEPTS.filter((c) => c.id !== concept.id)];
  const seen = new Set([concept.id]);
  const picked = [];
  for (const c of pool) {
    if (seen.has(c.id)) continue;
    seen.add(c.id);
    picked.push(c);
    if (picked.length === 3) break;
  }
  return picked;
}

/** 按 locale 取某个字段：en-US 用 concept.en.*，zh-CN 用中文原字段。 */
function text(concept, field, locale) {
  if (locale === "en-US" && concept.en) return concept.en[field];
  return concept[field];
}

/** 中英两版共用一套结构；只有文字不同。 */
function promptsFor(concept, index, lessonConcepts, lessonId, locale) {
  const out = [];
  const pid = (suffix) => `${lessonId}-${concept.id}-${suffix}`;
  const others = distractors(concept);

  // 1) meaning：看英文选中文
  const meaningOptions = [concept, ...others].map((c) => ({
    text: text(c, "definition", locale),
    art: c.id,
  }));
  out.push({
    id: pid("m"),
    type: "meaning",
    termId: concept.id,
    termIds: [concept.id],
    stem: locale === "en-US" ? `What does ${concept.term} mean?` : `${concept.term} 是什么意思？`,
    options: meaningOptions,
    answer: 0,
    why: text(concept, "mixUpWhy", locale),
  });

  // 2) scenario：给场景选词
  const scenarioOptions = [concept, ...others].map((c) => ({
    text: c.term,
    art: c.id,
  }));
  out.push({
    id: pid("s"),
    type: "scenario",
    termId: concept.id,
    termIds: [concept.id],
    story: text(concept, "example", locale),
    stem: locale === "en-US" ? "Which term does this describe?" : "这句话里最关键的那个词是？",
    options: scenarioOptions,
    answer: 0,
    why:
      locale === "en-US"
        ? `${concept.term}: ${text(concept, "definition", locale)}`
        : `${concept.term}：${concept.definition}`,
  });

  // 3) truefalse：用明确正反两态
  const isTrue = index % 2 === 0;
  out.push({
    id: pid("t"),
    type: "truefalse",
    termId: concept.id,
    termIds: [concept.id],
    stem:
      locale === "en-US"
        ? isTrue
          ? `${concept.term} means: ${text(concept, "caption", locale)}`
          : `${concept.term} means: ${text(others[0], "caption", locale)}`
        : isTrue
          ? `${concept.term}：${concept.zh}`
          : `${concept.term} 就是 ${others[0].zh}。`,
    answer: isTrue,
    why:
      locale === "en-US"
        ? isTrue
          ? `Correct — ${text(concept, "definition", locale)}`
          : `${concept.term} means ${text(concept, "definition", locale)}, not ${text(others[0], "definition", locale)}.`
        : isTrue
          ? `${concept.term} 确实是「${concept.zh}」。`
          : `${concept.term} 是「${concept.zh}」，不是「${others[0].zh}」。`,
  });

  // 4) fill：从本课词库里选
  const bank = [
    concept.term,
    ...lessonConcepts
      .filter((c) => c.id !== concept.id)
      .slice(0, 3)
      .map((c) => c.term),
  ];
  // blankTerm matches inflected forms ("rallied" for "rally"), so the whole
  // word leaves the sentence. When the term is absent entirely the stem keeps
  // the sentence and points at the blank — the answer is not printed there.
  const example = text(concept, "example", locale);
  const { story } = blankTerm(example, concept.term);
  const fillStory =
    story === example ? `${example} (${locale === "en-US" ? "the word here is" : "这里的词是"} ____)` : story;
  out.push({
    id: pid("f"),
    type: "fill",
    termId: concept.id,
    termIds: [concept.id],
    story: fillStory,
    bank: [...new Set(bank)],
    answer: concept.term,
    why: text(concept, "mixUpWhy", locale),
  });

  // 5) audit：只在概念自带 audit 数据时出。这是「疑」的题型——给一段回测
  // 结论和几句关于它的话，挑出站不住的那一句。它不是每个词都该有：只有那些
  // 天然对应一种自欺方式的词（过拟合、幸存者偏差、数据挖掘）才配得上。
  if (concept.audit) {
    const audit = concept.audit[locale === "en-US" ? "en" : "zh"] ?? concept.audit.zh;
    out.push({
      id: pid("a"),
      type: "audit",
      termId: concept.id,
      termIds: [concept.id],
      story: audit.claim,
      stem: locale === "en-US" ? "Which statement does not hold?" : "哪一句站不住？",
      options: audit.options.map((text) => ({ text })),
      answer: audit.answer,
      why: audit.why,
    });
  }

  return out;
}

/**
 * The listen exercise: the term is spoken, options are terms. Synthesis happens
 * at runtime, so the prompt carries only which term is the answer — no audio
 * files exist. Distractors come from the same lesson so the ear has to
 * distinguish confusable neighbours, not arbitrary words.
 */
function listenPrompt(lessonConcepts, lessonId, locale) {
  if (lessonConcepts.length < 2) return null;
  const answer = lessonConcepts[0];
  const options = [answer, ...lessonConcepts.slice(1, 4)].map((c) => ({
    text: c.term,
    art: c.id,
  }));
  return {
    id: `${lessonId}-listen`,
    type: "listen",
    termId: answer.id,
    termIds: [answer.id],
    stem: locale === "en-US" ? "Which term did you hear?" : "你听到的是哪个词？",
    options,
    answer: 0,
    why:
      locale === "en-US"
        ? `${answer.term}: ${text(answer, "definition", locale)}`
        : `${answer.term}：${answer.definition}`,
  };
}

function matchPrompt(lessonConcepts, lessonId, locale) {
  if (lessonConcepts.length < 2) return null;
  return {
    id: `${lessonId}-match`,
    type: "match",
    termIds: lessonConcepts.map((c) => c.id),
    pairs: lessonConcepts.map((c) => ({
      id: c.id,
      left: c.term,
      right: locale === "en-US" ? text(c, "caption", locale) : c.zh,
    })),
    why: locale === "en-US" ? "Match each term to what it means." : "把每个词和它的意思对上。",
  };
}

/**
 * A headline drill as an exercise. The two options are the two terms of the
 * pair, so the question is exactly "which one fits here" — not "what does this
 * mean". `story` carries the headline with `____`; the displayed stem tells the
 * learner what to do without hinting at the answer.
 */
function headlinePrompt(drill, lessonId, locale) {
  const [first, second] = locale === "en-US" ? [drill.a, drill.b] : [drill.a, drill.b];
  return {
    id: `${lessonId}-${drill.id}`,
    type: "headline",
    termIds: [first, second],
    story: drill.text,
    stem: locale === "en-US" ? "Which term fits the blank?" : "这句话里的空该填哪个词？",
    options: [first, second].map((id) => ({ text: id, art: id })),
    answer: drill.answer === first ? 0 : 1,
    why: locale === "en-US" ? (drill.whyEn ?? drill.why) : drill.why,
  };
}

function buildCourse(locale) {
  const conceptById = new Map(CONCEPTS.map((c) => [c.id, c]));
  const units = UNITS.map((u) => ({
    id: u.id,
    title: locale === "en-US" ? (u.titleEn ?? u.title) : u.title,
    blurb: locale === "en-US" ? (u.blurbEn ?? u.blurb) : u.blurb,
  }));
  // Provenance: a concept cites the corpus articles that actually use its
  // term — the same evidence the corpus gate checks, wired into the record.
  // Concepts no article covers keep legacy status; an invented source would be
  // worse than an empty field.
  const provenance = provenanceFor(CONCEPTS);
  const concepts = CONCEPTS.map((c) => ({
    id: c.id,
    unit: c.unit,
    term: c.term,
    caption: text(c, "caption", locale),
    definition: text(c, "definition", locale),
    example: text(c, "example", locale),
    mixUp: c.mixUp,
    mixUpWhy: text(c, "mixUpWhy", locale),
    mixUpType: c.mixUpType,
    sourceIds: provenance.get(c.id) ?? [],
    // The zh pack carries the Chinese term name natively so the teach card
    // and graph card show 「反弹」 instead of falling back to the English
    // term; the en pack has no use for it and omits the field.
    ...(locale === "zh-CN" && c.zh ? { termZh: c.zh } : {}),
    relations: c.relations ?? [],
    risk: "evergreen",
    // Generated content has not been through review. "legacy" is reserved
    // for the hand-written pack that predates the review process.
    reviewStatus: "draft",
  }));

  const lessons = [];
  for (const unit of UNITS) {
    for (const lesson of lessonsFor(unit, locale)) {
      const prompts = [];
      lesson.concepts.forEach((concept, i) => {
        const all = promptsFor(concept, i, lesson.concepts, lesson.id, locale);
        // A review lesson re-covers the whole unit, so it takes only the two
        // prompt types that test recall rather than re-teaching the format.
        const keep = lesson.review ? new Set(["-s", "-t"]) : null;
        prompts.push(...(keep ? all.filter((prompt) => keep.has(`-${prompt.id.split("-").pop()}`)) : all));
      });
      // The reading task goes FIRST in a review lesson.
      //
      // It used to go last, and that made it unreachable: a review runs ~16-18
      // prompts against five hearts, so a learner who stumbles a few times ends
      // the lesson in the "out of hearts" screen without ever seeing the one
      // exercise that uses the terms the way a headline does. Leading with it
      // also makes pedagogic sense — read the real thing, then drill the pieces.
      //
      // A drill belongs to the LATER of its two units: several pairs straddle a
      // unit boundary (surplus in u2, deficit in u3), and the earlier review
      // cannot use a term that has not been taught yet.
      const reviewPrompts = [];
      if (lesson.review) {
        const unitConceptIds = new Set(lesson.concepts.map((c) => c.id));
        for (const drill of HEADLINE_DRILLS) {
          const a = conceptById.get(drill.a);
          const b = conceptById.get(drill.b);
          if (!a || !b) continue;
          if (Math.max(a.unit, b.unit) !== unit.id) continue;
          if (!unitConceptIds.has(drill.a) && !unitConceptIds.has(drill.b)) continue;
          reviewPrompts.push(headlinePrompt(drill, lesson.id, locale));
        }
      }
      prompts.unshift(...reviewPrompts);
      const match = matchPrompt(lesson.concepts, lesson.id, locale);
      if (match) prompts.push(match);
      const listen = listenPrompt(lesson.concepts, lesson.id, locale);
      if (listen) prompts.push(listen);
      lessons.push({
        id: lesson.id,
        unit: unit.id,
        title: lesson.title,
        icon: lesson.review ? "🏆" : "📈",
        review: lesson.review,
        prompts,
      });
    }
  }

  return {
    schemaVersion: 1,
    packId: PACK.packId,
    contentVersion: PACK.contentVersion,
    locale,
    // A wall-clock timestamp here made every regeneration produce a diff even
    // when no content changed, which buried real edits. The content version is
    // what actually identifies a pack revision.
    generatedAt: PACK.contentVersion,
    units,
    concepts,
    lessons,
    sources: SOURCES.map(({ file, ...rest }) => rest),
  };
}

/**
 * Map each concept to the corpus articles that use its term.
 *
 * SOURCES in the pack source declares the real articles (file + metadata);
 * this reads those files and does the term match, so the citation and the
 * corpus gate can never disagree about whether a source covers a term.
 */
function provenanceFor(concepts) {
  const map = new Map();
  const sources = SOURCES;
  if (!sources.length) return map;
  const texts = new Map();
  for (const entry of sources) {
    if (!entry.file) continue; // 文献来源没有语料文件，走 CITES
    const file = path.join(ROOT, "content/corpus", entry.file);
    if (!existsSync(file)) continue;
    texts.set(entry.file, readFileSync(file, "utf8").toLowerCase());
  }
  // Articles that carry the term, plus citations declared explicitly for
  // sources with no corpus file (textbooks and papers). A textbook defines a
  // term without being a news article, so it cannot be matched by reading a
  // corpus file — but it is a stronger source than a headline, not a weaker one.
  const cites = CERTIFIES;
  for (const concept of concepts) {
    const fromCorpus = sources
      .filter(
        (entry) => entry.file && texts.has(entry.file) && corpusHasTerm(texts.get(entry.file), concept.term),
      )
      .map((entry) => entry.id);
    const fromCites = Object.entries(cites)
      .filter(([, terms]) => terms.includes(concept.id))
      .map(([sourceId]) => sourceId);
    const ids = [...new Set([...fromCorpus, ...fromCites])];
    if (ids.length) map.set(concept.id, ids);
  }
  return map;
}

async function generatePack(packId) {
  const { source, drills } = await loadPack(packId);
  CONCEPTS = source.CONCEPTS;
  UNITS = source.UNITS;
  PACK = source.PACK;
  SOURCES = source.SOURCES ?? [];
  CERTIFIES = source.CITES ?? {};
  HEADLINE_DRILLS = drills;
  OUT_DIR = path.join(ROOT, "content/packs", PACK.packId);

  for (const locale of ["zh-CN", "en-US"]) {
    const course = buildCourse(locale);
    // Generation-time mirror of the validator's fill gate: fail loudly here so
    // a leaky stem never reaches course.json in the first place.
    for (const lesson of course.lessons) {
      for (const prompt of lesson.prompts) {
        if (prompt.type === "fill" && fillLeaksAnswer(prompt.story, prompt.answer)) {
          throw new Error(`Fill ${prompt.id} gives the answer away: ${prompt.story}`);
        }
      }
    }
    const file = path.join(OUT_DIR, locale, "course.json");
    writeFileSync(file, `${JSON.stringify(course, null, 2)}\n`);
    const promptCount = course.lessons.reduce((sum, l) => sum + l.prompts.length, 0);
    console.log(
      `[${packId}] ${locale}: ${course.units.length} units, ${course.concepts.length} concepts, ${course.lessons.length} lessons, ${promptCount} prompts`,
    );
  }
}

const only = process.argv.includes("--pack") ? process.argv[process.argv.indexOf("--pack") + 1] : null;
const targets = only ? [only] : availablePacks();
if (!targets.length) {
  console.error("No packs with source.mjs found under content/packs.");
  process.exit(1);
}
for (const packId of targets) {
  await generatePack(packId);
}
