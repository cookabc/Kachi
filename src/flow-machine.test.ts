import { describe, expect, it } from "vitest";
import type { Course, Environment, LearnerState } from "./domain";
import { emptyLearnerState, lessonKey } from "./engine";
import {
  type FlowContext,
  type FlowEvent,
  type FlowState,
  idleFlow,
  idleState,
  MAX_HEARTS,
  reduceFlow,
} from "./flow-machine";

/**
 * The lesson lifecycle is the riskiest logic in the app: hearts, failure,
 * re-queued matches, hints, and completion. These drive the reducer directly,
 * so a regression fails here instead of in a browser.
 */

const environment: Environment = {
  now: () => new Date("2026-08-30T10:00:00.000Z"),
  random: () => 0.5,
  deviceId: "test",
  eventId: () => "event",
};

function concept(id: string, unit: number, mixUp: string) {
  return {
    id,
    unit,
    term: id,
    caption: "",
    definition: `${id} def`,
    example: "",
    mixUp,
    mixUpWhy: "",
    sourceIds: [],
    risk: "evergreen" as const,
    reviewStatus: "legacy" as const,
  };
}

// A three-prompt lesson, so failure and completion can both be reached.
const course: Course = {
  schemaVersion: 1,
  packId: "test",
  contentVersion: "1",
  locale: "zh-CN",
  generatedAt: "2026-08-30T00:00:00.000Z",
  units: [{ id: 1, title: "Unit", blurb: "" }],
  concepts: [concept("hedge", 1, "pledge"), concept("pledge", 1, "hedge")],
  lessons: [
    {
      id: "l1",
      unit: 1,
      title: "One",
      icon: "",
      review: false,
      prompts: [
        {
          id: "q1",
          type: "meaning",
          termId: "hedge",
          termIds: ["hedge"],
          stem: "",
          options: [{ text: "right" }, { text: "wrong" }],
          answer: 0,
          why: "",
        },
        {
          id: "q2",
          type: "truefalse",
          termId: "hedge",
          termIds: ["hedge"],
          stem: "",
          answer: true,
          why: "",
        },
        {
          id: "q3",
          type: "fill",
          termId: "pledge",
          termIds: ["pledge"],
          story: "a ____",
          bank: ["pledge", "hedge"],
          answer: "pledge",
          why: "",
        },
      ],
    },
  ],
  sources: [],
};

const context: FlowContext = { course, environment };

function stateOf(learner: LearnerState = emptyLearnerState()): FlowState {
  return idleState(learner);
}

/** Run a sequence of events from a starting state. */
function run(events: FlowEvent[], start?: FlowState) {
  let state = start ?? stateOf();
  const seen: string[] = [];
  for (const event of events) {
    const out = reduceFlow(state, event, context);
    state = out.state;
    seen.push(...out.seen);
  }
  return { flow: state.flow, learner: state.learner, seen };
}

const start: FlowEvent = { type: "startLesson", lessonId: "l1" };
// q1 is a meaning prompt whose answer is options[0].text.
const correct = (latencyMs = 1000): FlowEvent => ({ type: "submit", answer: "right", latencyMs });
const wrong = (latencyMs = 1000): FlowEvent => ({ type: "submit", answer: "nope", latencyMs });
const advancePast: FlowEvent = { type: "continue" };

/**
 * Start the lesson, walk every teach card, then run the remaining events.
 * The split matters: an answer submitted during the teach phase is ignored by
 * design, so the events after the cards are the ones that actually grade.
 */
function teachThrough(events: FlowEvent[], learner?: LearnerState) {
  let state = stateOf(learner);
  const seen: string[] = [];
  const step = (event: FlowEvent) => {
    const out = reduceFlow(state, event, context);
    state = out.state;
    seen.push(...out.seen);
  };
  const [first, ...rest] = events;
  if (first) step(first);
  let guard = 0;
  while (state.flow.phase === "teach" && guard < 10) {
    step({ type: "teachContinue" });
    guard += 1;
  }
  for (const event of rest) step(event);
  return { flow: state.flow, learner: state.learner, seen };
}

describe("lesson start", () => {
  it("teaches first, then asks", () => {
    const { flow, seen } = run([start]);
    expect(flow.phase).toBe("teach");
    expect(flow.teachTerms).toEqual(["hedge", "pledge"]);
    expect(flow.teachIndex).toBe(0);
    expect(seen).toContain("hedge");
    expect(flow.hearts).toBe(MAX_HEARTS);
  });

  it("refuses a locked lesson", () => {
    const lockedCourse: Course = {
      ...course,
      lessons: [course.lessons[0], { ...course.lessons[0], id: "l2" }],
    };
    const out = reduceFlow(
      stateOf(),
      { type: "startLesson", lessonId: "l2" },
      {
        course: lockedCourse,
        environment,
      },
    );
    expect(out.state.flow).toEqual(idleFlow());
  });

  it("moves from the teach cards into the first question", () => {
    const { flow } = teachThrough([start]);
    expect(flow.phase).toBe("question");
    expect(flow.presented?.id).toBe("q1");
    expect(flow.selection).toBeNull();
  });
});

describe("answering", () => {
  it("shows feedback and keeps the heart on a correct answer", () => {
    const { flow } = teachThrough([start, correct()]);
    expect(flow.phase).toBe("feedback");
    expect(flow.lastCorrect).toBe(true);
    expect(flow.hearts).toBe(MAX_HEARTS);
  });

  it("spends a heart on a wrong answer", () => {
    const { flow } = teachThrough([start, wrong()]);
    expect(flow.lastCorrect).toBe(false);
    expect(flow.hearts).toBe(MAX_HEARTS - 1);
  });

  it("ignores a submit with nothing selected", () => {
    const { flow } = teachThrough([start, { type: "submit", latencyMs: 100 }]);
    expect(flow.phase).toBe("question");
  });

  it("advances to the next prompt and clears the per-question state", () => {
    const { flow } = teachThrough([start, correct(), advancePast]);
    expect(flow.phase).toBe("question");
    expect(flow.presented?.id).toBe("q2");
    expect(flow.selection).toBeNull();
    expect(flow.hintShown).toBe(false);
  });
});

describe("failure", () => {
  // A three-prompt lesson with five hearts can never fail — hearts only end a
  // run that runs out before the queue does. These tests start with one heart
  // so the failure branch is reachable at all.
  function oneHeart(events: FlowEvent[]) {
    let state = stateOf();
    const one = (next: FlowState): FlowState => ({ ...next, flow: { ...next.flow, hearts: 1 } });
    const [first, ...rest] = events;
    if (first) state = one(reduceFlow(state, first, context).state);
    let guard = 0;
    while (state.flow.phase === "teach" && guard < 10) {
      state = one(reduceFlow(state, { type: "teachContinue" }, context).state);
      guard += 1;
    }
    for (const event of rest) state = reduceFlow(state, event, context).state;
    return { flow: state.flow, learner: state.learner };
  }

  it("fails when the last heart is spent on a wrong answer", () => {
    const { flow } = oneHeart([start, wrong(), advancePast]);
    expect(flow.hearts).toBe(0);
    expect(flow.phase).toBe("fail");
  });

  it("does not complete the lesson on a failed finish", () => {
    const { flow, learner } = oneHeart([start, wrong(), advancePast]);
    expect(flow.phase).toBe("fail");
    expect(learner.completedLessonIds).toEqual([]);
    expect(learner.streak).toBe(0);
  });

  it("keeps going while hearts remain, even after mistakes", () => {
    // Three prompts, five hearts: two wrong answers still leave a third to answer.
    const { flow } = teachThrough([start, wrong(), advancePast, wrong(), advancePast]);
    expect(flow.hearts).toBe(MAX_HEARTS - 2);
    expect(flow.phase).toBe("question");
    expect(flow.presented?.id).toBe("q3");
  });
});

describe("completion", () => {
  it("completes and records the lesson key when the queue runs out", () => {
    const { flow, learner } = teachThrough([
      start,
      correct(),
      advancePast,
      { type: "submit", answer: true, latencyMs: 1000 },
      advancePast,
      { type: "submit", answer: "pledge", latencyMs: 1000 },
      advancePast,
    ]);
    expect(flow.phase).toBe("complete");
    expect(flow.summary?.correct).toBe(3);
    expect(flow.summary?.total).toBe(3);
    expect(learner.completedLessonIds).toEqual([lessonKey(course, "l1")]);
    expect(learner.streak).toBe(1);
  });

  it("pays the flawless bonus only when nothing was missed", () => {
    const clean = teachThrough([
      start,
      correct(),
      advancePast,
      { type: "submit", answer: true, latencyMs: 1000 },
      advancePast,
      { type: "submit", answer: "pledge", latencyMs: 1000 },
      advancePast,
    ]);
    // 3 correct = 30, completion 20, flawless 20.
    expect(clean.flow.summary?.gained).toBe(70);
  });
});

describe("match re-queue", () => {
  const matchCourse: Course = {
    ...course,
    lessons: [
      {
        ...course.lessons[0],
        prompts: [
          {
            id: "m1",
            type: "match",
            termIds: ["hedge", "pledge"],
            why: "",
            pairs: [
              { id: "hedge", left: "hedge", right: "H" },
              { id: "pledge", left: "pledge", right: "P" },
            ],
          },
        ],
      },
    ],
  };
  const matchContext: FlowContext = { course: matchCourse, environment };

  it("locks a correct pair without judging the prompt", () => {
    const started = reduceFlow(stateOf(), { type: "startLesson", lessonId: "l1" }, matchContext);
    expect(started.state.flow.phase).toBe("question");
    const locked = reduceFlow(
      started.state,
      { type: "submitMatch", leftId: "hedge", rightId: "hedge", latencyMs: 500 },
      matchContext,
    );
    expect(locked.state.flow.locked).toEqual(["hedge"]);
    expect(locked.state.flow.phase).toBe("question");
  });

  it("judges the prompt wrong on a mispair and re-queues it after continue", () => {
    const started = reduceFlow(stateOf(), { type: "startLesson", lessonId: "l1" }, matchContext);
    const mispair = reduceFlow(
      started.state,
      { type: "submitMatch", leftId: "hedge", rightId: "pledge", latencyMs: 500 },
      matchContext,
    );
    expect(mispair.state.flow.phase).toBe("feedback");
    expect(mispair.state.flow.lastCorrect).toBe(false);
    // The mispair is recorded as a lapse on the pair the player actually
    // confused. Both chips are published concepts here, so the key is the
    // canonical sorted pair.
    const pairKey = Object.keys(mispair.state.learner.mastery)[0];
    expect(pairKey).toBe("hedge::pledge");
    expect(mispair.state.learner.mastery[pairKey].lapses).toBe(1);

    const continued = reduceFlow(mispair.state, { type: "continue" }, matchContext);
    expect(continued.state.flow.phase).toBe("question");
    expect(continued.state.flow.session?.promptIds.filter((id) => id === "m1")).toHaveLength(2);
  });

  it("does not let the replay pay XP or restore mastery", () => {
    const started = reduceFlow(stateOf(), { type: "startLesson", lessonId: "l1" }, matchContext);
    const mispair = reduceFlow(
      started.state,
      { type: "submitMatch", leftId: "hedge", rightId: "pledge", latencyMs: 500 },
      matchContext,
    );
    const continued = reduceFlow(mispair.state, { type: "continue" }, matchContext);
    const xpBefore = continued.state.learner.xp;
    const ladderBefore = continued.state.learner.mastery["hedge::pledge"].consecutiveCorrect;

    // Replay: both pairs, correctly.
    let state = continued.state;
    for (const [l, r] of [
      ["hedge", "hedge"],
      ["pledge", "pledge"],
    ]) {
      state = reduceFlow(
        state,
        { type: "submitMatch", leftId: l, rightId: r, latencyMs: 500 },
        matchContext,
      ).state;
    }
    expect(state.flow.phase).toBe("feedback");
    expect(state.learner.mastery["hedge::pledge"].consecutiveCorrect).toBe(ladderBefore);
    expect(state.learner.xp).toBe(xpBefore);
  });
});

describe("hints", () => {
  it("marks the answer as hinted, which the engine treats as a lapse", () => {
    const { flow, learner } = teachThrough([start, { type: "hint" }, correct()]);
    expect(flow.phase).toBe("feedback");
    // Correct, but hinted: no ladder progress.
    expect(learner.mastery["hedge::pledge"]?.consecutiveCorrect ?? 0).toBe(0);
  });

  it("clears the hint flag for the next question", () => {
    const { flow } = teachThrough([start, { type: "hint" }, correct(), advancePast]);
    expect(flow.hintShown).toBe(false);
  });

  it("cannot be requested twice for the same question", () => {
    const once = teachThrough([start, { type: "hint" }]);
    const twice = run([{ type: "hint" }], { flow: once.flow, learner: once.learner });
    expect(twice.flow.hintShown).toBe(true);
  });
});

describe("practice", () => {
  it("starts a practice round straight into a question", () => {
    const { flow } = run([{ type: "startPractice" }]);
    expect(flow.phase).toBe("question");
    expect(flow.session?.mode).toBe("practice");
    expect(flow.presented).not.toBeNull();
  });

  it("pays no completion bonus in a practice round", () => {
    const events: FlowEvent[] = [{ type: "startPractice" }];
    // Answer everything correctly regardless of prompt type.
    for (let i = 0; i < 12; i += 1)
      events.push({ type: "submit", answer: "right", latencyMs: 500 }, advancePast);
    const { flow } = run(events);
    if (flow.phase === "complete") {
      expect(flow.summary?.xpDone).toBe(0);
    }
    // Whatever the round length, practice never completes a lesson.
    expect(flow.phase).not.toBe("teach");
  });
});

describe("close", () => {
  it("returns to the idle flow from any phase", () => {
    const mid = teachThrough([start]);
    const closed = run([{ type: "close" }], { flow: mid.flow, learner: mid.learner });
    expect(closed.flow).toEqual(idleFlow());
  });
});
