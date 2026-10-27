import { describe, expect, it } from "vitest";
import { blankTerm, fillLeaksAnswer, fillPattern } from "./fill";

describe("fillPattern", () => {
  it("matches the bare term", () => {
    expect(fillPattern("supply").test("weak demand and rising supply")).toBe(true);
  });

  it("matches regular inflections", () => {
    expect(fillPattern("estimate").test("analysts cut their estimates")).toBe(true);
    expect(fillPattern("rate hike").test("before the rate hikes")).toBe(true);
    expect(fillPattern("depreciate").test("the yen depreciated against the dollar")).toBe(true);
    expect(fillPattern("forecast").test("forecasts for next year")).toBe(true);
  });

  it("matches y → ies/ied/ying inflections", () => {
    expect(fillPattern("rally").test("Oil prices rallied 4%")).toBe(true);
    expect(fillPattern("currency").test("Asian currencies slipped")).toBe(true);
    expect(fillPattern("inventory").test("rising inventories")).toBe(true);
    expect(fillPattern("rally").test("profit-taking rally")).toBe(true);
  });

  it("does not match unrelated words or partial stems", () => {
    expect(fillPattern("rally").test("rural electricity")).toBe(false);
    expect(fillPattern("index").test("blue chips headed for a losing streak")).toBe(false);
    // "margin" must not match inside "marginalia": the optional suffix cannot
    // skip the \b boundary.
    expect(fillPattern("margin").test("marginalia")).toBe(false);
  });
});

describe("blankTerm", () => {
  it("blanks an inflected form entirely", () => {
    const result = blankTerm("Oil prices rallied 4% after the supply cut.", "rally");
    expect(result.blanked).toBe(true);
    expect(result.story).toBe("Oil prices ____ 4% after the supply cut.");
  });

  it("blanks the bare term", () => {
    const result = blankTerm("Iron ore fell on rising supply.", "supply");
    expect(result.story).toBe("Iron ore fell on rising ____.");
  });

  it("reports no blank when the term is absent", () => {
    const result = blankTerm("Blue chips headed for a losing streak.", "index");
    expect(result.blanked).toBe(false);
    expect(result.story).toContain("Blue chips");
  });
});

describe("fillLeaksAnswer", () => {
  it("flags a stem that still shows the answer", () => {
    expect(fillLeaksAnswer("Oil prices rallied 4% (这里的词是 ____)。", "rally")).toBe(true);
  });

  it("clears a properly blanked stem", () => {
    expect(fillLeaksAnswer("Oil prices ____ 4% after the supply cut.", "rally")).toBe(false);
    // The blank itself is not a leak, and the fallback hint next to it is fine
    // when the answer is not in the sentence.
    expect(fillLeaksAnswer("Blue chips headed for a losing streak (the word here is ____).", "index")).toBe(
      false,
    );
  });
});
