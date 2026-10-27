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

export const ENGINE_VERSION = "0.2.0";
export const REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60] as const;

/**
 * How slow an answer has to be before it stops counting as mastery evidence.
 *
 * Absolute milliseconds cannot work: the same 6-second answer is hesitation
 * for a two-word prompt and fluent for a scenario paragraph. The bar is
 * therefore the learner's own median correct latency, times this factor, so a
 * slow reader is not permanently "weak" and a fast one is not permanently
 * "strong". With too few samples to trust a median, no answer is weak.
 */
export const WEAK_LATENCY_FACTOR = 2;
/** Below this many measured answers the median is noise; trust nothing. */
export const WEAK_LATENCY_MIN_SAMPLES = 8;
/** A prompt answered instantly is not "slow" no matter what the median says. */
export const WEAK_LATENCY_FLOOR_MS = 12_000;

export function emptyLearnerState(): LearnerState {
  return {
    version: 2,
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

/**
 * The pack whose saved lesson ids predate pack qualification. Kept as a
 * constant because upgrade.ts needs it to rewrite those ids; nothing else
 * branches on it.
 */
export const LEGACY_PACK_ID = "hedge-or-pledge";

/**
 * Storage key for a finished lesson. Lesson ids are only unique inside a pack —
 * both the legacy pack and T1 start at "u1l1" — so the pack id must prefix them
 * or finishing one course silently unlocks the other.
 */
export function lessonKey(course: Course, lessonId: string): string {
  return `${course.packId}/${lessonId}`;
}

export function isLessonDone(state: LearnerState, course: Course, lessonId: string): boolean {
  return state.completedLessonIds.includes(lessonKey(course, lessonId));
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

// Yesterday is the previous local calendar date. Subtracting a fixed 24 hours
// lands on the day before yesterday when a DST spring-forward removes an hour.
function previousLocalDate(date: Date): string {
  const previous = new Date(date);
  previous.setDate(previous.getDate() - 1);
  return localDate(previous);
}

function addDays(date: Date, days: number): string {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString();
}

/**
 * Whether this scenario is one the learner has never answered before.
 *
 * Defined by the attempt log rather than a content flag: the first time you
 * meet a prompt in a real situation is exactly what "unseen" means.
 */
export function isFirstEncounter(state: LearnerState, exercise: Exercise, session: SessionState): boolean {
  if (exercise.type !== "scenario") return false;
  // Practice deliberately re-drills known prompts; only a lesson presents a
  // prompt in its intended place in the curriculum.
  if (session.mode !== "lesson") return false;
  return !state.attempts.some((attempt) => attempt.exerciseId === exercise.id);
}

/**
 * The learner's own typical response time on answers they got right. Measured
 * answers only: retries and hinted answers say nothing about fluency.
 */
export function medianCorrectLatencyMs(state: LearnerState): number | undefined {
  const samples = state.attempts
    .filter((attempt) => attempt.correct && !attempt.isRetry && !attempt.hintUsed && attempt.latencyMs > 0)
    .map((attempt) => attempt.latencyMs)
    .sort((a, b) => a - b);
  if (samples.length < WEAK_LATENCY_MIN_SAMPLES) return undefined;
  return samples[Math.floor(samples.length / 2)];
}

/**
 * A correct answer that took so long it is recall with effort, not fluency.
 * It still deserves credit — the learner did get there — but it must not be
 * counted the same as a quick answer, or the mastery ladder measures patience.
 */
export function isSlowAnswer(state: LearnerState, latencyMs: number): boolean {
  const median = medianCorrectLatencyMs(state);
  if (median === undefined) return false;
  return latencyMs > Math.max(median * WEAK_LATENCY_FACTOR, WEAK_LATENCY_FLOOR_MS);
}

/**
 * How much an attempt should move the mastery ladder.
 *
 * - "lapse": wrong, or answered with a hint — the pair is not known.
 * - "weak": right, but slowly — known with effort; keep the rung, review soon.
 * - "strong": right and fluent — advance.
 * - "rehearsal": a *correct* re-answer of a re-queued prompt. The mistake it
 *   corrects is already on record; replaying it must not buy back mastery.
 *
 * A wrong re-answer is still a lapse: failing the same prompt twice is twice
 * the evidence that the pair is not known.
 */
export type EvidenceQuality = "lapse" | "weak" | "strong" | "rehearsal";

export function evidenceQuality(state: LearnerState, attempt: AttemptEvent): EvidenceQuality {
  if (!attempt.correct || attempt.hintUsed) return "lapse";
  if (attempt.isRetry) return "rehearsal";
  return isSlowAnswer(state, attempt.latencyMs) ? "weak" : "strong";
}

/**
 * The mastery transition for one attempt. Exported so upgrade.ts can replay a
 * saved log through the same rules the live path uses — a second copy of this
 * logic would drift, and the upgraded record would not match what the learner
 * would have had.
 */
export function nextMasteryFor(
  previous: MasteryState | undefined,
  attempt: AttemptEvent,
  quality: EvidenceQuality,
  isUnseenScenario = false,
): MasteryState | undefined {
  if (!attempt.confusionPairId) return undefined;
  // A rehearsal changes nothing at all — not even the review date. The clock
  // on this pair was set by the mistake, and re-answering inside the same
  // session must not push it out.
  if (quality === "rehearsal" && previous) return previous;
  const base: MasteryState = previous ?? {
    confusionPairId: attempt.confusionPairId,
    consecutiveCorrect: 0,
    lapses: 0,
    evidenceTypes: [],
    unseenScenarioCorrect: false,
    schedulerVersion: ENGINE_VERSION,
  };

  if (quality === "lapse") {
    return {
      ...base,
      consecutiveCorrect: 0,
      lapses: base.lapses + 1,
      lastReviewedAt: attempt.occurredAt,
      dueAt: addDays(new Date(attempt.occurredAt), 1),
      firstSeenAt: base.firstSeenAt ?? attempt.occurredAt,
    };
  }

  if (quality === "weak") {
    // Keep the rung: effortful recall is not progress, but it is not a lapse
    // either. Bring it back tomorrow rather than on the full interval.
    return {
      ...base,
      lastReviewedAt: attempt.occurredAt,
      dueAt: addDays(new Date(attempt.occurredAt), 1),
      firstSeenAt: base.firstSeenAt ?? attempt.occurredAt,
      schedulerVersion: ENGINE_VERSION,
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
   * This prompt was already answered in this session and is being shown again
   * (the match exercise re-queues itself after a mispair). See AttemptEvent.
   */
  isRetry?: boolean;
  /**
   * Milliseconds the prompt was on screen before answering. 0 when the caller
   * does not track it — the field feeds future adaptive difficulty, so a
   * measured value beats a constant one.
   */
  latencyMs?: number;
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
  // Derived, not trusted from the caller: whether this prompt already has a
  // result in this session is a property of the session, and a caller that
  // forgot to pass isRetry would silently inflate mastery and XP.
  const isRetry = options.isRetry ?? isRequeuedPrompt(session);
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
    ...(isRetry ? { isRetry: true } : {}),
    latencyMs: Math.max(0, options.latencyMs ?? 0),
    occurredAt: now.toISOString(),
  };
  const prior = attempt.confusionPairId ? state.mastery[attempt.confusionPairId] : undefined;
  const quality = evidenceQuality(state, attempt);
  const mastery = nextMasteryFor(prior, attempt, quality, isFirstEncounter(state, exercise, session));
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
  // A lesson pays its completion bonus once. Re-running a finished lesson (or
  // re-finishing one inside a session that already completed) must not mint
  // another +20 — otherwise replaying the same lesson farms XP indefinitely.
  const alreadyDone = isLessonDone(state, course, session.lessonId);
  const completesLesson = finished && session.mode === "lesson" && !failedFinish && !alreadyDone;
  // Flawless means "no mistakes on first contact". A rehearsal is by
  // definition a prompt that was already missed, so it can never be flawless.
  const flawless =
    completesLesson &&
    attempt.correct &&
    session.results.every((result) => result.correct && !result.isRetry);
  const completedLessonIds = completesLesson
    ? Array.from(new Set([...state.completedLessonIds, lessonKey(course, session.lessonId)]))
    : state.completedLessonIds;
  const completedToday = completesLesson && state.lastLessonDate !== localDate(now);
  const streak = completedToday
    ? state.lastLessonDate === previousLocalDate(now)
      ? state.streak + 1
      : 1
    : state.streak;
  // A rehearsal pays nothing: the prompt already paid (or refused) its XP the
  // first time round, and re-answering a re-queue would let a learner farm
  // points by failing the same match twice.
  const paysXp = !attempt.isRetry && attempt.correct;

  return {
    state: {
      ...state,
      xp: state.xp + (paysXp ? 10 : 0) + (completesLesson ? 20 : 0) + (flawless ? 20 : 0),
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
 * Whether the prompt at the session's current index has already been answered
 * in this session. Derived from the attempt log rather than tracked as a flag:
 * requeuePrompt inserts the id ahead of the cursor, so a repeat is exactly a
 * prompt id that already has a result. The caller passes this to applyAnswer
 * as `isRetry`.
 */
export function isRequeuedPrompt(session: SessionState): boolean {
  const current = session.promptIds[session.index];
  if (!current) return false;
  return session.results.some((result) => result.exerciseId === current);
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
 * Terms whose most recent *graded* attempt was wrong — the practice focus set.
 *
 * Rehearsals are ignored on purpose: a match mispair re-queues the prompt and
 * the player usually then gets it right, so counting the replay would drop the
 * term off the review list — the opposite of what the mistake proved. The
 * focus set answers "what did you get wrong", not "what did you finish".
 */
export function recentMissTermIds(state: LearnerState): string[] {
  const latest = new Map<string, boolean>();
  for (const attempt of state.attempts) {
    if (attempt.isRetry) continue;
    for (const conceptId of attempt.conceptIds) latest.set(conceptId, attempt.correct);
  }
  const missed: string[] = [];
  for (const [conceptId, correct] of latest) {
    if (!correct) missed.push(conceptId);
  }
  return missed;
}
