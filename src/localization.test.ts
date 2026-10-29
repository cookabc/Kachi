import { describe, expect, it } from "vitest";
import t1 from "../content/packs/t1-finance-news/zh-CN/course.json";
import { course as legacyCourse } from "./course";
import type { Course } from "./domain";
import { zhTermFor } from "./localization";

// The glossary rendered every generated-pack term twice — `indexindex`,
// `auctionauction` — because the Chinese gloss fell back to the concept id.
// Generated packs carry termZh on the concept; the legacy pack keeps its
// glosses in a lookup table. Both must resolve, and a "translation" that is
// just the English word must not be printed at all.
const t1Course = t1 as unknown as Course;

describe("Chinese term lookup", () => {
  it("reads termZh from a generated pack's concept", () => {
    const concept = t1Course.concepts.find((item) => item.id === "index");
    expect(concept).toBeDefined();
    expect(zhTermFor(concept!)).toBe("指数");
  });

  it("falls back to the hand-written gloss table for the legacy pack", () => {
    const concept = legacyCourse.concepts.find((item) => item.id === "hedge");
    expect(concept?.termZh).toBeUndefined();
    expect(zhTermFor(concept!)).toBe("对冲");
  });

  it("returns undefined rather than echoing the English term", () => {
    // No gloss anywhere: printing the id would produce "xyzxyz".
    expect(zhTermFor({ id: "no-such-concept", term: "no-such-concept" })).toBeUndefined();
    // A gloss equal to the term is not a translation either.
    expect(zhTermFor({ id: "x", term: "index", termZh: "index" })).toBeUndefined();
  });
});
