import { describe, expect, it } from "vitest";
import type { AttemptEvent, LearnerState, MasteryState } from "./domain";
import {
  applyAnswer,
  emptyLearnerState,
  isLessonDone,
  MAX_ATTEMPT_LOG,
  requeuePrompt,
  startSession,
} from "./engine";
import { inferredRetryIndices, STATE_VERSION, type StoredLearnerState, upgradeLearnerState } from "./upgrade";

/**
 * The upgrade is the only place that knows an older saved shape exists. These
 * tests pin what it fixes, so the rest of the code can rely on a single shape.
 */

function attempt(overrides: Partial<AttemptEvent> = {}): AttemptEvent {
  return {
    eventId: Math.random().toString(36).slice(2),
    deviceId: "t",
    contentVersion: "1",
    engineVersion: "0.1.0",
    exerciseId: "u1l1-match",
    conceptIds: ["hedge"],
    confusionPairId: "hedge::pledge",
    exerciseType: "match",
    answer: "match",
    correct: true,
    hintUsed: false,
    latencyMs: 0,
    occurredAt: "2026-08-30T10:00:00.000Z",
    ...overrides,
  };
}

/** A v1 record: bare lesson ids, no retry flags, inflated mastery. */
function v1State(overrides: Partial<StoredLearnerState> = {}): StoredLearnerState {
  return {
    version: 1,
    xp: 40,
    streak: 2,
    lastLessonDate: "2026-08-29",
    completedLessonIds: ["u1l1", "u1l2"],
    seenConceptIds: ["hedge"],
    attempts: [
      attempt({ correct: false, occurredAt: "2026-08-30T10:00:00.000Z" }),
      attempt({ correct: true, occurredAt: "2026-08-30T10:00:05.000Z" }),
    ],
    mastery: {
      "hedge::pledge": {
        confusionPairId: "hedge::pledge",
        consecutiveCorrect: 1,
        lapses: 1,
        evidenceTypes: ["match"],
        unseenScenarioCorrect: false,
        firstSeenAt: "2026-08-30T10:00:00.000Z",
        lastReviewedAt: "2026-08-30T10:00:05.000Z",
        dueAt: "2026-08-31T10:00:05.000Z",
        schedulerVersion: "0.1.0",
      },
    },
    ...overrides,
  };
}

describe("inferredRetryIndices", () => {
  it("finds a repeat that follows a wrong match", () => {
    expect(inferredRetryIndices([attempt({ correct: false }), attempt({ correct: true })])).toEqual([1]);
  });

  it("does not flag two correct answers to the same prompt", () => {
    expect(inferredRetryIndices([attempt(), attempt()])).toEqual([]);
  });

  it("does not flag a repeat after a wrong non-match prompt", () => {
    // Only match prompts re-queue; a repeated meaning prompt is two encounters.
    expect(
      inferredRetryIndices([
        attempt({ correct: false, exerciseType: "meaning" }),
        attempt({ correct: true, exerciseType: "meaning" }),
      ]),
    ).toEqual([]);
  });

  it("ignores non-adjacent repeats", () => {
    expect(
      inferredRetryIndices([
        attempt({ correct: false }),
        attempt({ exerciseId: "other" }),
        attempt({ correct: true }),
      ]),
    ).toEqual([]);
  });
});

describe("upgradeLearnerState", () => {
  it("qualifies bare lesson ids with the legacy pack", () => {
    const report = upgradeLearnerState(v1State());
    expect(report.qualifiedLessons).toBe(2);
    expect(report.state.completedLessonIds).toEqual(["hedge-or-pledge/u1l1", "hedge-or-pledge/u1l2"]);
  });

  it("leaves already-qualified keys alone", () => {
    const report = upgradeLearnerState(v1State({ completedLessonIds: ["hedge-or-pledge/u1l1"] }));
    expect(report.qualifiedLessons).toBe(0);
    expect(report.state.completedLessonIds).toEqual(["hedge-or-pledge/u1l1"]);
  });

  it("stamps the retry flag on rehearsals so nothing infers again", () => {
    const report = upgradeLearnerState(v1State());
    expect(report.retries).toBe(1);
    expect(report.state.attempts[1].isRetry).toBe(true);
    expect(report.state.attempts[0].isRetry).toBeUndefined();
  });

  it("removes the rung a replay bought", () => {
    const report = upgradeLearnerState(v1State());
    expect(report.loweredPairs).toEqual(["hedge::pledge"]);
    const pair = report.state.mastery["hedge::pledge"];
    expect(pair.consecutiveCorrect).toBe(0);
    expect(pair.lapses).toBe(1);
    // The due date is the one the mistake set, not the replay's.
    expect(pair.dueAt).toBe("2026-08-31T10:00:00.000Z");
  });

  it("keeps the attempt log intact", () => {
    expect(upgradeLearnerState(v1State()).state.attempts).toHaveLength(2);
  });

  it("reports no change for a record already in the current shape", () => {
    const current: StoredLearnerState = {
      ...v1State(),
      version: STATE_VERSION,
      completedLessonIds: ["hedge-or-pledge/u1l1", "hedge-or-pledge/u1l2"],
      attempts: [attempt({ correct: false }), attempt({ correct: true, isRetry: true })],
      mastery: {
        "hedge::pledge": {
          confusionPairId: "hedge::pledge",
          consecutiveCorrect: 0,
          lapses: 1,
          evidenceTypes: [],
          unseenScenarioCorrect: false,
          firstSeenAt: "2026-08-30T10:00:00.000Z",
          lastReviewedAt: "2026-08-30T10:00:00.000Z",
          dueAt: "2026-08-31T10:00:00.000Z",
          schedulerVersion: "0.2.0",
        },
      },
    };
    const report = upgradeLearnerState(current);
    const before = current.mastery["hedge::pledge"] as unknown as Record<string, unknown>;
    const after = report.state.mastery["hedge::pledge"] as unknown as Record<string, unknown>;
    const diff = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
    expect({
      changed: report.changed,
      diff,
      qualified: report.qualifiedLessons,
      retries: report.retries,
      version: current.version,
      stateVersion: report.state.version,
    }).toEqual({ changed: false, diff: [], qualified: 0, retries: 1, version: 2, stateVersion: 2 });
  });

  it("is idempotent", () => {
    const once = upgradeLearnerState(v1State()).state;
    const twice = upgradeLearnerState(once);
    expect(twice.changed).toBe(false);
    expect(twice.state).toEqual(once);
  });

  it("caps a current record without replaying its mastery", () => {
    const attempts = Array.from({ length: MAX_ATTEMPT_LOG + 40 }, (_, index) =>
      attempt({
        eventId: `e${index}`,
        exerciseId: `prompt-${index % 5}`,
        correct: true,
        exerciseType: "meaning",
        occurredAt: `2026-08-30T10:${String(index % 60).padStart(2, "0")}:00.000Z`,
      }),
    );
    const mastery: Record<string, MasteryState> = {
      "hedge::pledge": {
        confusionPairId: "hedge::pledge",
        consecutiveCorrect: 4,
        lapses: 0,
        evidenceTypes: ["meaning"],
        unseenScenarioCorrect: false,
        schedulerVersion: "0.2.0",
      },
    };
    const report = upgradeLearnerState(
      v1State({
        version: STATE_VERSION,
        completedLessonIds: ["hedge-or-pledge/u1l1"],
        attempts,
        mastery,
      }),
    );
    expect(report.changed).toBe(true);
    expect(report.state.attempts).toHaveLength(MAX_ATTEMPT_LOG);
    expect(report.state.mastery["hedge::pledge"].consecutiveCorrect).toBe(4);
    expect(report.loweredPairs).toEqual([]);
    const again = upgradeLearnerState(report.state);
    expect(again.changed).toBe(false);
    expect(again.state).toEqual(report.state);
  });

  it("does not need the course to qualify ids", () => {
    // Deliberate: the upgrade runs before any pack is loaded, so it cannot
    // look up lesson ownership. Bare ids only ever came from the legacy pack.
    expect(upgradeLearnerState(v1State()).state.completedLessonIds[0]).toBe("hedge-or-pledge/u1l1");
  });
});

describe("after the upgrade, the engine sees one shape", () => {
  it("recognises a qualified lesson as done", () => {
    const state: LearnerState = upgradeLearnerState(v1State()).state;
    const course = { packId: "hedge-or-pledge" } as Parameters<typeof isLessonDone>[1];
    expect(isLessonDone(state, course, "u1l1")).toBe(true);
    expect(isLessonDone(state, course, "u1l9")).toBe(false);
  });

  it("does not leak legacy completions into another pack", () => {
    const state = upgradeLearnerState(v1State()).state;
    const t1 = { packId: "t1-finance-news" } as Parameters<typeof isLessonDone>[1];
    // Both packs have a "u1l1"; finishing one must not unlock the other.
    expect(isLessonDone(state, t1, "u1l1")).toBe(false);
  });
});

describe("the requeue path produces the pattern the upgrade looks for", () => {
  it("logs the same exercise id twice, wrong then right", () => {
    const env = {
      now: () => new Date("2026-08-30T10:00:00.000Z"),
      random: () => 0.5,
      deviceId: "t",
      eventId: (() => {
        let n = 0;
        return () => `e${++n}`;
      })(),
    };
    const course = {
      schemaVersion: 1,
      packId: "test",
      contentVersion: "1",
      locale: "zh-CN",
      generatedAt: "2026-08-30T00:00:00.000Z",
      units: [{ id: 1, title: "U", blurb: "" }],
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
          risk: "evergreen" as const,
          reviewStatus: "legacy" as const,
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
            {
              id: "u1l1-match",
              type: "match" as const,
              termIds: ["hedge"],
              why: "",
              pairs: [
                { id: "hedge", left: "hedge", right: "H" },
                { id: "x", left: "x", right: "X" },
              ],
            },
          ],
        },
      ],
      sources: [],
    };
    const session = startSession(course, "u1l1", env);
    const miss = applyAnswer(course, emptyLearnerState(), session, false, env, {
      confusionPair: ["hedge", "pledge"],
    });
    const replay = applyAnswer(course, miss.state, requeuePrompt(miss.session, "u1l1-match"), "matched", env);
    const idx = inferredRetryIndices(replay.state.attempts);
    expect(idx).toHaveLength(1);
    expect(replay.state.attempts[idx[0]].exerciseId).toBe(replay.state.attempts[idx[0] - 1].exerciseId);
  });
});
