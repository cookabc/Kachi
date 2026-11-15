import { describe, expect, it } from "vitest";
import t1 from "../content/packs/t1-finance-news/zh-CN/course.json";
import type { Course } from "./domain";
import { emptyLearnerState, isLessonDone, isLessonUnlocked, lessonKey } from "./engine";
import { authoredCourse } from "./test-fixtures/authored-course";

// Lesson completion is scoped to its course pack.
const t1Course = t1 as unknown as Course;

describe("per-pack lesson progress", () => {
  it("stores lesson completion under a pack-qualified key", () => {
    expect(lessonKey(t1Course, "u1l1")).toBe("t1-finance-news/u1l1");
    expect(lessonKey(authoredCourse, "u1l1")).toBe("hedge-or-pledge/u1l1");
  });

  it("does not let one pack's progress unlock another pack's lessons", () => {
    const state = { ...emptyLearnerState(), completedLessonIds: ["t1-finance-news/u1l1"] };

    // T1 moved on.
    expect(isLessonDone(state, t1Course, "u1l1")).toBe(true);
    expect(isLessonUnlocked(state, t1Course, "u1l2")).toBe(true);

    // The hand-written pack did not.
    expect(isLessonDone(state, authoredCourse, "u1l1")).toBe(false);
    expect(isLessonUnlocked(state, authoredCourse, "u1l2")).toBe(false);
  });
});
