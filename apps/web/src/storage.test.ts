import { beforeEach, describe, expect, it } from "vitest";
import type { LearnerState } from "@kachi/domain";
import { emptyLearnerState } from "@kachi/learning-engine";
import { exportLearnerData, importLearnerData, loadLearnerState, saveLearnerState } from "./storage";

/* A minimal in-memory IndexedDB that satisfies exactly what storage.ts uses:
   open+upgrade with three stores, get/put requests, and a transaction that
   completes only after every request on it has settled. */
function installFakeIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();
  class FakeRequest {
    result: unknown;
    error: unknown = null;
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  class FakeTransaction {
    oncomplete: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    pending = 0;
    objectStore(name: string) {
      return new FakeStore(name, this);
    }
    settle() {
      this.pending -= 1;
      if (this.pending === 0) setTimeout(() => this.oncomplete?.(), 0);
    }
  }
  class FakeStore {
    constructor(private name: string, private transaction: FakeTransaction) {}
    private map() {
      if (!stores.has(this.name)) stores.set(this.name, new Map());
      return stores.get(this.name)!;
    }
    get(key: string) {
      const request = new FakeRequest();
      this.transaction.pending += 1;
      setTimeout(() => {
        request.result = this.map().get(key);
        request.onsuccess?.();
        this.transaction.settle();
      }, 0);
      return request;
    }
    put(value: unknown, key?: string) {
      const request = new FakeRequest();
      this.transaction.pending += 1;
      setTimeout(() => {
        const record = value as Record<string, unknown>;
        this.map().set(key ?? String(record.eventId), value);
        request.onsuccess?.();
        this.transaction.settle();
      }, 0);
      return request;
    }
  }
  class FakeDatabase {
    objectStoreNames = { contains: (name: string) => ["snapshots", "events", "meta"].includes(name) };
    createObjectStore(name: string) {
      stores.set(name, new Map());
    }
    transaction() {
      return new FakeTransaction();
    }
    close() {}
  }
  class FakeOpenRequest {
    result: FakeDatabase | null = null;
    onupgradeneeded: ((event: { target: { result: FakeDatabase } }) => void) | null = null;
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  (global as { indexedDB?: unknown }).indexedDB = {
    open() {
      const request = new FakeOpenRequest();
      setTimeout(() => {
        const database = new FakeDatabase();
        request.result = database;
        request.onupgradeneeded?.({ target: { result: database } });
        request.onsuccess?.();
      }, 0);
      return request;
    }
  };
}

const LEGACY_KEY = "hedge-or-pledge-v1";

beforeEach(() => {
  localStorage.clear();
  installFakeIndexedDB();
});

function fileOf(payload: unknown): File {
  // jsdom's File lacks Blob.text(); storage.ts only needs text()
  return { text: async () => JSON.stringify(payload) } as unknown as File;
}

// jsdom's Blob lacks Blob.text() too, so read through FileReader.
function blobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(blob);
  });
}

function sampleState(): LearnerState {
  return {
    ...emptyLearnerState(),
    xp: 130,
    streak: 4,
    lastLessonDate: "2026-08-29",
    completedLessonIds: ["u1l1"],
    seenConceptIds: ["hedge", "pledge"],
    attempts: [{
      eventId: "event-1",
      deviceId: "device",
      contentVersion: "1",
      engineVersion: "0.1.0",
      exerciseId: "u1l1a",
      conceptIds: ["hedge"],
      exerciseType: "meaning",
      answer: "Insurance on a bet you already have.",
      correct: true,
      hintUsed: false,
      latencyMs: 0,
      occurredAt: "2026-08-29T08:00:00.000Z"
    }]
  };
}

describe("learner storage", () => {
  it("round-trips a saved learner state through IndexedDB", async () => {
    const state = sampleState();
    await saveLearnerState(state);
    const loaded = await loadLearnerState();
    expect(loaded).toEqual(state);
  });

  it("migrates legacy localStorage progress on first load", async () => {
    localStorage.setItem(LEGACY_KEY, JSON.stringify({
      xp: 40,
      streak: 2,
      lastPlayedDate: "2026-08-01",
      completedLessonIds: ["u1l1", "u1l2"],
      seenTermIds: ["hedge"]
    }));
    const loaded = await loadLearnerState();
    expect(loaded.xp).toBe(40);
    expect(loaded.streak).toBe(2);
    expect(loaded.lastLessonDate).toBe("2026-08-01");
    expect(loaded.completedLessonIds).toEqual(["u1l1", "u1l2"]);
    expect(loaded.seenConceptIds).toEqual(["hedge"]);
  });

  it("starts from an empty state without legacy data", async () => {
    const loaded = await loadLearnerState();
    expect(loaded).toEqual(emptyLearnerState());
  });

  it("exports a portable envelope around the learner state", async () => {
    const state = sampleState();
    await saveLearnerState(state);
    const parsed = JSON.parse(await blobText(await exportLearnerData()));
    expect(parsed.schemaVersion).toBe(1);
    expect(typeof parsed.exportedAt).toBe("string");
    expect(parsed.learnerState).toEqual(state);
  });

  it("re-imports an exported envelope", async () => {
    const state = sampleState();
    const envelope = { schemaVersion: 1, exportedAt: "2026-08-29T08:00:00.000Z", learnerState: state };
    const imported = await importLearnerData(fileOf(envelope));
    expect(imported).toEqual(state);
    expect(await loadLearnerState()).toEqual(state);
  });

  it("rejects envelopes that are not Kachi learning data", async () => {
    await expect(importLearnerData(fileOf({ hello: "world" }))).rejects.toThrow(/不是兼容/);
    await expect(importLearnerData(fileOf({ schemaVersion: 2, learnerState: sampleState() }))).rejects.toThrow(/不是兼容/);
  });

  it("rejects learner states whose required collections are missing or malformed", async () => {
    const broken = { schemaVersion: 1, learnerState: { version: 1, xp: 5, streak: "many" } };
    await expect(importLearnerData(fileOf(broken))).rejects.toThrow(/不是兼容/);

    const noAttempts = { schemaVersion: 1, learnerState: { ...emptyLearnerState(), attempts: "log" } };
    await expect(importLearnerData(fileOf(noAttempts))).rejects.toThrow(/不是兼容/);
  });
});
