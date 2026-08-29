import { describe, expect, it } from "vitest";
import type { Course, Environment, Exercise, LearnerState, SessionState } from "@kachi/domain";
import {
  applyAnswer,
  currentExercise,
  duePairIds,
  emptyLearnerState,
  isCorrect,
  isLessonUnlocked,
  isVerifiedMastery,
  requeuePrompt,
  recentMissTermIds,
  startPracticeSession,
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

  it("counts a lesson finished just after local midnight as the new local day", () => {
    // 00:30 local on 29 Aug. In UTC+8 that instant is 16:30 UTC on 28 Aug —
    // "today" must follow the learner's calendar, not the UTC one (PRD §9).
    const afterMidnight: Environment = { ...environment, now: () => new Date(2026, 7, 29, 0, 30, 0) };
    const yesterday: LearnerState = { ...emptyLearnerState(), streak: 3, lastLessonDate: "2026-08-28" };
    const session = startSession(course, "lesson", afterMidnight);
    const result = applyAnswer(course, yesterday, session, "right", afterMidnight);

    expect(result.state.lastLessonDate).toBe("2026-08-29");
    expect(result.state.streak).toBe(4);
  });

  it("does not double-count a second lesson finished on the same local day", () => {
    const lateTonight: Environment = { ...environment, now: () => new Date(2026, 7, 29, 23, 30, 0) };
    const earlierToday: LearnerState = { ...emptyLearnerState(), streak: 3, lastLessonDate: "2026-08-29" };
    const session = startSession(course, "lesson", lateTonight);
    const result = applyAnswer(course, earlierToday, session, "right", lateTonight);

    expect(result.state.streak).toBe(3);
  });

  it("restarts the streak after a skipped local day", () => {
    const now: Environment = { ...environment, now: () => new Date(2026, 7, 29, 12, 0, 0) };
    const threeDaysAgo: LearnerState = { ...emptyLearnerState(), streak: 5, lastLessonDate: "2026-08-26" };
    const session = startSession(course, "lesson", now);
    const result = applyAnswer(course, threeDaysAgo, session, "right", now);

    expect(result.state.streak).toBe(1);
  });
});

describe("mastery scheduling", () => {
  function answerAgain(state: LearnerState, session: SessionState, answer: string, hintUsed = false) {
    const requeued = requeuePrompt(session, "one");
    return applyAnswer(course, state, requeued, answer, environment, { hintUsed });
  }

  it("walks the review-interval ladder on consecutive corrects", () => {
    let state = emptyLearnerState();
    let session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, state, session, "right", environment);
    state = result.state;
    session = result.session;

    const pairId = "hedge::pledge";
    // after the first correct (consecutive 1, due +1d) the 2nd..7th corrects
    // walk REVIEW_INTERVAL_DAYS[1..5] and cap at 60d
    const intervals = [3, 7, 14, 30, 60, 60, 60];
    intervals.forEach((days, index) => {
      const next = answerAgain(state, session, "right");
      state = next.state;
      session = next.session;
      const mastery = state.mastery[pairId];
      expect(mastery.consecutiveCorrect).toBe(Math.min(index + 2, 6));
      expect(mastery.dueAt).toBe(new Date(Date.parse("2026-08-28T12:00:00.000Z") + days * 86_400_000).toISOString());
    });
    expect(state.mastery[pairId].lapses).toBe(0);
  });

  it("treats a wrong answer as a lapse that resets the ladder", () => {
    let state = emptyLearnerState();
    let session = startSession(course, "lesson", environment);
    const first = applyAnswer(course, state, session, "right", environment);
    state = first.state;
    session = first.session;
    const second = applyAnswer(course, state, requeuePrompt(session, "one"), "wrong", environment);
    state = second.state;

    const mastery = state.mastery["hedge::pledge"];
    expect(mastery.consecutiveCorrect).toBe(0);
    expect(mastery.lapses).toBe(1);
    expect(mastery.dueAt).toBe(new Date(Date.parse("2026-08-28T12:00:00.000Z") + 86_400_000).toISOString());
  });

  it("treats a hint-assisted correct as a lapse", () => {
    let state = emptyLearnerState();
    const session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, state, session, "right", environment, { hintUsed: true });

    const mastery = result.state.mastery["hedge::pledge"];
    expect(result.attempt.hintUsed).toBe(true);
    expect(mastery.consecutiveCorrect).toBe(0);
    expect(mastery.lapses).toBe(1);
  });

  it("records evidence types and unseen-scenario credit", () => {
    const scenarioCourse: Course = {
      ...course,
      concepts: [...course.concepts],
      lessons: [{
        ...course.lessons[0],
        prompts: [
          { id: "meaning-one", type: "meaning", termId: "hedge", termIds: ["hedge"], stem: "", options: [{ text: "right" }], answer: 0, why: "" },
          { id: "fill-one", type: "fill", termId: "hedge", termIds: ["hedge"], story: "", bank: ["hedge"], answer: "hedge", why: "" },
          { id: "scene-one", type: "scenario", termId: "hedge", termIds: ["hedge"], story: "", stem: "", options: [{ text: "right" }], answer: 0, why: "", assessmentOnly: true }
        ]
      }]
    };
    let state = emptyLearnerState();
    let session = startSession(scenarioCourse, "lesson", environment);
    for (const prompt of scenarioCourse.lessons[0].prompts) {
      const answer = prompt.type === "fill" ? "hedge" : "right";
      const result = applyAnswer(scenarioCourse, state, session, answer, environment);
      state = result.state;
      session = result.session;
    }
    const mastery = state.mastery["hedge::pledge"];
    expect(mastery.evidenceTypes).toEqual(["meaning", "fill", "scenario"]);
    expect(mastery.unseenScenarioCorrect).toBe(true);
    expect(isVerifiedMastery(mastery)).toBe(true); // 3 consecutive corrects, 3 types, unseen scenario passed

    // one lapse drops consecutive corrects to zero, so verified mastery is lost
    const requeued = requeuePrompt(session, "meaning-one");
    const lapsed = applyAnswer(scenarioCourse, state, requeued, "wrong", environment);
    expect(isVerifiedMastery(lapsed.state.mastery["hedge::pledge"])).toBe(false);
    expect(lapsed.state.mastery["hedge::pledge"].lapses).toBe(1);
  });

  it("never creates mastery for concepts without a confusion pair", () => {
    const noMixCourse: Course = {
      ...course,
      concepts: [{ ...course.concepts[0], mixUp: "" }],
      lessons: [{
        ...course.lessons[0],
        prompts: [{ id: "one", type: "meaning", termId: "hedge", termIds: ["hedge"], stem: "", options: [{ text: "right" }], answer: 0, why: "" }]
      }]
    };
    const session = startSession(noMixCourse, "lesson", environment);
    const result = applyAnswer(noMixCourse, emptyLearnerState(), session, "right", environment);
    expect(result.state.mastery).toEqual({});
  });

  it("lists due pairs ordered by due date", () => {
    const base = Date.parse("2026-08-28T12:00:00.000Z");
    const state: LearnerState = {
      ...emptyLearnerState(),
      mastery: {
        "b::c": { confusionPairId: "b::c", consecutiveCorrect: 1, lapses: 0, evidenceTypes: ["meaning"], unseenScenarioCorrect: false, dueAt: new Date(base - 7_200_000).toISOString(), schedulerVersion: "0.1.0" },
        "a::b": { confusionPairId: "a::b", consecutiveCorrect: 1, lapses: 0, evidenceTypes: ["meaning"], unseenScenarioCorrect: false, dueAt: new Date(base - 3_600_000).toISOString(), schedulerVersion: "0.1.0" },
        "x::y": { confusionPairId: "x::y", consecutiveCorrect: 1, lapses: 0, evidenceTypes: ["meaning"], unseenScenarioCorrect: false, dueAt: new Date(base + 7 * 86_400_000).toISOString(), schedulerVersion: "0.1.0" }
      }
    };
    expect(duePairIds(state, new Date(base))).toEqual(["b::c", "a::b"]);
  });
});

describe("engine guards and grading", () => {
  it("refuses to grade a finished session", () => {
    const session = startSession(course, "lesson", environment);
    const finished = applyAnswer(course, emptyLearnerState(), session, "right", environment);
    expect(() => applyAnswer(course, finished.state, finished.session, "right", environment)).toThrow(/finished session/);
  });

  it("refuses to start an empty practice session", () => {
    expect(() => startPracticeSession([], environment)).toThrow(/at least one prompt/);
  });

  it("filters concept references down to published concepts in the attempt", () => {
    const lesson = course.lessons[0];
    const mixed: Course = {
      ...course,
      lessons: [{
        ...lesson,
        prompts: [{ id: "match-one", type: "match", termIds: ["hedge", "sell", "put_u1intro"], why: "", pairs: [{ id: "hedge", left: "hedge", right: "H" }, { id: "sell", left: "sell", right: "S" }] }]
      }]
    };
    const session = startSession(mixed, "lesson", environment);
    const result = applyAnswer(mixed, emptyLearnerState(), session, "matched", environment);
    expect(result.attempt.conceptIds).toEqual(["hedge"]);
    expect(result.attempt.correct).toBe(true);
  });

  it("grades every exercise type against published answers", () => {
    const meaning: Exercise = { id: "m", type: "meaning", termIds: ["hedge"], options: [{ text: "right" }, { text: "wrong" }], answer: 0, why: "" };
    const tf: Exercise = { id: "t", type: "truefalse", termIds: ["hedge"], stem: "", answer: false, why: "" };
    const fill: Exercise = { id: "f", type: "fill", termIds: ["hedge"], story: "", bank: ["hedge"], answer: "hedge", why: "" };
    const match: Exercise = { id: "k", type: "match", termIds: ["hedge"], why: "", pairs: [{ id: "hedge", left: "hedge", right: "H" }] };

    expect(isCorrect(meaning, "right")).toBe(true);
    expect(isCorrect(meaning, "wrong")).toBe(false);
    expect(isCorrect(tf, false)).toBe(true);
    expect(isCorrect(tf, true)).toBe(false);
    expect(isCorrect(fill, "hedge")).toBe(true);
    expect(isCorrect(fill, "Hedge")).toBe(false); // case matters: it is a spelling drill
    expect(isCorrect(match, "matched")).toBe(true);
    expect(isCorrect(match, false)).toBe(false);
    expect(isCorrect({ ...meaning, answer: "nonnumeric" }, "right")).toBe(false); // malformed choice grading fails closed
  });

  it("unlocks lessons strictly in order", () => {
    const two: Course = {
      ...course,
      lessons: [course.lessons[0], { ...course.lessons[0], id: "second" }, { ...course.lessons[0], id: "third" }]
    };
    let state = emptyLearnerState();
    expect(isLessonUnlocked(state, two, "lesson")).toBe(true);
    expect(isLessonUnlocked(state, two, "second")).toBe(false);
    expect(isLessonUnlocked(state, two, "unknown")).toBe(false);

    state = { ...state, completedLessonIds: ["lesson"] };
    expect(isLessonUnlocked(state, two, "second")).toBe(true);
    expect(isLessonUnlocked(state, two, "third")).toBe(false);
  });
});
