import type { AttemptEvent, LearnerState, MasteryState } from "./domain";
import { evidenceQuality, LEGACY_PACK_ID, nextMasteryFor } from "./engine";

/**
 * One-shot upgrade of saved learner records to the current shape.
 *
 * Three old shapes exist in the wild, all from before the current rules:
 *
 * 1. Bare lesson ids (`"u1l1"`) instead of pack-qualified keys (`"hedge-or-pledge/u1l1"`),
 *    written before the app had more than one pack.
 * 2. Attempts without `isRetry`, written before retries were excluded from evidence.
 * 3. Mastery inflated by those retries, because the old scheduler counted a
 *    re-queued match replay as fresh evidence.
 *
 * Rather than leave a compatibility branch in every reader (`isLessonDone`,
 * the state validator, the scheduler), the upgrade folds all three into the
 * current shape once, at load. After it runs, the rest of the code has exactly
 * one shape to handle and no legacy fallbacks.
 *
 * The attempt log identifies retries exactly: `requeuePrompt` is only called
 * for a *wrong match* prompt and inserts the id at the session cursor, so a
 * prompt logged twice in a row with a wrong match first is a rehearsal by
 * construction.
 */

export const STATE_VERSION = 2;

/** The shape any pre-v2 record arrives in. */
export interface StoredLearnerState {
  version: 1 | 2;
  xp: number;
  streak: number;
  lastLessonDate?: string;
  completedLessonIds: string[];
  seenConceptIds: string[];
  mastery: Record<string, MasteryState>;
  attempts: AttemptEvent[];
}

export interface UpgradeReport {
  /** True when the record was rewritten (any shape differed). */
  changed: boolean;
  /** Bare lesson ids that were qualified with their pack. */
  qualifiedLessons: number;
  /** Attempts recognised as rehearsals and excluded from the replay. */
  retries: number;
  /** Pairs whose mastery ladder went down (the sign the old engine inflated it). */
  loweredPairs: string[];
  state: LearnerState;
}

/**
 * Indices of attempts that were rehearsals. Exported for the tests that pin
 * the inference rule.
 */
export function inferredRetryIndices(attempts: AttemptEvent[]): number[] {
  const retries: number[] = [];
  for (let i = 1; i < attempts.length; i += 1) {
    const previous = attempts[i - 1];
    const current = attempts[i];
    if (current.exerciseId !== previous.exerciseId) continue;
    if (previous.correct || previous.exerciseType !== "match") continue;
    retries.push(i);
  }
  return retries;
}

/** Qualify a bare lesson id. Only the legacy pack ever wrote bare ids. */
function qualified(key: string): string {
  return key.includes("/") ? key : `${LEGACY_PACK_ID}/${key}`;
}

export function upgradeLearnerState(stored: StoredLearnerState): UpgradeReport {
  const attempts = stored.attempts;
  const retryIdx = new Set(inferredRetryIndices(attempts));

  // 1. Lesson keys.
  const completedLessonIds = stored.completedLessonIds.map(qualified);
  const qualifiedLessons = completedLessonIds.filter((key, i) => key !== stored.completedLessonIds[i]).length;

  // 2. Retry flags: set explicitly so nothing downstream has to infer again.
  //    Only attempts that are not already marked count as a change — a record
  //    written by the current engine has the flags and needs nothing here.
  let newlyMarked = 0;
  const upgradedAttempts = attempts.map((attempt, index) => {
    if (!retryIdx.has(index) || attempt.isRetry) return attempt;
    newlyMarked += 1;
    return { ...attempt, isRetry: true };
  });

  // 3. Mastery, replayed through the current scheduler with retries excluded.
  let mastery: Record<string, MasteryState> = {};
  const replayed = retryIdx.size > 0;
  if (replayed) {
    upgradedAttempts.forEach((attempt, index) => {
      if (attempt.isRetry) return;
      const prior = attempt.confusionPairId ? mastery[attempt.confusionPairId] : undefined;
      // The latency median is what the learner had at that point, so the
      // running slice is the honest input for "was this answer slow".
      const running: LearnerState = {
        ...stored,
        version: STATE_VERSION,
        mastery,
        attempts: upgradedAttempts.slice(0, index),
      };
      const quality = evidenceQuality(running, attempt);
      const next = nextMasteryFor(prior, attempt, quality);
      if (next) mastery = { ...mastery, [next.confusionPairId]: next };
    });
  } else {
    mastery = stored.mastery;
  }

  // Only a real difference counts. Replaying a log that already excluded its
  // retries reproduces the same record, and rewriting it every load would be
  // a write for nothing.
  const masteryDiffers = replayed && !sameMastery(mastery, stored.mastery);
  const loweredPairs = Object.keys(mastery).filter(
    (key) => (mastery[key]?.consecutiveCorrect ?? 0) < (stored.mastery[key]?.consecutiveCorrect ?? 0),
  );

  const state: LearnerState = {
    version: STATE_VERSION,
    xp: stored.xp,
    streak: stored.streak,
    lastLessonDate: stored.lastLessonDate,
    completedLessonIds: Array.from(new Set(completedLessonIds)),
    seenConceptIds: stored.seenConceptIds,
    mastery: masteryDiffers ? mastery : stored.mastery,
    attempts: upgradedAttempts,
  };

  const changed =
    stored.version !== STATE_VERSION || qualifiedLessons > 0 || newlyMarked > 0 || masteryDiffers;

  return { changed, qualifiedLessons, retries: retryIdx.size, loweredPairs, state };
}

/** Structural equality for the mastery map, field by field and order-free. */
function sameMastery(a: Record<string, MasteryState>, b: Record<string, MasteryState>): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const key of keys) {
    const left = a[key];
    const right = b[key];
    if (!left || !right) return false;
    const fields = new Set([
      ...(Object.keys(left) as (keyof MasteryState)[]),
      ...(Object.keys(right) as (keyof MasteryState)[]),
    ]);
    for (const field of fields) {
      if (JSON.stringify(left[field]) !== JSON.stringify(right[field])) return false;
    }
  }
  return true;
}
