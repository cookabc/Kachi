import { describe, expect, it } from "vitest";
import { course as zhCourse } from "../course";
import type { Course, LearnerState } from "../domain";
import { practiceTargets } from "./PracticeHome";

const course = zhCourse as unknown as Course;

function stateWithDuePair(pairId: string, dueAt: string): LearnerState {
  const [a, b] = pairId.split("::");
  return {
    version: 2,
    xp: 0,
    streak: 0,
    completedLessonIds: [],
    seenConceptIds: [a, b],
    attempts: [],
    mastery: {
      [pairId]: {
        confusionPairId: pairId,
        consecutiveCorrect: 1,
        lapses: 0,
        evidenceTypes: ["match"],
        unseenScenarioCorrect: false,
        dueAt,
        schedulerVersion: "test",
      },
    },
  };
}

describe("practiceTargets", () => {
  it("groups due terms by unit and translates them", () => {
    const targets = practiceTargets(
      stateWithDuePair("hedge::pledge", "2000-01-01T00:00:00Z"),
      course,
      "zh-CN",
    );
    expect(targets.length).toBeGreaterThan(0);
    const flat = targets.flatMap((target) => target.terms);
    expect(flat).toContain("对冲");
    // units come back in ascending order
    const units = targets.map((target) => target.unit);
    expect([...units].sort((x, y) => x - y)).toEqual(units);
  });

  it("drops pair halves that are not published concepts", () => {
    const targets = practiceTargets(
      stateWithDuePair("hedge::no-such-concept", "2000-01-01T00:00:00Z"),
      course,
      "zh-CN",
    );
    const flat = targets.flatMap((target) => target.terms);
    expect(flat).toContain("对冲");
    expect(flat).toHaveLength(1);
  });

  it("keeps the English headword when the UI is English", () => {
    const targets = practiceTargets(
      stateWithDuePair("hedge::pledge", "2000-01-01T00:00:00Z"),
      course,
      "en-US",
    );
    const flat = targets.flatMap((target) => target.terms);
    expect(flat).toContain("hedge");
    expect(flat).toContain("pledge");
    expect(flat.join(" ")).not.toMatch(/\p{Script=Han}/u);
  });

  it("is empty when nothing is due", () => {
    const targets = practiceTargets(
      stateWithDuePair("hedge::pledge", "3000-01-01T00:00:00Z"),
      course,
      "zh-CN",
    );
    expect(targets).toHaveLength(0);
  });
});
