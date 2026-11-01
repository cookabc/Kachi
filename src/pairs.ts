import type { Course, LearnerState, MasteryState, MixUpType } from "./domain";
import { isLessonDone, isLessonUnlocked, pairIdForConcepts } from "./engine";
import { conceptOf, teachPlan } from "./flow";

/**
 * A confusion pair as the learner meets it: two concepts and why they mix.
 *
 * Kachi's unit of learning is the pair, not the word. The engine already keys
 * mastery by pair id; this module gives the screens the same view — one entry
 * per pair, in teaching order, with the evidence the learner has built for it.
 */
export interface Pair {
  id: string;
  a: string;
  b: string;
  unit: number;
  type: MixUpType;
  why: string;
}

/** Every resolvable mix-up pair in the course, deduplicated, in teaching order. */
export function coursePairs(course: Course): Pair[] {
  const pairs: Pair[] = [];
  const seen = new Set<string>();
  for (const concept of course.concepts) {
    const twin = conceptOf(course, concept.mixUp);
    if (!twin || twin.id === concept.id) continue;
    const id = pairIdForConcepts(concept.id, twin.id);
    if (seen.has(id)) continue;
    seen.add(id);
    pairs.push({
      id,
      a: concept.id,
      b: twin.id,
      unit: concept.unit,
      type: concept.mixUpType ?? "coexist",
      why: concept.mixUpWhy,
    });
  }
  return pairs;
}

/** A pair is met once both words have been on screen in a lesson. */
export function isPairMet(state: LearnerState, pair: Pair): boolean {
  return state.seenConceptIds.includes(pair.a) && state.seenConceptIds.includes(pair.b);
}

/**
 * How well the learner knows a pair, 0–3, from the engine's own ladder:
 * 0 just met, 1 answered right once, 2 a run of three, 3 verified mastery
 * (three in a row across two exercise types, including an unseen scenario).
 */
export function pairStrength(mastery: MasteryState | undefined): 0 | 1 | 2 | 3 {
  if (!mastery) return 0;
  if (mastery.consecutiveCorrect >= 3 && mastery.evidenceTypes.length >= 2 && mastery.unseenScenarioCorrect)
    return 3;
  if (mastery.consecutiveCorrect >= 3) return 2;
  if (mastery.consecutiveCorrect >= 1) return 1;
  return 0;
}

/** Pairs of this course whose review date has passed. */
export function duePairs(state: LearnerState, course: Course, now: Date): Pair[] {
  return coursePairs(course).filter((pair) => {
    const dueAt = state.mastery[pair.id]?.dueAt;
    return dueAt !== undefined && new Date(dueAt).getTime() <= now.getTime();
  });
}

/** The lesson to play next: the first unlocked, unfinished one (or the first). */
export function nextLessonIndex(state: LearnerState, course: Course): number {
  const index = course.lessons.findIndex(
    (lesson) => isLessonUnlocked(state, course, lesson.id) && !isLessonDone(state, course, lesson.id),
  );
  return index < 0 ? -1 : index;
}

/**
 * The pairs a lesson is about, for its node label, the "up next" card and the
 * completion screen. A normal lesson owns a pair when both words are on its
 * screens (taught as a twin card or asked about); a review owns its unit's.
 */
export function lessonPairs(course: Course, lessonId: string): Pair[] {
  const lesson = course.lessons.find((item) => item.id === lessonId);
  if (!lesson) return [];
  if (lesson.review) return coursePairs(course).filter((pair) => pair.unit === lesson.unit);
  const ids = new Set<string>();
  for (const lead of teachPlan(lesson, course).terms) {
    ids.add(lead);
    const twin = conceptOf(course, lead)?.mixUp;
    if (twin) ids.add(twin);
  }
  for (const prompt of lesson.prompts) for (const id of prompt.termIds ?? []) ids.add(id);
  return coursePairs(course).filter((pair) => ids.has(pair.a) && ids.has(pair.b));
}
