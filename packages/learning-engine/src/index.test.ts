import { describe, expect, it } from "vitest";
import type { Course, Environment } from "@kachi/domain";
import {
  applyAnswer,
  currentExercise,
  emptyLearnerState,
  requeuePrompt,
  recentMissTermIds,
  startSession
} from "./index";

const course: Course = {
  schemaVersion: 1,
  packId: "test",
  contentVersion: "1",
  locale: "zh-CN",
  generatedAt: "2026-08-28T00:00:00.000Z",
  units: [{ id: 1, title: "Test", blurb: "Test" }],
  concepts: [{ id: "hedge", unit: 1, term: "hedge", caption: "", definition: "", example: "", mixUp: "pledge", mixUpWhy: "", sourceIds: [], risk: "evergreen", reviewStatus: "legacy" }],
  lessons: [{ id: "lesson", unit: 1, title: "Test", icon: "", review: false, prompts: [{ id: "one", type: "meaning", termId: "hedge", termIds: ["hedge"], stem: "", options: [{ text: "right" }, { text: "wrong" }], answer: 0, why: "" }] }],
  sources: []
};

const twoPromptCourse: Course = {
  ...course,
  lessons: [{
    ...course.lessons[0],
    prompts: [
      course.lessons[0].prompts[0],
      { id: "two", type: "truefalse", termId: "hedge", termIds: ["hedge"], stem: "", answer: true, why: "" }
    ]
  }]
};

const environment: Environment = {
  now: () => new Date("2026-08-28T12:00:00.000Z"),
  random: () => 0.5,
  deviceId: "test-device",
  eventId: () => "event-1"
};

describe("learning engine", () => {
  it("does not mutate published prompt arrays when a session advances", () => {
    const sourcePromptIds = course.lessons[0].prompts.map((prompt) => prompt.id);
    const session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, emptyLearnerState(), session, "right", environment);

    expect(course.lessons[0].prompts.map((prompt) => prompt.id)).toEqual(sourcePromptIds);
    expect(result.session.promptIds).toEqual(sourcePromptIds);
    expect(result.session.mode).toBe("lesson");
    expect(result.finished).toBe(true);
  });

  it("pays +10 per correct, +20 completion, +20 flawless for a perfect lesson", () => {
    const session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, emptyLearnerState(), session, "right", environment);
    expect(result.state.xp).toBe(50);
  });

  it("does not complete the lesson when the last wrong answer spends the final heart", () => {
    const session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, emptyLearnerState(), session, "wrong", environment, { heartsAfter: 0 });
    expect(result.finished).toBe(true);
    expect(result.state.completedLessonIds).toEqual([]);
    expect(result.state.streak).toBe(0);
    expect(result.state.xp).toBe(0);
    expect(result.attempt.correct).toBe(false);
  });

  it("still completes a lesson finished with hearts left but a wrong last answer", () => {
    const session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, emptyLearnerState(), session, "wrong", environment, { heartsAfter: 2 });
    expect(result.state.completedLessonIds).toEqual(["lesson"]);
    expect(result.state.xp).toBe(20);
  });

  it("requeuePrompt inserts the prompt at the front of the remaining queue", () => {
    const session = startSession(twoPromptCourse, "lesson", environment);
    const answered = applyAnswer(twoPromptCourse, emptyLearnerState(), session, "right", environment);
    expect(answered.session.index).toBe(1);

    const requeued = requeuePrompt(answered.session, "one");
    expect(requeued.promptIds).toEqual(["one", "one", "two"]);
    expect(requeued.index).toBe(1);
    expect(currentExercise(twoPromptCourse, requeued)?.id).toBe("one");

    const requeuedFresh = requeuePrompt(startSession(twoPromptCourse, "lesson", environment), "two");
    expect(requeuedFresh.promptIds).toEqual(["two", "one", "two"]);
  });

  it("recentMissTermIds keeps terms whose latest attempt was wrong", () => {
    let state = emptyLearnerState();
    let session = startSession(course, "lesson", environment);
    state = applyAnswer(course, state, session, "wrong", environment).state;

    expect(recentMissTermIds(state)).toEqual(["hedge"]);

    session = requeuePrompt(session, "one");
    state = applyAnswer(course, state, session, "right", environment).state;
    expect(recentMissTermIds(state)).toEqual([]);
  });
});
