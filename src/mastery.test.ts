import { describe, expect, it } from "vitest";
import { course } from "./course";
import type { AttemptEvent, Course, LearnerState } from "./domain";
import { applyAnswer, emptyLearnerState, isFirstEncounter, isVerifiedMastery, startSession } from "./engine";

// "Verified mastery" is a product promise: three correct answers in a row, in
// at least two exercise formats, including a scenario the learner had never
// met. Before this suite existed the promise was unreachable — the "unseen
// scenario" flag read a field no pack ever set (0 of 481 prompts), so the
// predicate was permanently false and nothing caught it because no test ever
// asserted the positive case.
const environment = {
  now: () => new Date("2026-10-27T09:00:00.000Z"),
  random: () => 0.5,
  deviceId: "test-device",
  eventId: (() => {
    let n = 0;
    return () => `evt-${++n}`;
  })(),
};

function correctAnswerFor(exercise: { type: string; answer?: unknown; options?: Array<{ text: string }> }) {
  if (exercise.type === "truefalse") return exercise.answer as boolean;
  if (exercise.type === "fill") return exercise.answer as string;
  if (exercise.type === "match") return "matched";
  const index = exercise.answer as number;
  return exercise.options?.[index]?.text ?? "";
}

/** Play a lesson top to bottom, answering everything correctly. */
function playLessonClean(course: Course, state: LearnerState, lessonId: string) {
  let session = startSession(course, lessonId, environment);
  let working = state;
  for (let i = 0; i < session.promptIds.length; i += 1) {
    const exercise = course.lessons
      .flatMap((lesson) => lesson.prompts)
      .find((prompt) => prompt.id === session.promptIds[session.index]);
    if (!exercise) break;
    const pairs = exercise.pairs?.map((pair) => [pair.id, pair.id] as [string, string]);
    const result = applyAnswer(
      course,
      working,
      session,
      correctAnswerFor(exercise),
      environment,
      pairs?.[0] ? { confusionPair: pairs[0] } : {},
    );
    working = result.state;
    session = result.session;
    if (session.index >= session.promptIds.length) break;
  }
  return working;
}

describe("verified mastery is reachable", () => {
  it("marks a scenario the learner has never answered as a first encounter", () => {
    // u1l1-* prompts include scenarios; before any attempts they are all new.
    const session = startSession(course, "u1l1", environment);
    const scenario = course.lessons
      .find((lesson) => lesson.id === "u1l1")
      ?.prompts.find((prompt) => prompt.type === "scenario");
    expect(scenario).toBeDefined();
    if (!scenario) return;
    const fresh = emptyLearnerState();
    expect(isFirstEncounter(fresh, scenario, session)).toBe(true);
  });

  it("does not call the same scenario unseen once it has been answered", () => {
    const session = startSession(course, "u1l1", environment);
    const scenario = course.lessons
      .find((lesson) => lesson.id === "u1l1")
      ?.prompts.find((prompt) => prompt.type === "scenario");
    if (!scenario) return;
    const answered: AttemptEvent = {
      eventId: "e1",
      deviceId: "d",
      contentVersion: course.contentVersion,
      engineVersion: "test",
      exerciseId: scenario.id,
      conceptIds: scenario.termIds,
      confusionPairId: undefined,
      exerciseType: scenario.type,
      answer: "x",
      correct: false,
      hintUsed: false,
      latencyMs: 0,
      occurredAt: "2026-10-01T00:00:00.000Z",
    };
    const state: LearnerState = { ...emptyLearnerState(), attempts: [answered] };
    expect(isFirstEncounter(state, scenario, session)).toBe(false);
  });

  it("reaches verified mastery for a pair after clean lessons", () => {
    // Three clean runs over the same confusion pair, which is what a learner
    // does by playing unit 1 then its review lesson.
    let state = emptyLearnerState();
    for (const lessonId of ["u1l1", "u1l2", "u1r"]) {
      state = playLessonClean(course, state, lessonId);
    }

    const verified = Object.values(state.mastery).filter((entry) => isVerifiedMastery(entry));
    expect(verified.length).toBeGreaterThan(0);
    // The strongest proof: the flag that used to be permanently false is set.
    expect(Object.values(state.mastery).some((entry) => entry.unseenScenarioCorrect)).toBe(true);
  });

  it("still withholds verified mastery when evidence is one format only", () => {
    const pairId = "hedge::pledge";
    const thin = {
      confusionPairId: pairId,
      consecutiveCorrect: 5,
      lapses: 0,
      evidenceTypes: ["meaning" as const],
      unseenScenarioCorrect: true,
      schedulerVersion: "test",
    };
    expect(isVerifiedMastery(thin)).toBe(false);
  });
});
