import type { LearnerState } from "@kachi/domain";
import { emptyLearnerState } from "@kachi/learning-engine";

const DATABASE_NAME = "kachi-learning";
const DATABASE_VERSION = 1;
const SNAPSHOT_STORE = "snapshots";
const EVENT_STORE = "events";
const META_STORE = "meta";
const PROFILE_KEY = "local-profile";
const LEGACY_KEY = "hedge-or-pledge-v1";

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
    if (!database.objectStoreNames.contains(EVENT_STORE)) database.createObjectStore(EVENT_STORE, { keyPath: "eventId" });
    if (!database.objectStoreNames.contains(META_STORE)) database.createObjectStore(META_STORE);
  };
  return request(open);
}

function legacyState(): LearnerState | undefined {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return undefined;
    const legacy = JSON.parse(raw) as {
      xp?: number;
      streak?: number;
      lastPlayedDate?: string;
      completedLessonIds?: string[];
      seenTermIds?: string[];
    };
    return {
      ...emptyLearnerState(),
      xp: Number.isFinite(legacy.xp) ? Number(legacy.xp) : 0,
      streak: Number.isFinite(legacy.streak) ? Number(legacy.streak) : 0,
      lastLessonDate: legacy.lastPlayedDate,
      completedLessonIds: Array.isArray(legacy.completedLessonIds) ? legacy.completedLessonIds : [],
      seenConceptIds: Array.isArray(legacy.seenTermIds) ? legacy.seenTermIds : []
    };
  } catch {
    return undefined;
  }
}

export async function loadLearnerState(): Promise<LearnerState> {
  const database = await openDatabase();
  const transaction = database.transaction([SNAPSHOT_STORE, META_STORE], "readwrite");
  const snapshot = await request(transaction.objectStore(SNAPSHOT_STORE).get(PROFILE_KEY)) as LearnerState | undefined;
  if (snapshot) {
    await transactionDone(transaction);
    database.close();
    return snapshot;
  }

  const migrated = legacyState() ?? emptyLearnerState();
  transaction.objectStore(SNAPSHOT_STORE).put(migrated, PROFILE_KEY);
  transaction.objectStore(META_STORE).put({ migratedAt: new Date().toISOString(), source: legacyState() ? LEGACY_KEY : "fresh" }, "migration");
  await transactionDone(transaction);
  database.close();
  return migrated;
}

export async function saveLearnerState(state: LearnerState): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction([SNAPSHOT_STORE, EVENT_STORE], "readwrite");
  transaction.objectStore(SNAPSHOT_STORE).put(state, PROFILE_KEY);
  state.attempts.forEach((event) => transaction.objectStore(EVENT_STORE).put(event));
  await transactionDone(transaction);
  database.close();
}

export async function exportLearnerData(): Promise<Blob> {
  const state = await loadLearnerState();
  return new Blob([
    JSON.stringify({ schemaVersion: 1, exportedAt: new Date().toISOString(), learnerState: state }, null, 2)
  ], { type: "application/json" });
}

// An imported file must carry a complete learner state: a partial one used to
// slip past the version check and crash the next save (state.attempts.forEach).
function isLearnerState(value: unknown): value is LearnerState {
  if (!value || typeof value !== "object") return false;
  const state = value as LearnerState;
  return (
    state.version === 1 &&
    typeof state.xp === "number" &&
    Number.isFinite(state.xp) &&
    typeof state.streak === "number" &&
    Number.isFinite(state.streak) &&
    Array.isArray(state.completedLessonIds) &&
    Array.isArray(state.seenConceptIds) &&
    Array.isArray(state.attempts) &&
    state.mastery !== undefined &&
    typeof state.mastery === "object"
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
