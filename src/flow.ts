import type { Concept, Course, Exercise, LearnerState, SessionState } from "./domain";
import { duePairIds, isLessonUnlocked, recentMissTermIds } from "./engine";

export const PRACTICE_ROUND = 10;

/* A presentation copy of a published exercise: shuffled options/bank/columns
   plus the derived correct text. Published content is never mutated. */
export interface PresentedExercise extends Exercise {
  correctText?: string;
  left: Array<{ id: string; text: string }>;
  right: Array<{ id: string; text: string }>;
}

export interface Summary {
  gained: number;
  xpHit: number;
  xpDone: number;
  xpPerfect: number;
  correct: number;
  total: number;
  mix: string[];
}

export type TeachMode = "first" | "recap";

export function conceptOf(course: Course, id: string): Concept | undefined {
  return course.concepts.find((concept) => concept.id === id);
}

export function realTermIds(prompt: Exercise, course: Course): string[] {
  return (prompt.termIds ?? []).filter((id) => conceptOf(course, id) !== undefined);
}

function shuffle<T>(arr: T[], random: () => number): T[] {
  const copy = arr.slice();
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    const t = copy[i];
    copy[i] = copy[j];
    copy[j] = t;
  }
  return copy;
}

/**
 * A presentation copy of a published exercise. `random` is injectable so the
 * session reducer can be driven deterministically in tests; production passes
 * the environment's generator.
 */
export function present(prompt: Exercise, random: () => number = Math.random): PresentedExercise {
  const copy: PresentedExercise = { ...prompt, left: [], right: [] };
  if (prompt.type === "match" && prompt.pairs) {
    copy.left = shuffle(
      prompt.pairs.map((pair) => ({ id: pair.id, text: pair.left })),
      random,
    );
    copy.right = shuffle(
      prompt.pairs.map((pair) => ({ id: pair.id, text: pair.right })),
      random,
    );
  }
  if (prompt.options && typeof prompt.answer === "number") {
    copy.correctText = prompt.options[prompt.answer]?.text;
    copy.options = shuffle(prompt.options, random);
  }
  if (prompt.type === "fill" && prompt.bank) copy.bank = shuffle(prompt.bank, random);
  return copy;
}

function primaryTermIds(course: Course, lesson: Course["lessons"][number]): string[] {
  const ids: string[] = [];
  lesson.prompts.forEach((prompt) => {
    if (prompt.termId && conceptOf(course, prompt.termId) && ids.indexOf(prompt.termId) === -1)
      ids.push(prompt.termId);
  });
  return ids;
}

function unitTermIds(course: Course, unit: number): string[] {
  const ids: string[] = [];
  course.concepts.forEach((concept) => {
    if (concept.unit === unit && ids.indexOf(concept.id) === -1) ids.push(concept.id);
  });
  return ids;
}

function taughtInEarlierLessons(course: Course, lesson: Course["lessons"][number]): Set<string> {
  const seen = new Set<string>();
  const here = course.lessons.findIndex((item) => item.id === lesson.id);
  course.lessons.forEach((item, index) => {
    if (item.unit !== lesson.unit || item.review || index >= here) return;
    primaryTermIds(course, item).forEach((id) => {
      seen.add(id);
    });
  });
  return seen;
}

// A review recaps every unit term; a normal lesson teaches the terms that are
// not already taught by earlier lessons of the same unit.
export function teachPlan(
  lesson: Course["lessons"][number],
  course: Course,
): { mode: TeachMode; terms: string[] } {
  if (lesson.review) return { mode: "recap", terms: unitTermIds(course, lesson.unit) };
  const seen = taughtInEarlierLessons(course, lesson);
  return { mode: "first", terms: primaryTermIds(course, lesson).filter((id) => !seen.has(id)) };
}

// The pair a lesson is "about": the first newly taught concept whose declared
// mix-up resolves to a published concept. Drives the complete-screen stamp;
// review lessons fall back to the unit's first resolvable pair.
export function lessonPair(course: Course, lessonId: string): { a: string; b: string } | null {
  const lesson = course.lessons.find((item) => item.id === lessonId);
  if (!lesson) return null;
  for (const id of teachPlan(lesson, course).terms) {
    const concept = conceptOf(course, id);
    if (!concept) continue;
    const sibling = conceptOf(course, concept.mixUp);
    if (sibling) return { a: concept.term, b: sibling.term };
  }
  return null;
}

// Practice pool: focus (explicit, then due confusion pairs, then recent misses)
// sorts weak prompts first; the pool is capped at unlocked lessons, plus the
// first two lessons kept open as the fresh-player seed. `now` is injectable
// for deterministic tests.
//
// The seed is "the first two lessons of this course", not the literal ids
// "u1l1"/"u1l2": hardcoded ids silently produced an empty practice round for
// any pack that names its lessons differently.
export function practicePool(
  state: LearnerState,
  course: Course,
  focusIds?: string[],
  roundSize = PRACTICE_ROUND,
  now: Date = new Date(),
  random: () => number = Math.random,
): string[] {
  const seedIds = new Set(course.lessons.slice(0, 2).map((lesson) => lesson.id));
  const due = new Set(duePairIds(state, now));
  const focus = new Set<string>(focusIds ?? []);
  if (!focus.size) {
    // Pair ids are "a::b" concept-id keys. An observed match mispair may not
    // be any published concept's canonical mixUp pair, so focus both halves
    // directly instead of only mapping canonical pairs back to concepts.
    due.forEach((pairId) => {
      pairId.split("::").forEach((id) => {
        if (conceptOf(course, id)) focus.add(id);
      });
    });
  }
  if (!focus.size)
    recentMissTermIds(state).forEach((id) => {
      focus.add(id);
    });

  const available = course.lessons
    .filter((lesson) => isLessonUnlocked(state, course, lesson.id) || seedIds.has(lesson.id))
    .flatMap((lesson) => lesson.prompts);
  let pool: Exercise[];
  if (focus.size) {
    const weak = available.filter((prompt) => realTermIds(prompt, course).some((id) => focus.has(id)));
    const weakIds = new Set(weak.map((prompt) => prompt.id));
    const rest = available.filter((prompt) => !weakIds.has(prompt.id));
    pool = shuffle(weak, random).concat(shuffle(rest, random));
  } else {
    pool = shuffle(
      course.lessons.filter((lesson) => seedIds.has(lesson.id)).flatMap((lesson) => lesson.prompts),
      random,
    );
  }
  const picked: string[] = [];
  const seenIds = new Set<string>();
  for (const prompt of pool) {
    if (picked.length >= roundSize) break;
    if (seenIds.has(prompt.id)) continue;
    seenIds.add(prompt.id);
    picked.push(prompt.id);
  }
  return picked;
}

// Live match judging: a correct pair locks (the last one judges the prompt
// correct); the first mispair judges the whole prompt wrong.
export function resolveMatch(
  locked: string[],
  pairs: NonNullable<Exercise["pairs"]>,
  leftId: string,
  rightId: string,
): { locked: string[]; judged: "matched" | false | null } {
  if (leftId !== rightId) return { locked, judged: false };
  const nextLocked = [...locked, leftId];
  return { locked: nextLocked, judged: nextLocked.length === pairs.length ? "matched" : null };
}

// Mirrors the engine payout (applyAnswer): +10 per correct first attempt,
// +20 lesson completion, +20 no-mistake — practice rounds pay per correct
// only. Re-queued prompts are excluded from both the accuracy denominator and
// the XP count, matching what the engine actually pays.
export function sessionSummary(session: SessionState): Summary {
  const results = session.results;
  const graded = results.filter((result) => !result.isRetry);
  const total = graded.length;
  const correct = graded.filter((result) => result.correct).length;
  const isPractice = session.mode === "practice";
  const xpHit = correct * 10;
  const xpDone = isPractice ? 0 : 20;
  const xpPerfect = !isPractice && total > 0 && correct === total ? 20 : 0;
  const mix: string[] = [];
  results.forEach((result) => {
    if (!result.correct) {
      result.conceptIds.forEach((id) => {
        if (mix.indexOf(id) === -1) mix.push(id);
      });
    }
  });
  return {
    gained: xpHit + xpDone + xpPerfect,
    xpHit,
    xpDone,
    xpPerfect,
    correct,
    total,
    mix: mix.slice(0, 3),
  };
}
