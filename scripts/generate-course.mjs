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
 * 输出：content/packs/t1-finance-news/{zh-CN,en-US}/course.json
 * 用法：node scripts/generate-course.mjs [--check]
 */
import { writeFileSync } from "node:fs";
import path from "node:path";
import { CONCEPTS, PACK, UNITS } from "../content/packs/t1-finance-news/source.mjs";

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "content/packs", PACK.packId);

/** 每单元两课，第三课是复习。6 概念 → 每课 3 个。 */
function lessonsFor(unit) {
  const concepts = CONCEPTS.filter((c) => c.unit === unit.id);
  const half = Math.ceil(concepts.length / 2);
  return [
    { id: `u${unit.id}l1`, concepts: concepts.slice(0, half), review: false, title: unit.title },
    { id: `u${unit.id}l2`, concepts: concepts.slice(half), review: false, title: `${unit.title}（续）` },
    { id: `u${unit.id}r`, concepts, review: true, title: `${unit.title} · 回顾` },
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
  const example = text(concept, "example", locale);
  const blanked = example.replace(new RegExp(concept.term, "i"), "____");
  out.push({
    id: pid("f"),
    type: "fill",
    termId: concept.id,
    termIds: [concept.id],
    story: blanked.includes("____")
      ? blanked
      : `${example} (${locale === "en-US" ? "the word here is" : "这里的词是"} ____)`,
    bank: [...new Set(bank)],
    answer: concept.term,
    why: text(concept, "mixUpWhy", locale),
  });

  return out;
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

function buildCourse(locale) {
  const units = UNITS.map((u) => ({
    id: u.id,
    title: locale === "en-US" ? (u.titleEn ?? u.title) : u.title,
    blurb: locale === "en-US" ? (u.blurbEn ?? u.blurb) : u.blurb,
  }));
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
    relations: [],
    sourceIds: [],
    risk: "evergreen",
    reviewStatus: "legacy",
  }));

  const lessons = [];
  for (const unit of UNITS) {
    for (const lesson of lessonsFor(unit)) {
      const prompts = [];
      lesson.concepts.forEach((concept, i) => {
        const all = promptsFor(concept, i, lesson.concepts, lesson.id, locale);
        // A review lesson re-covers the whole unit, so it takes only the two
        // prompt types that test recall rather than re-teaching the format.
        const keep = lesson.review ? new Set(["-s", "-t"]) : null;
        prompts.push(...(keep ? all.filter((prompt) => keep.has(`-${prompt.id.split("-").pop()}`)) : all));
      });
      const match = matchPrompt(lesson.concepts, lesson.id, locale);
      if (match) prompts.push(match);
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
    generatedAt: new Date().toISOString(),
    units,
    concepts,
    lessons,
    sources: [],
  };
}

for (const locale of ["zh-CN", "en-US"]) {
  const course = buildCourse(locale);
  const file = path.join(OUT_DIR, locale, "course.json");
  writeFileSync(file, `${JSON.stringify(course, null, 2)}\n`);
  const promptCount = course.lessons.reduce((sum, l) => sum + l.prompts.length, 0);
  console.log(
    `${locale}: ${course.units.length} units, ${course.concepts.length} concepts, ${course.lessons.length} lessons, ${promptCount} prompts → ${path.relative(ROOT, file)}`,
  );
}
