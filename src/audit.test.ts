import { describe, expect, it } from "vitest";
import type { Concept, Course, Exercise } from "./domain";
import { applyAnswer, emptyLearnerState, isCorrect, startSession } from "./engine";
import { present } from "./flow";
import { validateCourse } from "./schema";
import { UI } from "./ui";

// The audit exercise is the only type that teaches scepticism: a claim about a
// backtest, and several statements about it, exactly one of which does not hold.
// It reuses the choice-shaped grading path deliberately — one right option, the
// rest wrong — so no scoring logic had to change to support it.
const auditPrompt: Exercise = {
  id: "t5-audit-1",
  type: "audit",
  termId: "overfitting",
  termIds: ["overfitting"],
  story:
    "Strategy X returned 41% a year over 2015-2024 after testing 2,000 parameter combinations on the same period.",
  stem: "Which statement does not hold?",
  options: [
    { text: "The reported return is in-sample and has not been tested out of sample." },
    { text: "Two thousand combinations make a lucky winner likely even from pure noise." },
    { text: "A 41% annual return proves the strategy will keep working." },
    { text: "Trading costs would reduce the return further." },
  ],
  answer: 2,
  why: "Two thousand tries on one period almost guarantee a good-looking survivor; the return is a best-of sample, not an expectation.",
};

const concept = (id: string, term: string, mixUp: string): Concept => ({
  id,
  unit: 1,
  term,
  caption: "t",
  definition: "d",
  example: "e",
  mixUp,
  mixUpWhy: "w",
  relations: [],
  sourceIds: [],
  risk: "evergreen",
  reviewStatus: "legacy",
});

const pair = (term: string, id: string): Exercise[] => [
  {
    id: `${id}-meaning`,
    type: "meaning",
    termId: id,
    termIds: [id],
    stem: `${term}?`,
    options: [{ text: "a" }, { text: "b" }],
    answer: 0,
    why: "y",
  },
  {
    id: `${id}-fill`,
    type: "fill",
    termId: id,
    termIds: [id],
    story: "Use ____ here.",
    bank: [term, "other"],
    answer: term,
    why: "y",
  },
];

/** A lesson that satisfies PRD §7 and §8 so audit is tested inside legal content. */
function courseWith(prompt: Exercise): Course {
  return {
    schemaVersion: 1,
    packId: "test-audit",
    contentVersion: "test",
    locale: "zh-CN",
    generatedAt: "test",
    units: [{ id: 1, title: "u", blurb: "b" }],
    concepts: [
      concept("overfitting", "overfitting", "backtest"),
      concept("backtest", "backtest", "overfitting"),
    ],
    lessons: [
      {
        id: "u1l1",
        unit: 1,
        title: "t",
        icon: "x",
        review: false,
        prompts: [prompt, ...pair("overfitting", "overfitting"), ...pair("backtest", "backtest")],
      },
    ],
    sources: [],
  };
}

describe("audit exercise", () => {
  it("passes structural validation inside a legal lesson", () => {
    expect(validateCourse(courseWith(auditPrompt))).toEqual([]);
  });

  it("grades the unsound statement as correct and a sound one as wrong", () => {
    const course = courseWith(auditPrompt);
    const env = {
      now: () => new Date("2026-10-28T00:00:00Z"),
      random: () => 0.5,
      deviceId: "d",
      eventId: () => "e1",
    };
    const session = startSession(course, "u1l1", env);

    expect(isCorrect(auditPrompt, auditPrompt.options![2].text)).toBe(true);
    expect(isCorrect(auditPrompt, auditPrompt.options![0].text)).toBe(false);

    const right = applyAnswer(course, emptyLearnerState(), session, auditPrompt.options![2].text, env);
    expect(right.attempt.correct).toBe(true);
    expect(right.attempt.exerciseType).toBe("audit");
  });

  it("shuffles the statements but keeps the correct one identifiable", () => {
    const shown = present(auditPrompt, () => 0.99);
    expect(shown.correctText).toBe(auditPrompt.options![2].text);
    expect(shown.options).toHaveLength(4);
  });
});

describe("audit feedback copy", () => {
  // The default verdict lines talk about mixing up a pair ("That pair again").
  // On an audit item that reads as nonsense: nothing was confused with anything,
  // the learner either caught a bad argument or let one through.
  it("has its own verdict lines in both locales", () => {
    for (const locale of ["zh-CN", "en-US"] as const) {
      const v = UI[locale].verdicts;
      expect(v.auditNice.length).toBeGreaterThan(0);
      expect(v.auditNope.length).toBeGreaterThan(0);
    }
  });
});
