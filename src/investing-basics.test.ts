import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import en from "../content/packs/investing-basics/en-US/course.json";
import zh from "../content/packs/investing-basics/zh-CN/course.json";
import { artForSize } from "./art";
import { DEFAULT_PACK, loadCourse, PACKS } from "./course";
import type { Course } from "./domain";
import { fillLeaksAnswer } from "./fill";
import { coursePairs } from "./pairs";
import { validateCourse } from "./schema";
import { findConcept } from "./vocabulary";

describe("investment products and funds", () => {
  it("loads both editions as an optional foundation without renumbering the six courses", async () => {
    expect(DEFAULT_PACK).toBe("t1-finance-news");
    expect(PACKS.find((p) => p.id === "investing-basics")?.level).toBe(0);
    expect(PACKS.find((p) => p.id === "hedge-or-pledge")?.level).toBe(6);
    expect((await loadCourse("investing-basics", "zh-CN")).packId).toBe("investing-basics");
    expect((await loadCourse("investing-basics", "en-US")).locale).toBe("en-US");
  });

  for (const raw of [en, zh]) {
    const course = raw as unknown as Course;
    it(`${course.locale} has usable explanations, provenance, art and non-leaking pair exercises`, () => {
      expect(validateCourse(course)).toEqual([]);
      expect(coursePairs(course).length).toBeGreaterThanOrEqual(7);
      for (const c of course.concepts) {
        expect(c.learning, c.id).toBeTruthy();
        expect(c.sourceIds.length, c.id).toBeGreaterThan(0);
        const art = artForSize(c.id, "hero", true);
        expect(art, c.id).not.toContain("joke");
        const src = art.match(/src="([^"]+)"/)?.[1];
        if (src) expect(existsSync(resolve("public", src.slice(1))), c.id).toBe(true);
        const prompts = course.lessons.flatMap((l) => l.prompts).filter((q) => q.termId === c.id);
        const twin = findConcept(course, c.mixUp)!;
        expect(
          prompts.some((q) => q.type === "meaning" && q.options?.some((o) => o.art === twin.id)),
          c.id,
        ).toBe(true);
        for (const q of prompts.filter((q) => q.type === "fill")) {
          expect(q.bank, q.id).toContain(twin.term);
          expect(fillLeaksAnswer(q.story!, q.answer as string), q.id).toBe(false);
        }
      }
      expect(findConcept(course, "exchange-traded fund")?.id).toBe("etf");
      expect(findConcept(course, "share")?.id).toBe("stock");
      expect(findConcept(course, "equity fund")?.id).toBe("stock fund");
      if (course.locale === "en-US") {
        expect(/[\u4e00-\u9fff]/.test(JSON.stringify(course))).toBe(false);
      }
    });
  }
});
