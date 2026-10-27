import { describe, expect, it } from "vitest";
import t1 from "../content/packs/t1-finance-news/zh-CN/course.json";
import { course as legacyCourse } from "./course";
import type { Course } from "./domain";
import { emptyLearnerState, isLessonDone, isLessonUnlocked, lessonKey } from "./engine";
import { upgradeLearnerState } from "./upgrade";

// Two packs both start at "u1l1". Before lesson ids were namespaced by pack,
// finishing T1's first lesson marked the legacy pack's first lesson complete
// too, and the progress counter added the two courses together.
const t1Course = t1 as unknown as Course;

describe("per-pack lesson progress", () => {
  it("stores lesson completion under a pack-qualified key", () => {
    expect(lessonKey(t1Course, "u1l1")).toBe("t1-finance-news/u1l1");
    expect(lessonKey(legacyCourse, "u1l1")).toBe("hedge-or-pledge/u1l1");
  });

  it("does not let one pack's progress unlock another pack's lessons", () => {
    const state = { ...emptyLearnerState(), completedLessonIds: ["t1-finance-news/u1l1"] };

    // T1 moved on.
    expect(isLessonDone(state, t1Course, "u1l1")).toBe(true);
    expect(isLessonUnlocked(state, t1Course, "u1l2")).toBe(true);

    // The legacy pack did not.
    expect(isLessonDone(state, legacyCourse, "u1l1")).toBe(false);
    expect(isLessonUnlocked(state, legacyCourse, "u1l2")).toBe(false);
  });

  it("upgrades bare ids saved before packs existed", () => {
    // A bare id only ever came from the legacy pack, so the upgrade qualifies
    // it with that pack. After that, the engine reads one shape only.
    const upgraded = upgradeLearnerState({
      ...emptyLearnerState(),
      version: 1,
      completedLessonIds: ["u1l1"],
    }).state;
    expect(isLessonDone(upgraded, legacyCourse, "u1l1")).toBe(true);
    // And it must never be read as belonging to a newer pack.
    expect(isLessonDone(upgraded, t1Course, "u1l1")).toBe(false);
  });
});
