import type { AttemptEvent, ExerciseType, LearnerState, MasteryState } from "./domain";
import { emptyLearnerState, REVIEW_INTERVAL_DAYS } from "./engine";

const DATABASE_NAME = "kachi-learning";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const EVENT_STORE = "events";
const META_STORE = "meta";
const PROFILE_KEY = "local-profile";

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    value.onsuccess = () => resolve(value.result);
    value.onerror = () => reject(value.error);
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const open = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  open.onupgradeneeded = () => {
    const database = open.result;
    if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) database.createObjectStore(SNAPSHOT_STORE);
    if (!database.objectStoreNames.contains(EVENT_STORE))
      database.createObjectStore(EVENT_STORE, { keyPath: "eventId" });
    if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE);
  };
  return request(open);
}

export async function loadLearnerState(): Promise<LearnerState> {
  const database = await openDatabase();
  const transaction = database.transaction([SNAPSHOT_STORE, META_STORE], "readwrite");
  const snapshot = (await request(transaction.objectStore(SNAPSHOT_STORE).get(PROFILE_KEY))) as unknown;
  if (isLearnerState(snapshot)) {
    await transactionDone(transaction);
    database.close();
    return snapshot;
  }

  const recovered = emptyLearnerState();
  transaction.objectStore(SNAPSHOT_STORE).put(recovered, PROFILE_KEY);
  transaction.objectStore(META_STORE).put(
    snapshot === undefined
      ? { migratedAt: new Date().toISOString(), source: "fresh" }
      : {
          recoveredAt: new Date().toISOString(),
          source: "fresh",
          reason: "invalid-snapshot",
        },
    snapshot === undefined ? "migration" : "recovery",
  );
  await transactionDone(transaction);
  database.close();
  return recovered;
}

export async function saveLearnerState(state: LearnerState): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([SNAPSHOT_STORE, EVENT_STORE], "readwrite");
  transaction.objectStore(SNAPSHOT_STORE).put(state, PROFILE_KEY);
  state.attempts.forEach((event) => {
    transaction.objectStore(EVENT_STORE).put(event);
  });
  await transactionDone(transaction);
  database.close();
}

export async function exportLearnerData(): Promise<Blob> {
  const state = await loadLearnerState();
  return new Blob(
    [
      JSON.stringify(
        { schemaVersion: 1, exportedAt: new Date().toISOString(), learnerState: state },
        null,
        2,
      ),
    ],
    { type: "application/json" },
  );
}

// An imported file is untrusted: it must carry a complete learner state. The
// top-level check alone used to let malformed nested objects through, which
// crashed the next save (state.attempts.forEach) or a render that reads
// attempts/mastery (recentMissTermIds). Every field the engine touches is
// validated before any IndexedDB transaction starts.
const EXERCISE_TYPES: ReadonlySet<string> = new Set(["meaning", "truefalse", "fill", "scenario", "match"]);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isExerciseType(value: unknown): value is ExerciseType {
  return typeof value === "string" && EXERCISE_TYPES.has(value);
}

function isCanonicalPairId(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const parts = value.split("::");
  return parts.length === 2 && parts[0].length > 0 && parts[0] < parts[1];
}

function isDateString(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isAttemptEvent(value: unknown): value is AttemptEvent {
  if (!value || typeof value !== "object") return false;
  const event = value as AttemptEvent;
  return (
    typeof event.eventId === "string" &&
    event.eventId.length > 0 &&
    typeof event.deviceId === "string" &&
    typeof event.contentVersion === "string" &&
    typeof event.engineVersion === "string" &&
    typeof event.exerciseId === "string" &&
    isStringArray(event.conceptIds) &&
    (event.confusionPairId === undefined || isCanonicalPairId(event.confusionPairId)) &&
    isExerciseType(event.exerciseType) &&
    typeof event.answer === "string" &&
    typeof event.correct === "boolean" &&
    typeof event.hintUsed === "boolean" &&
    isNonNegativeInteger(event.latencyMs) &&
    isDateString(event.occurredAt)
  );
}

function isMasteryState(value: unknown): value is MasteryState {
  if (!value || typeof value !== "object") return false;
  const item = value as MasteryState;
  return (
    isCanonicalPairId(item.confusionPairId) &&
    isNonNegativeInteger(item.consecutiveCorrect) &&
    item.consecutiveCorrect <= REVIEW_INTERVAL_DAYS.length &&
    isNonNegativeInteger(item.lapses) &&
    Array.isArray(item.evidenceTypes) &&
    item.evidenceTypes.every(isExerciseType) &&
    new Set(item.evidenceTypes).size === item.evidenceTypes.length &&
    typeof item.unseenScenarioCorrect === "boolean" &&
    (item.firstSeenAt === undefined || isDateString(item.firstSeenAt)) &&
    (item.lastReviewedAt === undefined || isDateString(item.lastReviewedAt)) &&
    (item.dueAt === undefined || isDateString(item.dueAt)) &&
    typeof item.schedulerVersion === "string"
  );
}

function isLearnerState(value: unknown): value is LearnerState {
  if (!value || typeof value !== "object") return false;
  const state = value as LearnerState;
  return (
    state.version === 1 &&
    isNonNegativeInteger(state.xp) &&
    isNonNegativeInteger(state.streak) &&
    (state.lastLessonDate === undefined || typeof state.lastLessonDate === "string") &&
    isStringArray(state.completedLessonIds) &&
    isStringArray(state.seenConceptIds) &&
    Array.isArray(state.attempts) &&
    state.attempts.every(isAttemptEvent) &&
    typeof state.mastery === "object" &&
    state.mastery !== null &&
    !Array.isArray(state.mastery) &&
    Object.entries(state.mastery).every(
      ([key, item]) => isCanonicalPairId(key) && isMasteryState(item) && item.confusionPairId === key,
    )
  );
}

export async function importLearnerData(file: File): Promise<LearnerState> {
  const parsed = JSON.parse(await file.text()) as { schemaVersion?: number; learnerState?: LearnerState };
  if (parsed.schemaVersion !== 1 || !isLearnerState(parsed.learnerState)) {
    throw new Error("这不是兼容的 Kachi 学习数据文件。");
  }
  await saveLearnerState(parsed.learnerState);
  return parsed.learnerState;
}
