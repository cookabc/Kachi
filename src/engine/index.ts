import type {
  AttemptEvent,
  Concept,
  Course,
  Environment,
  Exercise,
  LearnerState,
  MasteryState,
  SessionState,
} from "../domain";

export const ENGINE_VERSION = "0.1.0";
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

export function emptyLearnerState(): LearnerState {
  return {
    version: 1,
    xp: 0,
    streak: 0,
    completedLessonIds: [],
    seenConceptIds: [],
    mastery: {},
    attempts: [],
  };
}

/** Canonical mastery-map key for a confusion pair: the two ids, sorted, joined. */
export function pairIdForConcepts(leftId: string, rightId: string): string {
  return [leftId, rightId].sort().join("::");
}

export function pairIdForConcept(concept: Concept | undefined): string | undefined {
  if (!concept?.mixUp) return undefined;
  return pairIdForConcepts(concept.id, concept.mixUp);
}

/** The pack that predates multi-pack support: bare lesson ids can only be its. */
export const LEGACY_PACK_ID = "hedge-or-pledge";

/**
 * Storage key for a finished lesson. Lesson ids are only unique inside a pack —
 * both the legacy pack and T1 start at "u1l1" — so the pack id must prefix them
 * or finishing one course silently unlocks the other.
 */
export function lessonKey(course: Course, lessonId: string): string {
  return `${course.packId ?? LEGACY_PACK_ID}/${lessonId}`;
}

/** Whether a lesson is finished, accepting pre-namespacing saved state. */
export function isLessonDone(state: LearnerState, course: Course, lessonId: string): boolean {
  if (state.completedLessonIds.includes(lessonKey(course, lessonId))) return true;
  // Saved state written before packs existed has bare ids, which can only have
  // come from the legacy pack.
  return course.packId === LEGACY_PACK_ID && state.completedLessonIds.includes(lessonId);
}

export function getExercise(course: Course, exerciseId: string): Exercise {
  for (const lesson of course.lessons) {
    const found = lesson.prompts.find((prompt) => prompt.id === exerciseId);
    if (found) return found;
  }
  throw new Error(`Unknown exercise: ${exerciseId}`);
}

export function startSession(course: Course, lessonId: string, environment: Environment): SessionState {
  const lesson = course.lessons.find((item) => item.id === lessonId);
  if (!lesson) throw new Error(`Unknown lesson: ${lessonId}`);

  return {
    lessonId,
    mode: "lesson",
    // Deliberately copy IDs: retry behavior must never mutate published content.
    promptIds: lesson.prompts.map((prompt) => prompt.id),
    index: 0,
    results: [],
    startedAt: environment.now().toISOString(),
  };
}

export function startPracticeSession(promptIds: string[], environment: Environment): SessionState {
  if (!promptIds.length) throw new Error("Practice needs at least one prompt");
  return {
    lessonId: "practice",
    mode: "practice",
    promptIds: [...promptIds],
    index: 0,
    results: [],
    startedAt: environment.now().toISOString(),
  };
}

export function currentExercise(course: Course, session: SessionState): Exercise | undefined {
  const id = session.promptIds[session.index];
  return id ? getExercise(course, id) : undefined;
}

export function isLessonUnlocked(state: LearnerState, course: Course, lessonId: string): boolean {
  const index = course.lessons.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return false;
  return index === 0 || isLessonDone(state, course, course.lessons[index - 1].id);
}

export function isCorrect(exercise: Exercise, answer: string | boolean): boolean {
  if (exercise.type === "truefalse") return answer === exercise.answer;
  if (exercise.type === "fill") return answer === exercise.answer;
  if (exercise.type === "match") return answer === "matched";
  if (typeof exercise.answer !== "number" || !exercise.options) return false;
  return answer === exercise.options[exercise.answer]?.text;
}

// "Today" follows the learner's wall clock (PRD §9), not UTC — a lesson
// finished at 00:30 in UTC+8 belongs to the local day it was played in.
function localDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

/**
 * Whether this scenario is one the learner has never answered before.
 *
 * The previous test was `exercise.assessmentOnly`, a field no pack ever set —
 * 0 of 481 prompts across both packs — so `unseenScenarioCorrect` was pinned to
 * false and isVerifiedMastery() could never return true. "Unseen" is better
 * defined by the attempt log anyway: the first time you meet a prompt in a real
 * situation is exactly what the flag was trying to name.
 */
export function isFirstEncounter(state: LearnerState, exercise: Exercise, session: SessionState): boolean {
  if (exercise.type !== "scenario") return false;
  // Practice deliberately re-drills known prompts; only a lesson presents a
  // prompt in its intended place in the curriculum.
  if (session.mode !== "lesson") return false;
  return !state.attempts.some((attempt) => attempt.exerciseId === exercise.id);
}

function nextMastery(
  previous: MasteryState | undefined,
  attempt: AttemptEvent,
  isUnseenScenario: boolean,
): MasteryState | undefined {
  if (!attempt.confusionPairId) return undefined;
  const base: MasteryState = previous ?? {
    confusionPairId: attempt.confusionPairId,
    consecutiveCorrect: 0,
    lapses: 0,
    evidenceTypes: [],
    unseenScenarioCorrect: false,
    schedulerVersion: ENGINE_VERSION,
  };

  if (!attempt.correct || attempt.hintUsed) {
    return {
      ...base,
      consecutiveCorrect: 0,
      lapses: base.lapses + 1,
      lastReviewedAt: attempt.occurredAt,
      dueAt: addDays(new Date(attempt.occurredAt), 1),
      firstSeenAt: base.firstSeenAt ?? attempt.occurredAt,
    };
  }

  const consecutiveCorrect = Math.min(base.consecutiveCorrect + 1, REVIEW_INTERVAL_DAYS.length);
  const interval = REVIEW_INTERVAL_DAYS[consecutiveCorrect - 1];
  return {
    ...base,
    consecutiveCorrect,
    evidenceTypes: base.evidenceTypes.includes(attempt.exerciseType)
      ? base.evidenceTypes
      : [...base.evidenceTypes, attempt.exerciseType],
    unseenScenarioCorrect: base.unseenScenarioCorrect || isUnseenScenario,
    firstSeenAt: base.firstSeenAt ?? attempt.occurredAt,
    lastReviewedAt: attempt.occurredAt,
    dueAt: addDays(new Date(attempt.occurredAt), interval),
    schedulerVersion: ENGINE_VERSION,
  };
}

export interface ApplyOptions {
  hintUsed?: boolean;
  /**
   * Hearts left after this answer, when the caller tracks hearts (0 = lesson failed).
   * A failed finish records the attempt but must not complete the lesson,
   * pay the completion/perfect bonuses, or touch the streak.
   */
  heartsAfter?: number;
  /**
   * Match mispair: the two chip ids the player actually paired (left, right).
   * A match prompt carries no termId, so without this the engine cannot tell
   * which confusion pair lapsed — and the forced corrective rerun, which
   * succeeds, would be the only record of the mistake.
   */
  confusionPair?: [string, string];
}

export function applyAnswer(
  course: Course,
  state: LearnerState,
  session: SessionState,
  answer: string | boolean,
  environment: Environment,
  options: ApplyOptions = {},
): { state: LearnerState; session: SessionState; attempt: AttemptEvent; finished: boolean } {
  const exercise = currentExercise(course, session);
  if (!exercise) throw new Error("Cannot answer a finished session");
  const concept = course.concepts.find((item) => item.id === exercise.termId);
  const now = environment.now();
  // A match mispair names the two chips the player actually confused. Raw chip
  // IDs always stay in the answer, but only published concepts can contribute
  // recent-miss focus or form a schedulable mastery pair.
  const mispair = options.confusionPair;
  const mispairConceptIds = mispair?.filter((id) => course.concepts.some((item) => item.id === id));
  const attempt: AttemptEvent = {
    eventId: environment.eventId(),
    deviceId: environment.deviceId,
    contentVersion: course.contentVersion,
    engineVersion: ENGINE_VERSION,
    exerciseId: exercise.id,
    conceptIds: mispair
      ? (mispairConceptIds ?? [])
      : exercise.termIds.filter((id) => course.concepts.some((item) => item.id === id)),
    confusionPairId:
      mispairConceptIds?.length === 2
        ? pairIdForConcepts(mispairConceptIds[0], mispairConceptIds[1])
        : pairIdForConcept(concept),
    exerciseType: exercise.type,
    answer: mispair ? `match:${mispair[0]}:${mispair[1]}` : String(answer),
    correct: isCorrect(exercise, answer),
    hintUsed: options.hintUsed ?? false,
    latencyMs: 0,
    occurredAt: now.toISOString(),
  };
  const prior = attempt.confusionPairId ? state.mastery[attempt.confusionPairId] : undefined;
  const mastery = nextMastery(prior, attempt, isFirstEncounter(state, exercise, session));
  const nextMasteryMap = mastery ? { ...state.mastery, [mastery.confusionPairId]: mastery } : state.mastery;
  const seenConceptIds = Array.from(new Set([...state.seenConceptIds, ...attempt.conceptIds]));
  const nextSession: SessionState = {
    ...session,
    index: session.index + 1,
    results: [...session.results, attempt],
  };
  const finished = nextSession.index >= nextSession.promptIds.length;
  // A wrong final answer that also spends the last heart is a failed finish (PRD §9):
  // retry refills hearts, so the lesson is not completed by the failing run.
  const failedFinish =
    finished && !attempt.correct && options.heartsAfter !== undefined && options.heartsAfter <= 0;
  const completesLesson = finished && session.mode === "lesson" && !failedFinish;
  const flawless = completesLesson && attempt.correct && session.results.every((result) => result.correct);
  const completedLessonIds = completesLesson
    ? Array.from(new Set([...state.completedLessonIds, lessonKey(course, session.lessonId)]))
    : state.completedLessonIds;
  const completedToday = completesLesson && state.lastLessonDate !== localDate(now);
  const streak = completedToday
    ? state.lastLessonDate === localDate(new Date(now.getTime() - 86_400_000))
      ? state.streak + 1
      : 1
    : state.streak;

  return {
    state: {
      ...state,
      xp: state.xp + (attempt.correct ? 10 : 0) + (completesLesson ? 20 : 0) + (flawless ? 20 : 0),
      streak,
      lastLessonDate: completedToday ? localDate(now) : state.lastLessonDate,
      completedLessonIds,
      seenConceptIds,
      mastery: nextMasteryMap,
      attempts: [...state.attempts, attempt],
    },
    session: nextSession,
    attempt,
    finished,
  };
}

export function duePairIds(state: LearnerState, now: Date): string[] {
  return Object.values(state.mastery)
    .filter((item) => item.dueAt && new Date(item.dueAt).getTime() <= now.getTime())
    .sort((a, b) => (a.dueAt ?? "").localeCompare(b.dueAt ?? ""))
    .map((item) => item.confusionPairId);
}

export function isVerifiedMastery(item: MasteryState | undefined): boolean {
  return Boolean(
    item && item.consecutiveCorrect >= 3 && item.evidenceTypes.length >= 2 && item.unseenScenarioCorrect,
  );
}

/**
 * Put a prompt back at the front of the remaining queue. The match exercise
 * re-queues itself after a wrong pairing so the player can still finish the
 * pairs they know; the failed attempt stays on record.
 */
export function requeuePrompt(session: SessionState, exerciseId: string): SessionState {
  const promptIds = [...session.promptIds];
  const at = Math.min(Math.max(session.index, 0), promptIds.length);
  promptIds.splice(at, 0, exerciseId);
  return { ...session, promptIds };
}

/**
 * Terms whose most recent attempt was wrong — the practice focus set.
 * Derived from the attempt log so it needs no extra persisted field.
 */
export function recentMissTermIds(state: LearnerState): string[] {
  const latest = new Map<string, boolean>();
  for (const attempt of state.attempts) {
    for (const conceptId of attempt.conceptIds) latest.set(conceptId, attempt.correct);
  }
  const missed: string[] = [];
  for (const [conceptId, correct] of latest) {
    if (!correct) missed.push(conceptId);
  }
  return missed;
}
