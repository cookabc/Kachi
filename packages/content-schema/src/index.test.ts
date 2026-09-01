import type { Course } from "@kachi/domain";
import { describe, expect, it } from "vitest";
import { validateCourse } from "./index";

// A minimal course that satisfies every PRD §7/§8 shape rule: three exercise
// types per lesson, scenario after u1l1, terms covered by two prompts in two
// types, and reviews that never reference a later unit.
function validCourse(): Course {
  return {
    schemaVersion: 1,
    packId: "test",
    contentVersion: "1",
    locale: "zh-CN",
    generatedAt: "2026-08-28T00:00:00.000Z",
    units: [
      { id: 1, title: "Unit One", blurb: "" },
      { id: 2, title: "Unit Two", blurb: "" },
    ],
    concepts: [
      {
        id: "a",
        unit: 1,
        term: "a",
        caption: "",
        definition: "",
        example: "",
        mixUp: "b",
        mixUpWhy: "",
        sourceIds: [],
        risk: "evergreen",
        reviewStatus: "legacy",
      },
      {
        id: "b",
        unit: 1,
        term: "b",
        caption: "",
        definition: "",
        example: "",
        mixUp: "a",
        mixUpWhy: "",
        sourceIds: [],
        risk: "evergreen",
        reviewStatus: "legacy",
      },
      {
        id: "c",
        unit: 2,
        term: "c",
        caption: "",
        definition: "",
        example: "",
        mixUp: "a",
        mixUpWhy: "",
        sourceIds: [],
        risk: "evergreen",
        reviewStatus: "legacy",
      },
    ],
    lessons: [
      {
        id: "u1l1",
        unit: 1,
        title: "One",
        icon: "",
        review: false,
        prompts: [
          { id: "p1", type: "truefalse", termId: "a", termIds: ["a"], stem: "", answer: true, why: "" },
          {
            id: "p2",
            type: "meaning",
            termId: "a",
            termIds: ["a"],
            stem: "",
            options: [{ text: "right" }, { text: "wrong" }],
            answer: 0,
            why: "",
          },
          {
            id: "p3",
            type: "meaning",
            termId: "b",
            termIds: ["b"],
            stem: "",
            options: [{ text: "right" }, { text: "wrong" }],
            answer: 0,
            why: "",
          },
          {
            id: "p4",
            type: "fill",
            termId: "b",
            termIds: ["b"],
            story: "",
            bank: ["b", "a"],
            answer: "b",
            why: "",
          },
        ],
      },
      {
        id: "u1r",
        unit: 1,
        title: "Unit one review",
        icon: "",
        review: true,
        prompts: [
          {
            id: "r1",
            type: "scenario",
            termId: "a",
            termIds: ["a"],
            story: "",
            stem: "",
            options: [{ text: "right" }, { text: "wrong" }],
            answer: 0,
            why: "",
          },
          { id: "r2", type: "truefalse", termId: "b", termIds: ["b"], stem: "", answer: true, why: "" },
          {
            id: "r3",
            type: "match",
            termIds: ["a", "b"],
            why: "",
            pairs: [
              { id: "a", left: "a", right: "A" },
              { id: "b", left: "b", right: "B" },
            ],
          },
        ],
      },
      {
        id: "u2l1",
        unit: 2,
        title: "Two",
        icon: "",
        review: false,
        prompts: [
          {
            id: "q1",
            type: "scenario",
            termId: "c",
            termIds: ["c"],
            story: "",
            stem: "",
            options: [{ text: "right" }, { text: "wrong" }],
            answer: 0,
            why: "",
          },
          {
            id: "q2",
            type: "meaning",
            termId: "c",
            termIds: ["c"],
            stem: "",
            options: [{ text: "right" }, { text: "wrong" }],
            answer: 0,
            why: "",
          },
          { id: "q3", type: "truefalse", termId: "c", termIds: ["c"], stem: "", answer: false, why: "" },
        ],
      },
    ],
    sources: [],
  };
}

describe("content validation", () => {
  it("accepts a course that satisfies the PRD §7/§8 shape rules", () => {
    expect(validateCourse(validCourse())).toEqual([]);
  });

  it("flags lessons that use fewer than three exercise types", () => {
    const course = validCourse();
    course.lessons[2].prompts = course.lessons[2].prompts.filter((prompt) => prompt.type === "meaning");
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "u2l1" && /at least three/.test(issue.message))).toBe(true);
  });

  it("flags lessons after u1l1 without a scenario", () => {
    const course = validCourse();
    course.lessons[2].prompts = course.lessons[2].prompts.filter((prompt) => prompt.type !== "scenario");
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "u2l1" && /scenario/.test(issue.message))).toBe(true);
  });

  it("flags review lessons that test a term from a later unit", () => {
    const course = validCourse();
    course.lessons[1].prompts.push({
      id: "r4",
      type: "truefalse",
      termId: "c",
      termIds: ["c"],
      stem: "",
      answer: true,
      why: "",
    });
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "u1r" && /before it is taught/.test(issue.message))).toBe(
      true,
    );
  });

  it("flags terms without two prompts across two exercise types", () => {
    const course = validCourse();
    const orphan: Course["concepts"][number] = { ...course.concepts[2], id: "d", term: "d", mixUp: "a" };
    course.concepts.push(orphan);
    const issues = validateCourse(course);
    expect(
      issues.some((issue) => issue.path === "d" && /at least two prompts in two types/.test(issue.message)),
    ).toBe(true);
  });

  it.each([-1, 2, 0.5, Number.NaN])("flags an invalid choice answer index: %s", (answer) => {
    const course = validCourse();
    course.lessons[0].prompts[1].answer = answer;
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "p2" && /outside options range/.test(issue.message))).toBe(
      true,
    );
  });

  it("flags a true/false exercise without a boolean answer", () => {
    const course = validCourse();
    course.lessons[0].prompts[0].answer = "true";
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "p1" && /boolean answer/.test(issue.message))).toBe(true);
  });

  it("flags a fill answer that is not exactly present in its bank", () => {
    const course = validCourse();
    course.lessons[0].prompts[3].answer = "B";
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "p4" && /not present in the bank/.test(issue.message))).toBe(
      true,
    );
  });

  it("flags duplicate, unknown, and termIds-drifted match pair IDs", () => {
    const course = validCourse();
    const match = course.lessons[1].prompts[2];
    match.pairs = [
      { id: "a", left: "a", right: "A" },
      { id: "a", left: "bogus", right: "B" },
      { id: "unknown", left: "unknown", right: "U" },
    ];
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "r3" && /Duplicate match pair ID/.test(issue.message))).toBe(
      true,
    );
    expect(
      issues.some((issue) => issue.path === "r3" && /Unknown match pair ID: unknown/.test(issue.message)),
    ).toBe(true);
    expect(
      issues.some((issue) => issue.path === "r3" && /termIds must exactly match/.test(issue.message)),
    ).toBe(true);
  });

  it("allows only the explicit match pseudo-term IDs", () => {
    const allowed = validCourse();
    const match = allowed.lessons[1].prompts[2];
    match.termIds = ["sell", "put_u1intro"];
    match.pairs = [
      { id: "sell", left: "sell", right: "S" },
      { id: "put_u1intro", left: "a put", right: "P" },
    ];
    expect(validateCourse(allowed).filter((issue) => issue.path === "r3")).toEqual([]);

    const rejected = validCourse();
    rejected.lessons[0].prompts[1].termIds = ["sell"];
    const issues = validateCourse(rejected);
    expect(
      issues.some((issue) => issue.path === "p2" && /Unknown term reference: sell/.test(issue.message)),
    ).toBe(true);
  });
});
