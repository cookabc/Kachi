import { describe, expect, it } from "vitest";
import { course as publishedCourse } from "../course";
import type { AttemptEvent, Course, Environment, Exercise, LearnerState } from "../domain";
import {
  type ApplyOptions,
  applyAnswer,
  compactAttempts,
  currentExercise,
  duePairIds,
  emptyLearnerState,
  evidenceQuality,
  isCorrect,
  isFirstEncounter,
  isLessonUnlocked,
  isRequeuedPrompt,
  isSlowAnswer,
  isVerifiedMastery,
  MAX_ATTEMPT_LOG,
  medianCorrectLatencyMs,
  recentMissTermIds,
  requeuePrompt,
  startPracticeSession,
  startSession,
  unlockedUnitIds,
} from "./index";

const course: Course = {
  schemaVersion: 1,
  packId: "test",
  contentVersion: "1",
  locale: "zh-CN",
  generatedAt: "2026-08-28T00:00:00.000Z",
  units: [{ id: 1, title: "Test", blurb: "Test" }],
  concepts: [
    {
      id: "hedge",
      unit: 1,
      term: "hedge",
      caption: "",
      definition: "",
      example: "",
      mixUp: "pledge",
      mixUpWhy: "",
      sourceIds: [],
      risk: "evergreen",
      reviewStatus: "legacy",
    },
  ],
  lessons: [
    {
      id: "lesson",
      unit: 1,
      title: "Test",
      icon: "",
      review: false,
      prompts: [
        {
          id: "one",
          type: "meaning",
          termId: "hedge",
          termIds: ["hedge"],
          stem: "",
          options: [{ text: "right" }, { text: "wrong" }],
          answer: 0,
          why: "",
        },
      ],
    },
  ],
  sources: [],
};

const twoPromptCourse: Course = {
  ...course,
  lessons: [
    {
      ...course.lessons[0],
      prompts: [
        course.lessons[0].prompts[0],
        {
          id: "two",
          type: "truefalse",
          termId: "hedge",
          termIds: ["hedge"],
          stem: "",
          answer: true,
          why: "",
        },
      ],
    },
  ],
};

const environment: Environment = {
  now: () => new Date("2026-08-28T12:00:00.000Z"),
  random: () => 0.5,
  deviceId: "test-device",
  eventId: () => "event-1",
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
    const result = applyAnswer(course, emptyLearnerState(), session, "wrong", environment, {
      heartsAfter: 0,
    });
    expect(result.finished).toBe(true);
    expect(result.state.completedLessonIds).toEqual([]);
    expect(result.state.streak).toBe(0);
    expect(result.state.xp).toBe(0);
    expect(result.attempt.correct).toBe(false);
  });

  it("still completes a lesson finished with hearts left but a wrong last answer", () => {
    const session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, emptyLearnerState(), session, "wrong", environment, {
      heartsAfter: 2,
    });
    expect(result.state.completedLessonIds).toEqual(["test/lesson"]);
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

  it("keeps the streak across a DST spring-forward", () => {
    // 00:30 EST on 8 Mar, then 00:30 EDT on 9 Mar. Those instants are 23 hours
    // apart, so "now minus 24 hours" falls on 7 Mar and used to reset the streak.
    // The second finish has to be a different lesson: a repeated lesson no
    // longer counts as a new completion.
    const dstCourse: Course = {
      ...course,
      lessons: [
        course.lessons[0],
        {
          ...course.lessons[0],
          id: "lesson-2",
          prompts: [{ ...course.lessons[0].prompts[0], id: "two" }],
        },
      ],
    };
    const previousTz = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      const sunday = { ...environment, now: () => new Date("2026-03-08T05:30:00.000Z") };
      const started = applyAnswer(
        dstCourse,
        emptyLearnerState(),
        startSession(dstCourse, "lesson", sunday),
        "right",
        sunday,
      );
      expect(started.state.lastLessonDate).toBe("2026-03-08");
      expect(started.state.streak).toBe(1);

      const monday = { ...environment, now: () => new Date("2026-03-09T04:30:00.000Z") };
      const next = applyAnswer(
        dstCourse,
        started.state,
        startSession(dstCourse, "lesson-2", monday),
        "right",
        monday,
      );
      expect(next.state.lastLessonDate).toBe("2026-03-09");
      expect(next.state.streak).toBe(2);
    } finally {
      if (previousTz === undefined) delete process.env.TZ;
      else process.env.TZ = previousTz;
    }
  });
});

describe("mastery scheduling", () => {
  // Each practice round is a fresh session, so answering the same prompt again
  // there is a genuine second encounter — unlike a re-queued prompt inside one
  // session, which is a rehearsal (see the retry describe block below).
  function answerFresh(state: LearnerState, answer: string, options: ApplyOptions = {}) {
    const session = startPracticeSession(["one"], environment);
    return applyAnswer(course, state, session, answer, environment, options);
  }

  it("walks the review-interval ladder on consecutive corrects", () => {
    let state = emptyLearnerState();
    // First correct: consecutive 1, due +1d.
    state = answerFresh(state, "right").state;

    const pairId = "hedge::pledge";
    // the 2nd..7th corrects walk REVIEW_INTERVAL_DAYS[1..5] and cap at 60d
    const intervals = [3, 7, 14, 30, 60, 60, 60];
    intervals.forEach((days, index) => {
      state = answerFresh(state, "right").state;
      const mastery = state.mastery[pairId];
      expect(mastery.consecutiveCorrect).toBe(Math.min(index + 2, 6));
      expect(mastery.dueAt).toBe(
        new Date(Date.parse("2026-08-28T12:00:00.000Z") + days * 86_400_000).toISOString(),
      );
    });
    expect(state.mastery[pairId].lapses).toBe(0);
  });

  it("treats a wrong answer as a lapse that resets the ladder", () => {
    let state = answerFresh(emptyLearnerState(), "right").state;
    state = answerFresh(state, "wrong").state;

    const mastery = state.mastery["hedge::pledge"];
    expect(mastery.consecutiveCorrect).toBe(0);
    expect(mastery.lapses).toBe(1);
    expect(mastery.dueAt).toBe(new Date(Date.parse("2026-08-28T12:00:00.000Z") + 86_400_000).toISOString());
  });

  it("treats a hint-assisted correct as a lapse", () => {
    const state = emptyLearnerState();
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
      lessons: [
        {
          ...course.lessons[0],
          prompts: [
            {
              id: "meaning-one",
              type: "meaning",
              termId: "hedge",
              termIds: ["hedge"],
              stem: "",
              options: [{ text: "right" }],
              answer: 0,
              why: "",
            },
            {
              id: "fill-one",
              type: "fill",
              termId: "hedge",
              termIds: ["hedge"],
              story: "",
              bank: ["hedge"],
              answer: "hedge",
              why: "",
            },
            {
              id: "scene-one",
              type: "scenario",
              termId: "hedge",
              termIds: ["hedge"],
              story: "",
              stem: "",
              options: [{ text: "right" }],
              answer: 0,
              why: "",
            },
          ],
        },
      ],
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
      lessons: [
        {
          ...course.lessons[0],
          prompts: [
            {
              id: "one",
              type: "meaning",
              termId: "hedge",
              termIds: ["hedge"],
              stem: "",
              options: [{ text: "right" }],
              answer: 0,
              why: "",
            },
          ],
        },
      ],
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
        "b::c": {
          confusionPairId: "b::c",
          consecutiveCorrect: 1,
          lapses: 0,
          evidenceTypes: ["meaning"],
          unseenScenarioCorrect: false,
          dueAt: new Date(base - 7_200_000).toISOString(),
          schedulerVersion: "0.1.0",
        },
        "a::b": {
          confusionPairId: "a::b",
          consecutiveCorrect: 1,
          lapses: 0,
          evidenceTypes: ["meaning"],
          unseenScenarioCorrect: false,
          dueAt: new Date(base - 3_600_000).toISOString(),
          schedulerVersion: "0.1.0",
        },
        "x::y": {
          confusionPairId: "x::y",
          consecutiveCorrect: 1,
          lapses: 0,
          evidenceTypes: ["meaning"],
          unseenScenarioCorrect: false,
          dueAt: new Date(base + 7 * 86_400_000).toISOString(),
          schedulerVersion: "0.1.0",
        },
      },
    };
    expect(duePairIds(state, new Date(base))).toEqual(["b::c", "a::b"]);
  });
});

describe("engine guards and grading", () => {
  it("refuses to grade a finished session", () => {
    const session = startSession(course, "lesson", environment);
    const finished = applyAnswer(course, emptyLearnerState(), session, "right", environment);
    expect(() => applyAnswer(course, finished.state, finished.session, "right", environment)).toThrow(
      /finished session/,
    );
  });

  it("records the caller's latency and never a negative one", () => {
    const session = startSession(course, "lesson", environment);
    const timed = applyAnswer(course, emptyLearnerState(), session, "right", environment, {
      latencyMs: 4200,
    });
    expect(timed.attempt.latencyMs).toBe(4200);
    const negative = applyAnswer(
      course,
      emptyLearnerState(),
      startSession(course, "lesson", environment),
      "right",
      environment,
      {
        latencyMs: -5,
      },
    );
    expect(negative.attempt.latencyMs).toBe(0);
    const defaulted = applyAnswer(
      course,
      emptyLearnerState(),
      startSession(course, "lesson", environment),
      "right",
      environment,
    );
    expect(defaulted.attempt.latencyMs).toBe(0);
  });

  it("refuses to start an empty practice session", () => {
    expect(() => startPracticeSession([], environment)).toThrow(/at least one prompt/);
  });

  it("filters concept references down to published concepts in the attempt", () => {
    const lesson = course.lessons[0];
    const mixed: Course = {
      ...course,
      lessons: [
        {
          ...lesson,
          prompts: [
            {
              id: "match-one",
              type: "match",
              termIds: ["hedge", "sell", "put_u1intro"],
              why: "",
              pairs: [
                { id: "hedge", left: "hedge", right: "H" },
                { id: "sell", left: "sell", right: "S" },
              ],
            },
          ],
        },
      ],
    };
    const session = startSession(mixed, "lesson", environment);
    const result = applyAnswer(mixed, emptyLearnerState(), session, "matched", environment);
    expect(result.attempt.conceptIds).toEqual(["hedge"]);
    expect(result.attempt.correct).toBe(true);
  });

  it("grades every exercise type against published answers", () => {
    const meaning: Exercise = {
      id: "m",
      type: "meaning",
      termIds: ["hedge"],
      options: [{ text: "right" }, { text: "wrong" }],
      answer: 0,
      why: "",
    };
    const tf: Exercise = { id: "t", type: "truefalse", termIds: ["hedge"], stem: "", answer: false, why: "" };
    const fill: Exercise = {
      id: "f",
      type: "fill",
      termIds: ["hedge"],
      story: "",
      bank: ["hedge"],
      answer: "hedge",
      why: "",
    };
    const match: Exercise = {
      id: "k",
      type: "match",
      termIds: ["hedge"],
      why: "",
      pairs: [{ id: "hedge", left: "hedge", right: "H" }],
    };

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
      lessons: [
        course.lessons[0],
        { ...course.lessons[0], id: "second" },
        { ...course.lessons[0], id: "third" },
      ],
    };
    let state = emptyLearnerState();
    expect(isLessonUnlocked(state, two, "lesson")).toBe(true);
    expect(isLessonUnlocked(state, two, "second")).toBe(false);
    expect(isLessonUnlocked(state, two, "unknown")).toBe(false);

    state = { ...state, completedLessonIds: ["test/lesson"] };
    expect(isLessonUnlocked(state, two, "second")).toBe(true);
    expect(isLessonUnlocked(state, two, "third")).toBe(false);
  });
});

describe("retries are rehearsals, not evidence", () => {
  // A match mispair re-queues its own prompt. The player then usually gets it
  // right — that replay used to advance the mastery ladder, pay XP, and push
  // the pair out of the review set, so one mistake could be laundered into
  // progress by finishing the prompt you had just failed.
  function missThenReplay() {
    const session = startSession(course, "lesson", environment);
    const first = applyAnswer(course, emptyLearnerState(), session, "wrong", environment);
    const requeued = requeuePrompt(first.session, "one");
    const replay = applyAnswer(course, first.state, requeued, "right", environment);
    return { first, replay };
  }

  it("detects a re-queued prompt from the session, not from the caller", () => {
    const session = startSession(course, "lesson", environment);
    expect(isRequeuedPrompt(session)).toBe(false);
    const first = applyAnswer(course, emptyLearnerState(), session, "wrong", environment);
    expect(isRequeuedPrompt(requeuePrompt(first.session, "one"))).toBe(true);
  });

  it("marks the replay as a retry without the caller saying so", () => {
    const { replay } = missThenReplay();
    expect(replay.attempt.isRetry).toBe(true);
  });

  it("does not let a replay restore the mastery it just lost", () => {
    const { first, replay } = missThenReplay();
    const afterMiss = first.state.mastery["hedge::pledge"];
    const afterReplay = replay.state.mastery["hedge::pledge"];
    expect(afterMiss.consecutiveCorrect).toBe(0);
    expect(afterReplay.consecutiveCorrect).toBe(0);
    // Not even the review date moves: the clock was set by the mistake.
    expect(afterReplay.dueAt).toBe(afterMiss.dueAt);
    expect(afterReplay.lapses).toBe(afterMiss.lapses);
  });

  it("pays no XP for a replay", () => {
    const { first, replay } = missThenReplay();
    // The single-prompt test lesson completes even on a wrong answer (no
    // hearts tracked), so the first pass pays the +20 completion bonus only.
    // The replay must add nothing on top of that.
    expect(first.state.xp).toBe(20);
    expect(replay.state.xp).toBe(first.state.xp);
  });

  it("still counts a wrong replay as a fresh lapse", () => {
    const session = startSession(course, "lesson", environment);
    const first = applyAnswer(course, emptyLearnerState(), session, "wrong", environment);
    const again = applyAnswer(course, first.state, requeuePrompt(first.session, "one"), "wrong", environment);
    expect(again.state.mastery["hedge::pledge"].lapses).toBe(2);
  });

  it("keeps a replayed term on the review list", () => {
    const { replay } = missThenReplay();
    expect(recentMissTermIds(replay.state)).toContain("hedge");
  });

  it("never calls a lesson with a replay flawless", () => {
    // Two-prompt lesson: miss the first, replay it correctly, then get the
    // second right. Every graded answer is correct — but the replay proves the
    // lesson was not flawless, so the +20 bonus must not be paid.
    const two: Course = {
      ...course,
      lessons: [
        {
          ...course.lessons[0],
          prompts: [course.lessons[0].prompts[0], { ...twoPromptCourse.lessons[0].prompts[1] }],
        },
      ],
    };
    let state = emptyLearnerState();
    const start = startSession(two, "lesson", environment);
    const miss = applyAnswer(two, state, start, "wrong", environment);
    state = miss.state;
    const replay = applyAnswer(two, state, requeuePrompt(miss.session, "one"), "right", environment);
    state = replay.state;
    // The second prompt is a true/false, whose answer is a boolean.
    const last = applyAnswer(two, state, replay.session, true, environment);
    expect(last.finished).toBe(true);
    // 20 completion + 10 for the second prompt's correct answer; no flawless.
    expect(last.state.xp).toBe(30);

    // Sanity: the same lesson played clean — both prompts right on first
    // contact — does pay the flawless bonus (10 + 10 + 20 + 20).
    const twoPromptLesson: Course = two;
    const cleanFirst = applyAnswer(
      twoPromptLesson,
      emptyLearnerState(),
      startSession(twoPromptLesson, "lesson", environment),
      "right",
      environment,
    );
    const cleanLast = applyAnswer(twoPromptLesson, cleanFirst.state, cleanFirst.session, true, environment);
    expect(cleanLast.finished).toBe(true);
    expect(cleanLast.state.xp).toBe(60);
  });
});

describe("evidence quality", () => {
  function slowState(): LearnerState {
    // Eight quick corrects establish a median of 2000ms.
    let state = emptyLearnerState();
    for (let i = 0; i < 8; i += 1) {
      const session = startPracticeSession(["one"], environment);
      state = applyAnswer(course, state, session, "right", environment, { latencyMs: 2000 }).state;
    }
    return state;
  }

  it("has no opinion about speed until it has enough samples", () => {
    expect(medianCorrectLatencyMs(emptyLearnerState())).toBeUndefined();
    expect(isSlowAnswer(emptyLearnerState(), 60_000)).toBe(false);
  });

  it("derives its own bar from the learner's median", () => {
    const state = slowState();
    expect(medianCorrectLatencyMs(state)).toBe(2000);
    // The bar is max(median * 2, FLOOR) = max(4000, 12000) = 12000. The floor
    // wins here, which is the point: no answer under 12s is ever "slow".
    expect(isSlowAnswer(state, 4000)).toBe(false);
    expect(isSlowAnswer(state, 12_000)).toBe(false);
    expect(isSlowAnswer(state, 12_001)).toBe(true);
  });

  it("raises the bar above the floor once the median is genuinely slow", () => {
    // A learner whose correct answers take 10s has a bar of max(20000, 12000).
    let state = emptyLearnerState();
    for (let i = 0; i < 8; i += 1) {
      state = applyAnswer(course, state, startPracticeSession(["one"], environment), "right", environment, {
        latencyMs: 10_000,
      }).state;
    }
    expect(isSlowAnswer(state, 15_000)).toBe(false);
    expect(isSlowAnswer(state, 20_001)).toBe(true);
  });

  it("never flags an answer under the absolute floor", () => {
    // A learner whose median is 500ms would otherwise have 1.5s answers
    // called "slow" — too fast to be meaningful.
    let state = emptyLearnerState();
    for (let i = 0; i < 8; i += 1) {
      state = applyAnswer(course, state, startPracticeSession(["one"], environment), "right", environment, {
        latencyMs: 500,
      }).state;
    }
    expect(isSlowAnswer(state, 11_000)).toBe(false);
    expect(isSlowAnswer(state, 12_001)).toBe(true);
  });

  it("keeps the rung but reviews tomorrow when an answer is slow", () => {
    const state = slowState();
    // Two quick corrects already happened in slowState, so the ladder is at 6
    // (8 corrects capped). A slow answer must hold that rung.
    const before = state.mastery["hedge::pledge"].consecutiveCorrect;
    const session = startPracticeSession(["one"], environment);
    const result = applyAnswer(course, state, session, "right", environment, { latencyMs: 20_000 });
    const after = result.state.mastery["hedge::pledge"];
    expect(after.consecutiveCorrect).toBe(before);
    expect(after.dueAt).toBe(new Date(Date.parse("2026-08-28T12:00:00.000Z") + 86_400_000).toISOString());
    expect(after.lapses).toBe(0); // effortful recall is not a lapse
  });

  it("classifies the four cases", () => {
    const quick = applyAnswer(
      course,
      emptyLearnerState(),
      startSession(course, "lesson", environment),
      "right",
      environment,
      { latencyMs: 1000 },
    ).attempt;
    expect(evidenceQuality(emptyLearnerState(), quick)).toBe("strong");

    const hinted = { ...quick, hintUsed: true };
    expect(evidenceQuality(emptyLearnerState(), hinted)).toBe("lapse");

    const retried = { ...quick, isRetry: true };
    expect(evidenceQuality(emptyLearnerState(), retried)).toBe("rehearsal");

    const wrongRetry = { ...quick, isRetry: true, correct: false };
    expect(evidenceQuality(emptyLearnerState(), wrongRetry)).toBe("lapse");

    const slow = { ...quick, latencyMs: 20_000 };
    expect(evidenceQuality(slowState(), slow)).toBe("weak");
  });
});

describe("match mispairs", () => {
  const matchCourse: Course = {
    ...course,
    concepts: [
      ...course.concepts,
      {
        id: "pledge",
        unit: 1,
        term: "pledge",
        caption: "",
        definition: "",
        example: "",
        mixUp: "hedge",
        mixUpWhy: "",
        sourceIds: [],
        risk: "evergreen",
        reviewStatus: "legacy",
      },
    ],
    lessons: [
      {
        ...course.lessons[0],
        prompts: [
          {
            id: "match-one",
            type: "match",
            termIds: ["hedge", "pledge", "put_u1intro"],
            why: "",
            pairs: [
              { id: "hedge", left: "hedge", right: "H" },
              { id: "pledge", left: "pledge", right: "P" },
              { id: "put_u1intro", left: "a put", right: "U" },
            ],
          },
        ],
      },
    ],
  };

  const mispairOptions: ApplyOptions = { heartsAfter: 4, confusionPair: ["hedge", "pledge"] };

  it("records the selected chips as the confusion pair instead of grading the whole prompt", () => {
    const session = startSession(matchCourse, "lesson", environment);
    const result = applyAnswer(matchCourse, emptyLearnerState(), session, false, environment, mispairOptions);

    expect(result.attempt.correct).toBe(false);
    expect(result.attempt.answer).toBe("match:hedge:pledge");
    expect(result.attempt.confusionPairId).toBe("hedge::pledge");
    // put_u1intro is a pseudo-term: only published concepts reach the attempt
    expect(result.attempt.conceptIds).toEqual(["hedge", "pledge"]);
  });

  it("keeps the mispair lapse on record through the corrective rerun", () => {
    const first = applyAnswer(
      matchCourse,
      emptyLearnerState(),
      startSession(matchCourse, "lesson", environment),
      false,
      environment,
      mispairOptions,
    );
    const rerun = applyAnswer(
      matchCourse,
      first.state,
      requeuePrompt(first.session, "match-one"),
      "matched",
      environment,
    );

    expect(rerun.attempt.correct).toBe(true);
    const mastery = rerun.state.mastery["hedge::pledge"];
    expect(mastery.lapses).toBe(1);
    expect(mastery.consecutiveCorrect).toBe(0);
    // the pair stays due, so practice keeps the real error after the rerun
    expect(
      duePairIds(rerun.state, new Date(Date.parse("2026-08-28T12:00:00.000Z") + 2 * 86_400_000)),
    ).toContain("hedge::pledge");
  });

  it("keeps a real-to-pseudo mispair as a recent miss without creating mastery", () => {
    const session = startSession(matchCourse, "lesson", environment);
    const result = applyAnswer(matchCourse, emptyLearnerState(), session, false, environment, {
      confusionPair: ["hedge", "put_u1intro"],
    });

    expect(result.attempt.answer).toBe("match:hedge:put_u1intro");
    expect(result.attempt.conceptIds).toEqual(["hedge"]);
    expect(result.attempt.confusionPairId).toBeUndefined();
    expect(result.state.mastery).toEqual({});
    expect(result.state.seenConceptIds).toEqual(["hedge"]);
    expect(recentMissTermIds(result.state)).toEqual(["hedge"]);
  });

  it("records a pseudo-to-pseudo mispair without creating unschedulable mastery", () => {
    const session = startSession(matchCourse, "lesson", environment);
    const result = applyAnswer(matchCourse, emptyLearnerState(), session, false, environment, {
      confusionPair: ["put_u1intro", "sell"],
    });

    expect(result.attempt.answer).toBe("match:put_u1intro:sell");
    expect(result.attempt.conceptIds).toEqual([]);
    expect(result.attempt.confusionPairId).toBeUndefined();
    expect(result.state.mastery).toEqual({});
    expect(result.state.seenConceptIds).toEqual([]);
    expect(recentMissTermIds(result.state)).toEqual([]);
    expect(duePairIds(result.state, new Date("2100-01-01T00:00:00.000Z"))).toEqual([]);
  });

  it("still schedules an observed pair of two real noncanonical concepts", () => {
    const noncanonical: Course = {
      ...matchCourse,
      concepts: [
        ...matchCourse.concepts,
        {
          id: "collateral",
          unit: 1,
          term: "collateral",
          caption: "",
          definition: "",
          example: "",
          mixUp: "pledge",
          mixUpWhy: "",
          sourceIds: [],
          risk: "evergreen",
          reviewStatus: "legacy",
        },
      ],
    };
    const session = startSession(noncanonical, "lesson", environment);
    const result = applyAnswer(noncanonical, emptyLearnerState(), session, false, environment, {
      confusionPair: ["collateral", "hedge"],
    });

    expect(result.attempt.confusionPairId).toBe("collateral::hedge");
    expect(result.state.mastery["collateral::hedge"].lapses).toBe(1);
  });
});

describe("real-course playthrough", () => {
  function correctAnswerFor(prompt: Exercise): string | boolean {
    if (prompt.type === "match") return "matched";
    if (prompt.type === "truefalse" || prompt.type === "fill") return prompt.answer as string | boolean;
    return prompt.options![prompt.answer as number].text;
  }

  it("completes a full all-correct lesson with flawless payout and streak", () => {
    // Guards the lesson-completion path end to end: every prompt of a real
    // lesson answered correctly must finish, persist completion, and pay out.
    const lesson = publishedCourse.lessons.find((item) => item.id === "u1l1")!;
    let state = emptyLearnerState();
    let session = startSession(publishedCourse, "u1l1", environment);
    for (const prompt of lesson.prompts) {
      const result = applyAnswer(publishedCourse, state, session, correctAnswerFor(prompt), environment, {
        heartsAfter: 4,
      });
      expect(result.attempt.correct, prompt.id).toBe(true);
      state = result.state;
      session = result.session;
    }
    expect(session.index).toBe(lesson.prompts.length);
    expect(state.completedLessonIds).toEqual(["hedge-or-pledge/u1l1"]);
    expect(state.xp).toBe(lesson.prompts.length * 10 + 20 + 20);
    expect(state.streak).toBe(1);
    expect(state.lastLessonDate).toBeDefined();
    expect(state.attempts).toHaveLength(lesson.prompts.length);
  });

  it("never marks a practice round as a completed lesson", () => {
    const lesson = publishedCourse.lessons.find((item) => item.id === "u1l1")!;
    const promptIds = lesson.prompts.map((prompt) => prompt.id);
    let state = emptyLearnerState();
    let session = startPracticeSession(promptIds, environment);
    for (const prompt of lesson.prompts) {
      const result = applyAnswer(publishedCourse, state, session, correctAnswerFor(prompt), environment, {
        heartsAfter: 4,
      });
      state = result.state;
      session = result.session;
    }
    expect(state.completedLessonIds).toEqual([]);
    expect(state.xp).toBe(lesson.prompts.length * 10);
    expect(state.streak).toBe(0);
  });
});

describe("XP is paid once per exercise and once per lesson", () => {
  it("does not pay again when the same lesson is completed a second time", () => {
    const first = applyAnswer(
      course,
      emptyLearnerState(),
      startSession(course, "lesson", environment),
      "right",
      environment,
    );
    const second = applyAnswer(
      course,
      first.state,
      startSession(course, "lesson", environment),
      "right",
      environment,
    );
    expect(first.state.xp).toBe(50);
    expect(second.state.xp).toBe(first.state.xp);
    expect(second.state.completedLessonIds).toEqual(["test/lesson"]);
  });

  it("does not pay again after the paying attempt leaves the recent window", () => {
    const missed = applyAnswer(
      course,
      emptyLearnerState(),
      startSession(course, "lesson", environment),
      "wrong",
      environment,
      { heartsAfter: 2 },
    );
    let state = applyAnswer(
      course,
      missed.state,
      startSession(course, "lesson", environment),
      "right",
      environment,
    ).state;
    for (let index = 0; index < MAX_ATTEMPT_LOG; index += 1) {
      state = applyAnswer(course, state, startSession(course, "lesson", environment), "wrong", environment, {
        heartsAfter: 2,
      }).state;
    }
    const again = applyAnswer(
      course,
      state,
      startSession(course, "lesson", environment),
      "right",
      environment,
    );
    expect(again.state.xp).toBe(state.xp);
    expect(again.state.completedLessonIds).toEqual(["test/lesson"]);
  });

  it("still pays the first correct answer after a miss, and only that once", () => {
    const missed = applyAnswer(
      course,
      emptyLearnerState(),
      startSession(course, "lesson", environment),
      "wrong",
      environment,
      { heartsAfter: 2 },
    );
    const corrected = applyAnswer(
      course,
      missed.state,
      startSession(course, "lesson", environment),
      "right",
      environment,
    );
    const repeated = applyAnswer(
      course,
      corrected.state,
      startSession(course, "lesson", environment),
      "right",
      environment,
    );
    expect(missed.state.xp).toBe(20);
    expect(corrected.state.xp).toBe(30);
    expect(repeated.state.xp).toBe(corrected.state.xp);
    expect(repeated.state.completedLessonIds).toEqual(missed.state.completedLessonIds);
  });
});

describe("attempt log cap", () => {
  function stamped(index: number, overrides: Partial<AttemptEvent> = {}): AttemptEvent {
    return {
      eventId: `e${index}`,
      deviceId: "t",
      contentVersion: "1",
      engineVersion: "0.2.0",
      exerciseId: `filler-${index}`,
      conceptIds: ["pledge"],
      exerciseType: "meaning",
      answer: "x",
      correct: true,
      hintUsed: false,
      latencyMs: 1000,
      occurredAt: "2026-08-28T12:00:00.000Z",
      ...overrides,
    };
  }

  it("keeps the latest miss and the first sight of an exercise the tail no longer holds", () => {
    const miss = stamped(0, {
      exerciseId: "old-scenario",
      conceptIds: ["hedge"],
      exerciseType: "scenario",
      correct: false,
      latencyMs: 4000,
    });
    const filler = Array.from({ length: MAX_ATTEMPT_LOG }, (_, index) => stamped(index + 1));
    const compacted = compactAttempts([miss, ...filler]);
    expect(compacted).toHaveLength(MAX_ATTEMPT_LOG + 1);
    expect(compacted[0]).toBe(miss);
    expect(recentMissTermIds({ ...emptyLearnerState(), attempts: compacted })).toContain("hedge");

    const scenario: Exercise = {
      id: "old-scenario",
      type: "scenario",
      termIds: ["hedge"],
      why: "",
    };
    const session = startSession(course, "lesson", environment);
    expect(isFirstEncounter({ ...emptyLearnerState(), attempts: compacted }, scenario, session)).toBe(false);
  });

  it("leaves a re-queued pair at the end of a capped log adjacent", () => {
    const filler = Array.from({ length: MAX_ATTEMPT_LOG }, (_, index) => stamped(index));
    const wrong = stamped(MAX_ATTEMPT_LOG, {
      exerciseId: "match-1",
      exerciseType: "match",
      correct: false,
    });
    const retry = stamped(MAX_ATTEMPT_LOG + 1, {
      exerciseId: "match-1",
      exerciseType: "match",
      correct: true,
      isRetry: true,
    });
    const compacted = compactAttempts([...filler, wrong, retry]);
    expect(compacted.length).toBeGreaterThan(MAX_ATTEMPT_LOG);
    expect(compacted.slice(-2)).toEqual([wrong, retry]);
  });
});

describe("unlocked units", () => {
  it("names only the units a learner can actually enter", () => {
    const units: Course = {
      ...course,
      units: [
        { id: 1, title: "One", blurb: "" },
        { id: 2, title: "Two", blurb: "" },
      ],
      lessons: [
        course.lessons[0],
        { ...course.lessons[0], id: "second", unit: 1 },
        { ...course.lessons[0], id: "third", unit: 2 },
      ],
    };
    expect(unlockedUnitIds(emptyLearnerState(), units)).toEqual([1]);
    const doneFirst = {
      ...emptyLearnerState(),
      completedLessonIds: ["test/lesson"],
    };
    expect(unlockedUnitIds(doneFirst, units)).toEqual([1]);
    const doneSecond = {
      ...emptyLearnerState(),
      completedLessonIds: ["test/lesson", "test/second"],
    };
    expect(unlockedUnitIds(doneSecond, units)).toEqual([1, 2]);
  });
});
