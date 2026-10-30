import { describe, expect, it } from "vitest";
import type { Course } from "../domain";
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

  it("flags a mix-up type the teach card cannot label", () => {
    const course = validCourse();
    // "scope" and "direction" are real types used by the shipped packs. A value
    // outside the list used to pass validation and then render an empty label.
    course.concepts[0].mixUpType = "scope";
    expect(validateCourse(course)).toEqual([]);

    course.concepts[0].mixUpType = "unlabelled" as never;
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "a" && /mix-up type/.test(issue.message))).toBe(true);
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

  it.each(["draft", "reviewed"] as const)(
    "flags a governed %s time-sensitive term missing asOf and reviewDue",
    (status) => {
      const course = validCourse();
      const term = course.concepts[0];
      term.risk = "time-sensitive";
      term.reviewStatus = status;
      const issues = validateCourse(course);
      expect(issues.some((issue) => issue.path === "a" && /requires asOf/.test(issue.message))).toBe(true);
      expect(
        issues.some((issue) => issue.path === "a" && /requires a reviewDue date/.test(issue.message)),
      ).toBe(true);
    },
  );

  it("flags a draft jurisdictional term missing jurisdiction and source, but not its present dates", () => {
    const course = validCourse();
    const term = course.concepts[0];
    term.risk = "jurisdictional";
    term.reviewStatus = "draft";
    term.asOf = "2026-09-01";
    term.reviewDue = "2027-09-01";
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "a" && /named jurisdiction/.test(issue.message))).toBe(true);
    expect(issues.some((issue) => issue.path === "a" && /at least one source/.test(issue.message))).toBe(
      true,
    );
    expect(issues.some((issue) => /requires asOf|requires a reviewDue date/.test(issue.message))).toBe(false);
  });

  it("treats whitespace-only provenance fields as missing", () => {
    const course = validCourse();
    const term = course.concepts[0];
    term.risk = "time-sensitive";
    term.reviewStatus = "reviewed";
    term.asOf = "   ";
    const issues = validateCourse(course);
    expect(issues.some((issue) => issue.path === "a" && /requires asOf/.test(issue.message))).toBe(true);
  });

  it("accepts a reviewed jurisdictional term with jurisdiction, dates, and a real source", () => {
    const course = validCourse();
    course.sources.push({
      id: "s1",
      title: "A real source",
      kind: "news",
      rightsBasis: "facts-only",
    });
    const term = course.concepts[0];
    term.risk = "jurisdictional";
    term.reviewStatus = "reviewed";
    term.asOf = "2026-09-01";
    term.reviewDue = "2027-09-01";
    term.jurisdiction = "US";
    term.sourceIds = ["s1"];
    expect(validateCourse(course)).toEqual([]);
  });

  it("grandfathers a legacy jurisdictional term without provenance fields", () => {
    const course = validCourse();
    const term = course.concepts[0];
    term.risk = "jurisdictional";
    term.reviewStatus = "legacy";
    // Mirrors the shipped Unit 5 remediation debt: flagged risk, no fields yet.
    expect(validateCourse(course)).toEqual([]);
  });

  it("does not require provenance fields for evergreen drafts", () => {
    const course = validCourse();
    course.concepts[0].reviewStatus = "draft";
    expect(validateCourse(course)).toEqual([]);
  });

  it("accepts only ids that art.tsx declares as out-of-syllabus", () => {
    // "sell" is a legitimate distractor answer and has art, but it is not a
    // concept. The declaration lives in the art layer so the two cannot drift.
    const allowed = validCourse();
    allowed.lessons[0].prompts[1].termIds = ["sell"];
    expect(validateCourse(allowed).some((issue) => /Unknown term reference: sell/.test(issue.message))).toBe(
      false,
    );

    // A made-up id has no art and is not a concept: still rejected.
    const rejected = validCourse();
    rejected.lessons[0].prompts[1].termIds = ["made-up-term"];
    expect(
      validateCourse(rejected).some((issue) => /Unknown term reference: made-up-term/.test(issue.message)),
    ).toBe(true);
  });

  it("rejects the retired put_u1intro pseudo-id", () => {
    // Content used to smuggle an art-only id through a hardcoded allowlist.
    // It now resolves to the real concept id instead.
    const course = validCourse();
    course.lessons[0].prompts[1].termIds = ["put_u1intro"];
    expect(
      validateCourse(course).some((issue) => /Unknown term reference: put_u1intro/.test(issue.message)),
    ).toBe(true);
  });

  it("accepts concept relations that reference published concepts", () => {
    const course = validCourse();
    course.concepts[0].relations = [
      { type: "confusable", with: "b" },
      { type: "prereq", with: "c" },
      { type: "sibling", with: "b" },
    ];
    // The same pair may carry two edges of different types (confusable + sibling).
    expect(validateCourse(course)).toEqual([]);
  });

  it("rejects relations with unknown targets, self targets, duplicates, and bad types", () => {
    const course = validCourse();
    course.concepts[0].relations = [
      { type: "confusable", with: "nonexistent" },
      { type: "sibling", with: "a" },
    ];
    let issues = validateCourse(course);
    expect(issues.some((issue) => /Unknown relation target: nonexistent/.test(issue.message))).toBe(true);
    expect(issues.some((issue) => /Relation targets itself: a/.test(issue.message))).toBe(true);

    const duplicated = validCourse();
    duplicated.concepts[0].relations = [
      { type: "sibling", with: "b" },
      { type: "sibling", with: "b" },
    ];
    issues = validateCourse(duplicated);
    expect(issues.some((issue) => /Duplicate relation: sibling::b/.test(issue.message))).toBe(true);

    const badType = validCourse();
    badType.concepts[0].relations = [{ type: "enemy" as never, with: "b" }];
    issues = validateCourse(badType);
    expect(issues.some((issue) => /Unknown relation type: enemy/.test(issue.message))).toBe(true);
  });
});
