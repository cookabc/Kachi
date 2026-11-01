import type { Course, Environment, LearnerState, SessionState } from "./domain";
import {
  applyAnswer,
  currentExercise,
  isLessonUnlocked,
  paidExerciseIds,
  requeueAtEnd,
  startPracticeSession,
  startSession,
} from "./engine";
import {
  PRACTICE_ROUND,
  type PresentedExercise,
  practicePool,
  present,
  realTermIds,
  resolveMatch,
  type Summary,
  sessionSummary,
  type TeachMode,
  teachPlan,
  withTwins,
} from "./flow";

/**
 * The lesson lifecycle as one pure value.
 *
 * Every transition is a pure function of (state, event), so the riskiest logic
 * in the app — when a lesson fails, when a match re-queues, what a hint costs —
 * is testable without React, a DOM, or a clock.
 *
 * Deliberately excluded: timers, refs, and persistence. Latency is passed in
 * on the answer event; saving the resulting LearnerState stays in the caller.
 */

export type Phase = "teach" | "question" | "feedback" | "complete";

/** Everything the lesson screens need to render, and nothing they don't. */
export interface LessonFlow {
  phase: Phase;
  session: SessionState | null;
  presented: PresentedExercise | null;
  selection: string | boolean | null;
  lastCorrect: boolean;
  /** Correct answers in a row this session — the in-lesson combo. */
  combo: number;
  /** Longest combo this session, for the completion screen. */
  bestCombo: number;
  teachMode: TeachMode;
  teachTerms: string[];
  teachIndex: number;
  selL: string | null;
  selR: string | null;
  locked: string[];
  summary: Summary | null;
  hintShown: boolean;
}

export function idleFlow(): LessonFlow {
  return {
    phase: "teach",
    session: null,
    presented: null,
    selection: null,
    lastCorrect: false,
    combo: 0,
    bestCombo: 0,
    teachMode: "first",
    teachTerms: [],
    teachIndex: 0,
    selL: null,
    selR: null,
    locked: [],
    summary: null,
    hintShown: false,
  };
}

export type FlowEvent =
  | { type: "startLesson"; lessonId: string }
  | { type: "startPractice"; focusIds?: string[] }
  | { type: "select"; value: string | boolean }
  | { type: "selectChip"; side: "left" | "right"; id: string }
  | { type: "submit"; latencyMs: number; answer?: string | boolean }
  | { type: "submitMatch"; leftId: string; rightId: string; latencyMs: number }
  | { type: "teachContinue" }
  | { type: "continue" }
  | { type: "hint" }
  | { type: "close" };

export interface FlowContext {
  course: Course;
  environment: Environment;
}

/**
 * The reducer's single state value: the lesson flow plus the learner record it
 * is mutating. Keeping them in one object means a caller cannot accidentally
 * thread a stale learner into the next event and silently drop mastery and XP.
 */
export interface FlowState {
  flow: LessonFlow;
  learner: LearnerState;
}

export function idleState(learner: LearnerState): FlowState {
  return { flow: idleFlow(), learner };
}

export interface FlowOutcome {
  state: FlowState;
  /** Concept ids newly met, to be folded into the learner state by the caller. */
  seen: string[];
}

/** Move to the prompt at the session cursor, or finish if the queue is spent. */
function advance(
  flow: LessonFlow,
  working: SessionState,
  ctx: FlowContext,
): { flow: LessonFlow; seen: string[] } {
  if (working.index >= working.promptIds.length) {
    return {
      flow: { ...flow, session: working, phase: "complete", summary: sessionSummary(working) },
      seen: [],
    };
  }
  const next = currentExercise(ctx.course, working);
  if (!next) {
    return {
      flow: { ...flow, session: working, phase: "complete", summary: sessionSummary(working) },
      seen: [],
    };
  }
  return {
    flow: {
      ...flow,
      session: working,
      phase: "question",
      presented: present(next, ctx.environment.random),
      selection: null,
      locked: [],
      selL: null,
      selR: null,
      hintShown: false,
    },
    seen: realTermIds(next, ctx.course),
  };
}

export function reduceFlow(state: FlowState, event: FlowEvent, ctx: FlowContext): FlowOutcome {
  const { course, environment } = ctx;
  const { flow, learner } = state;
  const keep = (next: LessonFlow, seen: string[] = []): FlowOutcome => ({
    state: { flow: next, learner },
    seen,
  });

  switch (event.type) {
    case "startLesson": {
      const lesson = course.lessons.find((item) => item.id === event.lessonId);
      if (!lesson || !isLessonUnlocked(learner, course, event.lessonId)) return keep(flow);
      const fresh = {
        ...startSession(course, event.lessonId, environment),
        priorPaidExerciseIds: paidExerciseIds(learner),
      };
      const plan = teachPlan(lesson, course);
      const base: LessonFlow = {
        ...idleFlow(),
        session: fresh,
        teachMode: plan.mode,
        teachTerms: plan.terms,
        teachIndex: 0,
      };
      if (plan.terms.length) {
        return keep(
          { ...base, phase: "teach" },
          withTwins(course, plan.mode === "recap" ? plan.terms : [plan.terms[0]]),
        );
      }
      // Nothing to teach (a review whose unit has no terms): straight to the
      // first question, exactly as the old callback chain did.
      const first = currentExercise(course, fresh);
      return keep(
        { ...base, phase: "question", presented: first ? present(first, environment.random) : null },
        first ? realTermIds(first, course) : [],
      );
    }

    case "startPractice": {
      const picked = practicePool(
        learner,
        course,
        event.focusIds,
        PRACTICE_ROUND,
        environment.now(),
        environment.random,
      );
      if (!picked.length) return keep(flow);
      const fresh = {
        ...startPracticeSession(picked, environment),
        priorPaidExerciseIds: paidExerciseIds(learner),
      };
      const first = currentExercise(course, fresh);
      if (!first) return keep(flow);
      return keep(
        {
          ...idleFlow(),
          phase: "question",
          session: fresh,
          presented: present(first, environment.random),
        },
        realTermIds(first, course),
      );
    }

    case "select":
      if (flow.phase !== "question") return keep(flow);
      return keep({ ...flow, selection: event.value });

    case "selectChip": {
      if (flow.phase !== "question") return keep(flow);
      if (event.side === "left") return keep({ ...flow, selL: event.id });
      return keep({ ...flow, selR: event.id });
    }

    case "hint":
      if (flow.phase !== "question" || flow.hintShown) return keep(flow);
      return keep({ ...flow, hintShown: true });

    case "submit": {
      if (!flow.session || flow.phase !== "question") return keep(flow);
      const answer = event.answer ?? flow.selection;
      if (answer === null) return keep(flow);
      return applyAndFeedback(state, answer, undefined, event.latencyMs, ctx);
    }

    case "submitMatch": {
      if (!flow.session || flow.phase !== "question" || !flow.presented?.pairs) return keep(flow);
      if (flow.locked.includes(event.leftId)) return keep(flow);
      const outcome = resolveMatch(flow.locked, flow.presented.pairs, event.leftId, event.rightId);
      if (outcome.judged === null) {
        // A correct pair locks in; the prompt stays open for the rest.
        return keep({ ...flow, locked: outcome.locked, selL: null, selR: null });
      }
      if (outcome.judged === "matched") {
        return applyAndFeedback(
          { flow: { ...flow, locked: outcome.locked }, learner },
          "matched",
          undefined,
          event.latencyMs,
          ctx,
        );
      }
      // A mispair judges the whole prompt wrong; the two chips are the real
      // confusion evidence and must reach the engine as such.
      return applyAndFeedback(state, false, [event.leftId, event.rightId], event.latencyMs, ctx);
    }

    case "teachContinue": {
      if (flow.phase !== "teach") return keep(flow);
      const last = flow.teachMode === "recap" || flow.teachIndex >= flow.teachTerms.length - 1;
      if (last) {
        if (!flow.session) return keep(flow);
        const first = currentExercise(course, flow.session);
        return keep(
          { ...flow, phase: "question", presented: first ? present(first, environment.random) : null },
          first ? realTermIds(first, course) : [],
        );
      }
      const nextIndex = flow.teachIndex + 1;
      return keep({ ...flow, teachIndex: nextIndex }, withTwins(course, [flow.teachTerms[nextIndex]]));
    }

    case "continue": {
      if (!flow.session || !flow.presented || flow.phase !== "feedback") return keep(flow);
      let working = flow.session;
      // There are no hearts and no failing: a missed prompt comes back once at
      // the end of the queue, after the right answer has had time to settle.
      if (!flow.lastCorrect) working = requeueAtEnd(flow.session, flow.presented.id);
      const next = advance(flow, working, ctx);
      return keep(next.flow, next.seen);
    }

    case "close":
      return keep(idleFlow());

    default:
      return keep(flow);
  }
}

/** Shared tail of every graded answer: apply to the engine, then show feedback. */
function applyAndFeedback(
  state: FlowState,
  answer: string | boolean,
  confusionPair: [string, string] | undefined,
  latencyMs: number,
  ctx: FlowContext,
): FlowOutcome {
  const { flow, learner } = state;
  if (!flow.session) return { state, seen: [] };
  const result = applyAnswer(ctx.course, learner, flow.session, answer, ctx.environment, {
    confusionPair,
    latencyMs,
    hintUsed: flow.hintShown,
  });
  const correct = result.attempt.correct;
  const combo = correct ? flow.combo + 1 : 0;
  return {
    state: {
      flow: {
        ...flow,
        session: result.session,
        combo,
        bestCombo: Math.max(flow.bestCombo, combo),
        lastCorrect: correct,
        hintShown: false,
        phase: "feedback",
      },
      learner: result.state,
    },
    seen: [],
  };
}
