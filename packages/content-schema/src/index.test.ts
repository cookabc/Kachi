import { describe, expect, it } from "vitest";
import type { Course } from "@kachi/domain";
import { validateCourse } from "./index";

const course: Course = {
  schemaVersion: 1,
  packId: "test",
  contentVersion: "1",
  locale: "zh-CN",
  generatedAt: "2026-08-28T00:00:00.000Z",
  units: [{ id: 1, title: "Test", blurb: "Test" }],
  concepts: [{ id: "a", unit: 1, term: "a", caption: "", definition: "", example: "", mixUp: "b", mixUpWhy: "", sourceIds: [], risk: "evergreen", reviewStatus: "legacy" }, { id: "b", unit: 1, term: "b", caption: "", definition: "", example: "", mixUp: "a", mixUpWhy: "", sourceIds: [], risk: "evergreen", reviewStatus: "legacy" }],
  lessons: [{ id: "one", unit: 1, title: "One", icon: "", review: false, prompts: [{ id: "prompt", type: "truefalse", termId: "a", termIds: ["a"], stem: "", answer: true, why: "" }] }],
  sources: []
};

describe("content validation", () => {
  it("accepts a stable minimal course", () => {
    expect(validateCourse(course)).toEqual([]);
  });
});
