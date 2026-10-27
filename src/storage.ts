import type { AttemptEvent, ExerciseType, LearnerState, MasteryState } from "./domain";
import { emptyLearnerState, REVIEW_INTERVAL_DAYS } from "./engine";
import { STATE_VERSION, type StoredLearnerState, upgradeLearnerState } from "./upgrade";

const DATABASE_NAME = "kachi-learning";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const EVENT_STORE = "events";
const META_STORE = "meta";
const PROFILE_KEY = "local-profile";
/** Thrown when an imported file is not a learner record this app can read. */
export const INCOMPATIBLE_LEARNER_FILE = "incompatible-learner-file";
/** Invalid live snapshots are moved here instead of being discarded. */
export const REJECTED_PROFILE_KEY = "local-profile-rejected";

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

// One connection per IndexedDB factory, reused across loads and saves — a
// fresh open per answer made every write pay connection setup. Keyed on the
// factory so test fakes (which replace indexedDB wholesale) get their own
// connection, and dropped on versionchange so a future upgrade never blocks
// behind a cached handle.
let cachedConnection: { factory: IDBFactory; database: Promise<IDBDatabase> } | undefined;

function openDatabase(): Promise<IDBDatabase> {
  const factory = indexedDB;
  if (cachedConnection?.factory === factory) return cachedConnection.database;
  const open = factory.open(DATABASE_NAME, DATABASE_VERSION);
  open.onupgradeneeded = () => {
    const database = open.result;
    if (!database.objectStoreNames.contains(SNAPSHOT_STORE)) database.createObjectStore(SNAPSHOT_STORE);
    if (!database.objectStoreNames.contains(EVENT_STORE))
      database.createObjectStore(EVENT_STORE, { keyPath: "eventId" });
    if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE);
  };
  const database = request(open).then((db) => {
    db.onversionchange = () => {
      db.close();
      if (cachedConnection?.factory === factory) cachedConnection = undefined;
    };
    return db;
  });
  cachedConnection = { factory, database };
  void database.catch(() => {
    if (cachedConnection?.factory === factory) cachedConnection = undefined;
  });
  return database;
}

export async function loadLearnerState(): Promise<LearnerState> {
  const database = await openDatabase();
  const transaction = database.transaction([SNAPSHOT_STORE, META_STORE], "readwrite");
  const snapshot = (await request(transaction.objectStore(SNAPSHOT_STORE).get(PROFILE_KEY))) as unknown;
  if (isStoredState(snapshot)) {
    // A readable record is migrated in place. It is not a rejected snapshot:
    // parking it under the backup key would hide a successful upgrade.
    const report = upgradeLearnerState(snapshot);
    if (report.changed) {
      transaction.objectStore(SNAPSHOT_STORE).put(report.state, PROFILE_KEY);
      transaction.objectStore(META_STORE).put(
        {
          upgradedAt: new Date().toISOString(),
          fromVersion: snapshot.version,
          qualifiedLessons: report.qualifiedLessons,
          retries: report.retries,
          loweredPairs: report.loweredPairs,
        },
        "upgrade",
      );
      await transactionDone(transaction);
      return report.state;
    }
    await transactionDone(transaction);
    return report.state;
  }

  const recovered = emptyLearnerState();
  // The rejected value is the only copy of progress we could not read. Keep it
  // before the live profile is replaced, in the same transaction, so a failed
  // write rolls both back and the original snapshot stays put.
  if (snapshot !== undefined) {
    transaction.objectStore(SNAPSHOT_STORE).put(snapshot, REJECTED_PROFILE_KEY);
  }
  transaction.objectStore(SNAPSHOT_STORE).put(recovered, PROFILE_KEY);
  transaction.objectStore(META_STORE).put(
    snapshot === undefined
      ? { createdAt: new Date().toISOString(), source: "fresh" }
      : {
          recoveredAt: new Date().toISOString(),
          source: "fresh",
          reason: "invalid-snapshot",
          preservedKey: REJECTED_PROFILE_KEY,
        },
    snapshot === undefined ? "migration" : "recovery",
  );
  await transactionDone(transaction);
  return recovered;
}

// Attempt events are immutable once recorded, so the event store only ever
// needs the ones not yet written: one put per answer rather than one per
// attempt in the whole learning history.
const writtenEventIds = new Set<string>();

export async function saveLearnerState(state: LearnerState): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([SNAPSHOT_STORE, EVENT_STORE], "readwrite");
  transaction.objectStore(SNAPSHOT_STORE).put(state, PROFILE_KEY);
  const fresh = state.attempts.filter((event) => !writtenEventIds.has(event.eventId));
  fresh.forEach((event) => {
    transaction.objectStore(EVENT_STORE).put(event);
  });
  await transactionDone(transaction);
  for (const event of fresh) writtenEventIds.add(event.eventId);
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

// An imported file is untrusted: it must carry a complete learner state.
// Every field the engine touches is validated before any IndexedDB
// transaction starts.
const EXERCISE_TYPES: ReadonlySet<string> = new Set([
  "meaning",
  "truefalse",
  "fill",
  "scenario",
  "match",
  "headline",
]);

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
    (event.isRetry === undefined || typeof event.isRetry === "boolean") &&
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

// Accepts every version this app has written. Upgrading happens once, right
// after the check, so no reader downstream needs to know an older shape.
function isStoredState(value: unknown): value is StoredLearnerState {
  if (!value || typeof value !== "object") return false;
  const state = value as StoredLearnerState;
  return (
    (state.version === 1 || state.version === STATE_VERSION) &&
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
  // A broken file and a wrong envelope are the same problem to the user, so
  // both get one message.
  let parsed: unknown;
  try {
    parsed = JSON.parse(await file.text());
  } catch {
    throw new Error(INCOMPATIBLE_LEARNER_FILE);
  }
  const envelope = parsed as { schemaVersion?: unknown; learnerState?: unknown };
  if (envelope.schemaVersion !== 1 || !isStoredState(envelope.learnerState)) {
    throw new Error(INCOMPATIBLE_LEARNER_FILE);
  }
  const upgraded = upgradeLearnerState(envelope.learnerState).state;
  await saveLearnerState(upgraded);
  return upgraded;
}
