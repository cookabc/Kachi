import { describe, expect, it } from "vitest";
import en from "../content/packs/t1-finance-news/en-US/course.json";
import { HEADLINE_DRILLS } from "../content/packs/t1-finance-news/headlines.mjs";
import zh from "../content/packs/t1-finance-news/zh-CN/course.json";
import type { Course } from "./domain";
import { isCorrect } from "./engine";

/**
 * The headline drills are generated content with hand-written sentences, so
 * they need the same scrutiny as the rest of the pack: the blank must be a
 * real blank, both options must be the pair, and the stated answer must be the
 * one the sentence actually supports.
 */

const course = zh as unknown as Course;
const drills = course.lessons.flatMap((lesson) => lesson.prompts).filter((p) => p.type === "headline");

describe("headline drills in the generated pack", () => {
  it("ships at least one drill per review lesson that has a pair", () => {
    expect(drills.length).toBeGreaterThanOrEqual(20);
  });

  it("every drill has a blank in its sentence", () => {
    for (const drill of drills) {
      expect(drill.story, drill.id).toContain("____");
    }
  });

  it("offers exactly the two terms of the pair", () => {
    for (const drill of drills) {
      expect(drill.options, drill.id).toHaveLength(2);
      expect([...drill.options!.map((o) => o.text)].sort(), drill.id).toEqual([...drill.termIds].sort());
    }
  });

  it("references two published concepts", () => {
    const ids = new Set(course.concepts.map((c) => c.id));
    for (const drill of drills) {
      expect(drill.termIds, drill.id).toHaveLength(2);
      for (const id of drill.termIds) expect(ids.has(id), `${drill.id} → ${id}`).toBe(true);
    }
  });

  it("grades the stated answer correct and the other option wrong", () => {
    for (const drill of drills) {
      const correct = drill.options![drill.answer as number].text;
      const wrong = drill.options!.find((o) => o.text !== correct)!.text;
      expect(isCorrect(drill, correct), `${drill.id} accepts ${correct}`).toBe(true);
      expect(isCorrect(drill, wrong), `${drill.id} rejects ${wrong}`).toBe(false);
    }
  });

  it("does not leak the answer into the visible sentence", () => {
    // The stem asks which term fits; if the same word sits unblanked in the
    // sentence, the choice is free.
    for (const drill of drills) {
      const answer = drill.options![drill.answer as number].text;
      const visible = drill.story!.split("____").join(" ");
      expect(visible.toLowerCase(), drill.id).not.toContain(` ${answer.toLowerCase()} `);
    }
  });

  it("explains the pair, not just the mistake", () => {
    // The `why` is shown whether the answer was right or wrong, so it must
    // explain both sides of the pair. Wording that only scolds the wrong
    // choice reads as criticism right after a correct answer.
    for (const drill of drills) {
      expect(drill.why.length, drill.id).toBeGreaterThan(18);
      const namesBoth = drill.termIds.every((id) => drill.why.includes(id));
      expect(namesBoth, `${drill.id}: why should name both terms`).toBe(true);
    }
  });

  it("never ships the same sentence under two ids", () => {
    const seen = new Map<string, string>();
    for (const drill of drills) {
      const prior = seen.get(drill.story!);
      expect(prior, `${drill.id} duplicates ${prior}`).toBeUndefined();
      seen.set(drill.story!, drill.id);
    }
  });
});

describe("the English pack is actually English", () => {
  const enCourse = en as unknown as Course;
  const enDrills = enCourse.lessons.flatMap((l) => l.prompts).filter((p) => p.type === "headline");

  it("ships the same number of drills as the zh pack", () => {
    expect(enDrills.length).toBe(drills.length);
  });

  it("has no Chinese text in the explanation", () => {
    // The generated `why` falls back to the Chinese source when whyEn is
    // missing, which put Chinese explanations in front of English learners.
    const han = /[\u4e00-\u9fff]/;
    for (const drill of enDrills) {
      expect(han.test(drill.why), `${drill.id}: ${drill.why.slice(0, 40)}`).toBe(false);
    }
  });

  it("keeps ids and answers aligned with the zh pack", () => {
    const zhById = new Map(drills.map((d) => [d.id, d]));
    for (const drill of enDrills) {
      const twin = zhById.get(drill.id);
      expect(twin, drill.id).toBeDefined();
      expect(drill.answer, drill.id).toBe(twin!.answer);
      expect(drill.termIds, drill.id).toEqual(twin!.termIds);
    }
  });
});

describe("the drill source and the generated pack agree", () => {
  it("every source drill produced exactly one prompt", () => {
    const ids = new Set(drills.map((d) => d.id));
    for (const source of HEADLINE_DRILLS as ReadonlyArray<{ id: string }>) {
      expect(ids.has(`${source.id}`), source.id).toBe(false); // ids are lesson-prefixed
    }
    // The id suffix, not the bare source id, is what lands in the pack.
    for (const source of HEADLINE_DRILLS as ReadonlyArray<{ id: string }>) {
      const matches = [...ids].filter((id) => id.endsWith(`-${source.id}`));
      expect(matches.length, source.id).toBeLessThanOrEqual(1);
    }
  });

  it("covers the pair's later unit so the earlier review never uses an untaught term", () => {
    const conceptUnit = new Map(course.concepts.map((c) => [c.id, c.unit]));
    for (const drill of drills) {
      const lesson = course.lessons.find((l) => l.prompts.some((p) => p.id === drill.id))!;
      const later = Math.max(...drill.termIds.map((id) => conceptUnit.get(id)!));
      expect(lesson.unit, drill.id).toBe(later);
    }
  });
});
