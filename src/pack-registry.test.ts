import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// The course-pack picker showed a Chinese course list (读财经首页…) inside an
// English interface. The registry (content/packs/index.json) carried only
// Chinese names and App rendered pack.title unconditionally, so switching the
// UI language left that one surface translated inconsistently.
//
// This guards the data contract: every pack needs an English title and goal,
// and the English fields must actually be English. The rendering rule
// (lang === "zh-CN" ? pack.title : pack.titleEn) is trivial; the thing that
// rots is a pack added later without titleEn — the picker would silently
// regress to Chinese for that one entry.
const registry = JSON.parse(
  // vitest runs under jsdom, where import.meta.url is not a file: URL.
  readFileSync(resolve(process.cwd(), "content/packs/index.json"), "utf8"),
) as {
  packs: Array<{ id: string; title: string; titleEn?: string; goal: string; goalEn?: string }>;
};

const CJK = /[\u4e00-\u9fff]/;

describe("pack registry is bilingual", () => {
  it("every pack carries an English title and goal", () => {
    for (const pack of registry.packs) {
      expect(pack.titleEn, `${pack.id} has no titleEn (picker would show Chinese in EN UI)`).toBeTruthy();
      expect(pack.goalEn, `${pack.id} has no goalEn (tooltip would show Chinese in EN UI)`).toBeTruthy();
    }
  });

  it("English fields contain no Chinese characters", () => {
    for (const pack of registry.packs) {
      expect(CJK.test(pack.titleEn ?? ""), `${pack.id}.titleEn has CJK: ${pack.titleEn}`).toBe(false);
      expect(CJK.test(pack.goalEn ?? ""), `${pack.id}.goalEn has CJK: ${pack.goalEn}`).toBe(false);
      // And the Chinese fields must actually be the Chinese ones.
      expect(CJK.test(pack.title), `${pack.id}.title should be Chinese`).toBe(true);
    }
  });
});
