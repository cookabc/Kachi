import { describe, expect, it } from "vitest";
import { artForSize, prefersGeneratedArt } from "./art";
import { artAssetElement, hasAsset } from "./art-assets";
import { course } from "./course";

// The rebuild replaces hand-drawn inline SVG with generated image files once a
// pack grows past the hand-drawing scale. Both systems must coexist: a concept
// with a generated asset renders an <img>, and every legacy concept keeps its
// exact inline SVG so the current pack's look never changes.
describe("generated art assets", () => {
  it("reports an empty manifest honestly instead of inventing a path", () => {
    // An empty manifest is the correct state before generation runs.
    expect(hasAsset("__probe")).toBe(false);
    expect(artAssetElement("__probe", "hero")).toBeNull();
  });

  it("keeps legacy inline SVG when no asset exists", () => {
    expect(hasAsset("hedge")).toBe(false);
    expect(artForSize("hedge", "hero").startsWith("<svg")).toBe(true);
    expect(artForSize("hedge", "xs").startsWith("<svg")).toBe(true);
  });

  it("never falls back to the placeholder for a published concept", () => {
    // The whole art system's promise: a learner never sees the joke icon on a
    // real term. This guards the legacy SVGs now and any generated set later.
    const placeholders = course.concepts
      .filter((concept) => {
        const html = artForSize(concept.id, "hero");
        return !html || html.includes("joke");
      })
      .map((concept) => concept.id);
    expect(placeholders).toEqual([]);
  });
});

describe("one art language per pack", () => {
  // Eleven ids exist in both systems (hand-drawn SVG and generated raster).
  // Before this rule, a generated pack rendered those eleven in the old style
  // and everything else in the new one — two visual languages inside one pack.
  it("generated packs draw raster even for ids that also have hand-drawn art", () => {
    // "margin" is one of the eleven.
    const html = artForSize("margin", "hero", true);
    expect(html).toContain("<img");
  });

  it("the legacy pack keeps hand-drawn art even for ids that also have a raster file", () => {
    const html = artForSize("margin", "hero", false);
    expect(html.startsWith("<svg")).toBe(true);
  });

  it("flags exactly the legacy pack as hand-drawn", () => {
    expect(prefersGeneratedArt({ packId: "hedge-or-pledge" } as never)).toBe(false);
    expect(prefersGeneratedArt({ packId: "t1-finance-news" } as never)).toBe(true);
    expect(prefersGeneratedArt({ packId: "t5-quant-research" } as never)).toBe(true);
  });
});
