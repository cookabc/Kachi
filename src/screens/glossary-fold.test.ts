import { describe, expect, it } from "vitest";
import { isCardOpen } from "./Glossary";

// 40 expanded contrast benches were 21.6 screens of scroll; folded rows cut
// the default glossary to about six. The decision is three lines, but it is
// also the product's main reference view, so the contract is pinned.
describe("glossary card folding", () => {
  it("starts folded when there is no search", () => {
    expect(isCardOpen("hedge", "", new Set())).toBe(false);
  });

  it("opens cards the reader toggled", () => {
    expect(isCardOpen("hedge", "", new Set(["hedge"]))).toBe(true);
    expect(isCardOpen("pledge", "", new Set(["hedge"]))).toBe(false);
  });

  it("expands everything while searching — deep links from the map rely on it", () => {
    expect(isCardOpen("hedge", "hed", new Set())).toBe(true);
    expect(isCardOpen("pledge", "hed", new Set())).toBe(true);
  });
});
