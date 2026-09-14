import { describe, expect, it } from "vitest";
import { artForSize, artIdForLabel, HERO_ART, TERM_ART } from "./art";
import { course } from "./course";

describe("artIdForLabel", () => {
  it("resolves exact term ids, case, articles, and trailing periods", () => {
    expect(artIdForLabel("hedge")).toBe("hedge");
    expect(artIdForLabel("Hedge")).toBe("hedge");
    expect(artIdForLabel("a put")).toBe("put");
    expect(artIdForLabel("hedge.")).toBe("hedge");
  });

  it("resolves the real-phrase aliases", () => {
    expect(artIdForLabel("capital gain")).toBe("capital gains");
    expect(artIdForLabel("future")).toBe("futures");
    expect(artIdForLabel("short")).toBe("short selling");
    expect(artIdForLabel("short sale")).toBe("short selling");
    expect(artIdForLabel("pledged")).toBe("pledge");
    expect(artIdForLabel("marked")).toBe("mark-to-market");
    expect(artIdForLabel("in default")).toBe("default");
    expect(artIdForLabel("sbl")).toBe("securities-backed loan");
    expect(artIdForLabel("true")).toBe("true");
    expect(artIdForLabel("false")).toBe("false");
    expect(artIdForLabel("sell")).toBe("sell");
  });

  it("falls back to the joke art only for unmapped labels", () => {
    expect(artIdForLabel("banana")).toBe("joke");
    expect(artIdForLabel(null)).toBe("joke");
    expect(artIdForLabel("")).toBe("joke");
  });
});

describe("hero scenes", () => {
  it("only carries scenes for published concept ids", () => {
    const published = new Set(course.concepts.map((concept) => concept.id));
    const stray = Object.keys(HERO_ART).filter((id) => !published.has(id));
    expect(stray).toEqual([]);
  });

  it("covers every published concept across all five units", () => {
    const missing = course.concepts.filter((concept) => !HERO_ART[concept.id]).map((concept) => concept.id);
    expect(missing).toEqual([]);
  });

  it("serves the scene at hero size and the icon at chip sizes", () => {
    expect(artForSize("hedge", "hero")).toBe(HERO_ART.hedge);
    expect(artForSize("hedge", "lg")).toBe(TERM_ART.hedge);
    expect(artForSize("hedge", "xs")).toBe(TERM_ART.hedge);
  });

  it("falls back to TERM_ART for hero ids that never get a scene", () => {
    // "true"/"false" are answer art, not concepts — posterization never reaches them
    expect(artForSize("true", "hero")).toBe(TERM_ART.true);
    expect(artForSize("false", "hero")).toBe(TERM_ART.false);
  });

  it("strips the _u1intro suffix before scene lookup", () => {
    expect(artForSize("hedge_u1intro", "hero")).toBe(HERO_ART.hedge);
    expect(artForSize("nope_u1intro", "hero")).toBe(TERM_ART.joke);
  });
});

describe("term art coverage", () => {
  it("has palette art for every published concept", () => {
    const missing = course.concepts.filter((concept) => !TERM_ART[concept.id]).map((concept) => concept.id);
    expect(missing).toEqual([]);
  });

  it("resolves every option art reference in the course", () => {
    const broken: string[] = [];
    course.lessons.forEach((lesson) => {
      lesson.prompts.forEach((prompt) => {
        (prompt.options ?? []).forEach((option) => {
          const id = option.art ?? artIdForLabel(option.text);
          if (!TERM_ART[id]) broken.push(`${lesson.id}/${prompt.id}: ${option.art ?? option.text}`);
        });
      });
    });
    expect(broken).toEqual([]);
  });

  it("resolves every fill-bank word to real art, never the joke fallback", () => {
    const jokes: string[] = [];
    course.lessons.forEach((lesson) => {
      lesson.prompts.forEach((prompt) => {
        (prompt.bank ?? []).forEach((word) => {
          if (artIdForLabel(word) === "joke") jokes.push(`${lesson.id}/${prompt.id}: ${word}`);
        });
      });
    });
    expect(jokes).toEqual([]);
  });
});
