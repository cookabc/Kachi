import { describe, expect, it } from "vitest";
import t1En from "../content/packs/t1-finance-news/en-US/course.json";
import { HEADLINE_DRILLS as T1_DRILLS } from "../content/packs/t1-finance-news/headlines.mjs";
import t1Zh from "../content/packs/t1-finance-news/zh-CN/course.json";
import t2En from "../content/packs/t2-company-earnings/en-US/course.json";
import { HEADLINE_DRILLS as T2_DRILLS } from "../content/packs/t2-company-earnings/headlines.mjs";
import t2Zh from "../content/packs/t2-company-earnings/zh-CN/course.json";
import t3En from "../content/packs/t3-bonds-rates/en-US/course.json";
import { HEADLINE_DRILLS as T3_DRILLS } from "../content/packs/t3-bonds-rates/headlines.mjs";
import t3Zh from "../content/packs/t3-bonds-rates/zh-CN/course.json";
import t4En from "../content/packs/t4-forex-macro/en-US/course.json";
import { HEADLINE_DRILLS as T4_DRILLS } from "../content/packs/t4-forex-macro/headlines.mjs";
import t4Zh from "../content/packs/t4-forex-macro/zh-CN/course.json";
import type { Course } from "./domain";
import { isCorrect } from "./engine";

/**
 * The headline drills are generated content with hand-written sentences, so
 * they need the same scrutiny as the rest of a pack: the blank must be a real
 * blank, both options must be the pair, and the stated answer must be the one
 * the sentence actually supports. T1–T4 all carry them now; T5 reads research
 * notes rather than headlines and uses the audit task instead.
 */
const PACKS = [
  { id: "t1", zh: t1Zh, en: t1En, source: T1_DRILLS, min: 20 },
  { id: "t2", zh: t2Zh, en: t2En, source: T2_DRILLS, min: 12 },
  { id: "t3", zh: t3Zh, en: t3En, source: T3_DRILLS, min: 10 },
  { id: "t4", zh: t4Zh, en: t4En, source: T4_DRILLS, min: 10 },
] as const;

for (const pack of PACKS) {
  const course = pack.zh as unknown as Course;
  const enCourse = pack.en as unknown as Course;
  const drills = course.lessons.flatMap((lesson) => lesson.prompts).filter((p) => p.type === "headline");
  const enDrills = enCourse.lessons.flatMap((l) => l.prompts).filter((p) => p.type === "headline");
  const termOf = new Map(course.concepts.map((c) => [c.id, c.term]));

  describe(`${pack.id} headline drills`, () => {
    it("ships every source drill into a review lesson", () => {
      expect(drills.length).toBeGreaterThanOrEqual(pack.min);
      expect(drills.length).toBe(pack.source.length);
    });

    it("every drill has a blank in its sentence", () => {
      for (const drill of drills) expect(drill.story, drill.id).toContain("____");
    });

    it("offers exactly the two terms of the pair, shown as headwords", () => {
      for (const drill of drills) {
        expect(drill.options, drill.id).toHaveLength(2);
        expect([...drill.options!.map((o) => o.art ?? o.text)].sort(), drill.id).toEqual(
          [...drill.termIds].sort(),
        );
        for (const option of drill.options!) expect(option.text, drill.id).toBe(termOf.get(option.art ?? ""));
      }
    });

    it("references two published concepts", () => {
      for (const drill of drills) {
        expect(drill.termIds, drill.id).toHaveLength(2);
        for (const id of drill.termIds) expect(termOf.has(id), `${drill.id} → ${id}`).toBe(true);
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
      for (const drill of drills) {
        const answer = drill.options![drill.answer as number].text;
        const visible = ` ${drill.story!.split("____").join(" ").toLowerCase()} `;
        expect(visible, drill.id).not.toMatch(
          new RegExp(`[^a-z]${answer.toLowerCase().replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}[^a-z]`),
        );
      }
    });

    it("explains both sides of the pair, in each language", () => {
      // The `why` shows whether the answer was right or wrong, so it must name
      // both words — scolding only the wrong one reads as criticism after a hit.
      for (const [list, lang] of [
        [drills, "zh"],
        [enDrills, "en"],
      ] as const) {
        for (const drill of list) {
          expect(drill.why.length, drill.id).toBeGreaterThan(18);
          for (const id of drill.termIds) {
            const term = termOf.get(id) ?? id;
            expect(drill.why.toLowerCase(), `${lang} ${drill.id} names ${term}`).toContain(
              term.toLowerCase(),
            );
          }
        }
      }
    });

    it("keeps Chinese out of the English explanations and ids aligned across locales", () => {
      const han = /[\u4e00-\u9fff]/;
      const zhById = new Map(drills.map((d) => [d.id, d]));
      expect(enDrills.length).toBe(drills.length);
      for (const drill of enDrills) {
        expect(han.test(drill.why), `${drill.id}: ${drill.why.slice(0, 40)}`).toBe(false);
        const twin = zhById.get(drill.id);
        expect(twin, drill.id).toBeDefined();
        expect(drill.answer, drill.id).toBe(twin!.answer);
        expect(drill.termIds, drill.id).toEqual(twin!.termIds);
      }
    });

    it("never ships the same sentence twice", () => {
      expect(new Set(drills.map((d) => d.story)).size).toBe(drills.length);
    });

    it("sits in the pair's later unit so an earlier review never uses an untaught term", () => {
      const conceptUnit = new Map(course.concepts.map((c) => [c.id, c.unit]));
      for (const drill of drills) {
        const lesson = course.lessons.find((l) => l.prompts.some((p) => p.id === drill.id))!;
        const later = Math.max(...drill.termIds.map((id) => conceptUnit.get(id)!));
        expect(lesson.unit, drill.id).toBe(later);
        expect(lesson.review, drill.id).toBe(true);
      }
    });
  });
}
