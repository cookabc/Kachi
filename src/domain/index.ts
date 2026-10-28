/**
 * `headline` is the reading task: a real-syntax headline with a blank, and the
 * two confusable terms as options. It tests the product's whole claim — telling
 * the pair apart inside a sentence — rather than what a term means in isolation.
 *
 * `audit` is the sceptic's task: a short claim about a backtest, and several
 * statements about it, exactly one of which is unsound. Every other exercise
 * type asks "do you know this word"; audit asks "would you have caught the
 * mistake". It is the only type that can teach the habit the product is for —
 * reading a number and asking what it is hiding.
 *
 * `listen` is the ear task: the term is spoken, the options are terms. It is
 * the one exercise the product could not offer at all before synthesis — and
 * the reason audio exists. The word is never shown as text in the stem; the
 * ear has to do the work.
 */
// "listen" is the ear task: the term is spoken, the options are terms. It is
// the one exercise the product could not offer at all before synthesis — and
// the reason audio exists. The word is never shown as text in the stem; the
// ear does the work.
export type ExerciseType =
  | "meaning"
  | "truefalse"
  | "fill"
  | "scenario"
  | "match"
  | "headline"
  | "audit"
  | "listen";
export type RiskLevel = "evergreen" | "time-sensitive" | "jurisdictional";
export type ReviewStatus = "legacy" | "draft" | "reviewed";

/**
 * Why the canonical mix-up pair confuses. The taxonomy is the authoring gate
 * in the pack source (if you cannot name why two terms mix, the pair is
 * wrong); the teach card surfaces it so learners build the same schema.
 */
export type MixUpType = "opposite" | "coexist" | "hierarchy" | "form" | "timing";

export interface SourceReference {
  id: string;
  title: string;
  publisher?: string;
  url?: string;
  publishedAt?: string;
  accessedAt?: string;
  kind: "primary" | "academic" | "news" | "internal";
  rightsBasis: "facts-only" | "licensed" | "permission" | "quotation-exception" | "internal";
}

export interface LocalizedTerm {
  termZh: string;
  definitionZh: string;
  mixUpWhyZh: string;
}

/**
 * An edge in the concept graph beyond the canonical mixUp pair. Semantics:
 * - "confusable": learners really mix these two up (the mixUp edge is the
 *   curriculum's headline pair; extra confusable edges are secondary traps).
 * - "prereq": the target term should be learned first — this concept leans on it.
 * - "sibling": same family (put/call/option, futures/swap) without being a trap.
 * Edges are undirected in the graph view even when declared on one side only.
 */
export type RelationType = "confusable" | "prereq" | "sibling";

export interface ConceptRelation {
  type: RelationType;
  with: string;
}

export interface Concept {
  id: string;
  unit: number;
  term: string;
  caption: string;
  definition: string;
  example: string;
  mixUp: string;
  mixUpWhy: string;
  mixUpType?: MixUpType;
  /** The term's Chinese name, when the pack's zh-CN data carries it natively
   *  (generated packs do; the hand-written legacy pack keeps its glosses in
   *  src/localization.ts and this field stays unset). */
  termZh?: string;
  relations?: ConceptRelation[];
  sourceIds: string[];
  risk: RiskLevel;
  jurisdiction?: string;
  asOf?: string;
  reviewDue?: string;
  reviewStatus: ReviewStatus;
}

export interface Option {
  text: string;
  art?: string;
}

export interface MatchPair {
  id: string;
  left: string;
  right: string;
}

export interface Exercise {
  id: string;
  type: ExerciseType;
  termId?: string;
  termIds: string[];
  stem?: string;
  story?: string;
  options?: Option[];
  answer?: number | string | boolean;
  bank?: string[];
  pairs?: MatchPair[];
  why: string;
}

export interface Lesson {
  id: string;
  unit: number;
  title: string;
  icon: string;
  review: boolean;
  prompts: Exercise[];
}

export interface Unit {
  id: number;
  title: string;
  blurb: string;
}

export interface Course {
  schemaVersion: number;
  packId: string;
  contentVersion: string;
  locale: string;
  generatedAt: string;
  units: Unit[];
  concepts: Concept[];
  lessons: Lesson[];
  sources: SourceReference[];
}

export interface ContentPackManifest {
  schemaVersion: number;
  packId: string;
  contentVersion: string;
  locale: string;
  minEngineVersion: string;
  generatedAt: string;
  entry: string;
  sha256: string;
  assets: Array<{ path: string; sha256: string }>;
}

export interface AttemptEvent {
  eventId: string;
  deviceId: string;
  contentVersion: string;
  engineVersion: string;
  exerciseId: string;
  conceptIds: string[];
  confusionPairId?: string;
  exerciseType: ExerciseType;
  answer: string;
  correct: boolean;
  hintUsed: boolean;
  /**
   * True when this prompt had already been answered earlier in the same
   * session (a match mispair re-queues itself). A retry is a rehearsal, not
   * new evidence: it pays no XP, does not move the mastery ladder, and stays
   * out of the accuracy denominator. Always present on records the current
   * engine writes; upgrade.ts sets it on older ones.
   */
  isRetry?: boolean;
  latencyMs: number;
  occurredAt: string;
}

export interface MasteryState {
  confusionPairId: string;
  consecutiveCorrect: number;
  lapses: number;
  evidenceTypes: ExerciseType[];
  unseenScenarioCorrect: boolean;
  firstSeenAt?: string;
  lastReviewedAt?: string;
  dueAt?: string;
  schedulerVersion: string;
}

export interface LearnerState {
  /** Bumped by upgrade.ts whenever the saved shape changes. */
  version: 2;
  xp: number;
  streak: number;
  lastLessonDate?: string;
  completedLessonIds: string[];
  seenConceptIds: string[];
  mastery: Record<string, MasteryState>;
  attempts: AttemptEvent[];
}

export interface SessionState {
  lessonId: string;
  mode: "lesson" | "practice";
  promptIds: string[];
  index: number;
  results: AttemptEvent[];
  startedAt: string;
  /**
   * Exercise ids that already earned their one-time correct-answer XP before
   * this session. The completion summary reads the snapshot so a payment made
   * earlier is not shown again as if this run had earned it.
   */
  priorPaidExerciseIds?: string[];
  /** This session itself earned the one-time lesson completion bonus. */
  awardedCompletion?: boolean;
  /** This session itself earned the one-time flawless bonus. */
  awardedPerfect?: boolean;
}

export interface Environment {
  now: () => Date;
  random: () => number;
  deviceId: string;
  eventId: () => string;
}

export type LearningEvent = AttemptEvent;

export interface LearnerProjection {
  state: LearnerState;
}
