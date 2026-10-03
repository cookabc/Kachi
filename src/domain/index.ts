export type ExerciseType = "meaning" | "truefalse" | "fill" | "scenario" | "match";
export type RiskLevel = "evergreen" | "time-sensitive" | "jurisdictional";
export type ReviewStatus = "legacy" | "draft" | "reviewed";

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
  assessmentOnly?: boolean;
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
  version: 1;
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
