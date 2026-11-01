import { describe, expect, it } from "vitest";
import { course } from "./course";
import { emptyLearnerState } from "./engine";
import { coursePairs, duePairs, isPairMet, lessonPairs, pairStrength } from "./pairs";
import { legacyCourse } from "./test-fixtures/legacy-course";

describe("course pairs", () => {
  it("lists each confusion pair once, in teaching order", () => {
    const pairs = coursePairs(course);
    expect(pairs[0]).toMatchObject({ id: "rally::selloff", a: "rally", b: "selloff", type: "opposite" });
    expect(new Set(pairs.map((pair) => pair.id)).size).toBe(pairs.length);
  });

  it("gives every hand-written pair a declared mix-up type", () => {
    for (const concept of legacyCourse.concepts) expect(concept.mixUpType, concept.id).toBeTruthy();
  });

  it("counts a pair as met only when both words were seen", () => {
    const [pair] = coursePairs(course);
    const state = emptyLearnerState();
    state.seenConceptIds = [pair.a];
    expect(isPairMet(state, pair)).toBe(false);
    state.seenConceptIds = [pair.a, pair.b];
    expect(isPairMet(state, pair)).toBe(true);
  });

  it("reads strength from the engine's own ladder", () => {
    const base = { confusionPairId: "a::b", lapses: 0, schedulerVersion: "t" };
    expect(pairStrength(undefined)).toBe(0);
    expect(
      pairStrength({
        ...base,
        consecutiveCorrect: 1,
        evidenceTypes: ["meaning"],
        unseenScenarioCorrect: false,
      }),
    ).toBe(1);
    expect(
      pairStrength({
        ...base,
        consecutiveCorrect: 3,
        evidenceTypes: ["meaning"],
        unseenScenarioCorrect: false,
      }),
    ).toBe(2);
    expect(
      pairStrength({
        ...base,
        consecutiveCorrect: 3,
        evidenceTypes: ["meaning", "fill"],
        unseenScenarioCorrect: true,
      }),
    ).toBe(3);
  });

  it("finds only pairs whose review date has passed", () => {
    const state = emptyLearnerState();
    const mastery = {
      lapses: 0,
      consecutiveCorrect: 1,
      evidenceTypes: [],
      unseenScenarioCorrect: false,
      schedulerVersion: "t",
    };
    state.mastery["rally::selloff"] = {
      ...mastery,
      confusionPairId: "rally::selloff",
      dueAt: "2026-01-01T00:00:00Z",
    };
    state.mastery["rebound::slump"] = {
      ...mastery,
      confusionPairId: "rebound::slump",
      dueAt: "2027-01-01T00:00:00Z",
    };
    expect(duePairs(state, course, new Date("2026-06-01")).map((pair) => pair.id)).toEqual([
      "rally::selloff",
    ]);
  });

  it("names a lesson's pairs only when both words are on its screens", () => {
    expect(lessonPairs(course, "u1l1").map((pair) => pair.id)).toContain("rally::selloff");
    const review = lessonPairs(course, "u1r");
    expect(review.every((pair) => pair.unit === 1)).toBe(true);
  });
});

describe("generated questions test the distinction", () => {
  // Every meaning and scenario item offers the concept's twin as a distractor,
  // and every fill item puts the twin in the word bank.
  it("puts the twin among the options", () => {
    for (const lesson of course.lessons) {
      for (const prompt of lesson.prompts) {
        const concept = course.concepts.find((item) => item.id === prompt.termId);
        if (!concept) continue;
        const twin = course.concepts.find((item) => item.id === concept.mixUp);
        if (!twin) continue;
        if (prompt.type === "scenario")
          expect(
            prompt.options?.map((o) => o.text),
            prompt.id,
          ).toContain(twin.term);
        if (prompt.type === "fill") expect(prompt.bank, prompt.id).toContain(twin.term);
      }
    }
  });

  it("never prints the answer inside a scenario question", () => {
    for (const lesson of course.lessons) {
      for (const prompt of lesson.prompts) {
        if (prompt.type !== "scenario" || typeof prompt.answer !== "number") continue;
        const answer = prompt.options?.[prompt.answer]?.text ?? "";
        expect(prompt.story?.toLowerCase().includes(answer.toLowerCase()), prompt.id).toBe(false);
      }
    }
  });
});
