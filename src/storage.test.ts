import { beforeEach, describe, expect, it } from "vitest";
import type { LearnerState } from "./domain";
import { emptyLearnerState } from "./engine";
import {
  exportLearnerData,
  importLearnerData,
  loadLearnerState,
  REJECTED_PROFILE_KEY,
  saveLearnerState,
} from "./storage";

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
      if (this.pending === 0)
        setTimeout(() => {
          if (this.pending === 0) this.oncomplete?.();
        }, 0);
    }
  }
  class FakeStore {
    constructor(
      private name: string,
      private transaction: FakeTransaction,
    ) {}
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
    },
  };
  return {
    seed(store: string, key: string, value: unknown) {
      if (!stores.has(store)) stores.set(store, new Map());
      stores.get(store)!.set(key, value);
    },
    read(store: string, key: string) {
      return stores.get(store)?.get(key);
    },
  };
}

let fakeDatabase: ReturnType<typeof installFakeIndexedDB>;

beforeEach(() => {
  fakeDatabase = installFakeIndexedDB();
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

function sampleMastery() {
  return {
    confusionPairId: "hedge::pledge",
    consecutiveCorrect: 2,
    lapses: 1,
    evidenceTypes: ["meaning", "fill"] as Array<"meaning" | "fill">,
    unseenScenarioCorrect: false,
    firstSeenAt: "2026-08-28T08:00:00.000Z",
    lastReviewedAt: "2026-08-29T08:00:00.000Z",
    dueAt: "2026-09-01T08:00:00.000Z",
    schedulerVersion: "0.1.0",
  };
}

function sampleState(): LearnerState {
  return {
    ...emptyLearnerState(),
    xp: 130,
    streak: 4,
    lastLessonDate: "2026-08-29",
    completedLessonIds: ["hedge-or-pledge/u1l1"],
    seenConceptIds: ["hedge", "pledge"],
    attempts: [
      {
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
        occurredAt: "2026-08-29T08:00:00.000Z",
      },
    ],
  };
}

describe("learner storage", () => {
  it("round-trips a saved learner state through IndexedDB", async () => {
    const state = sampleState();
    await saveLearnerState(state);
    const loaded = await loadLearnerState();
    expect(loaded).toEqual(state);
  });

  it("starts from an empty state", async () => {
    const loaded = await loadLearnerState();
    expect(loaded).toEqual(emptyLearnerState());
    expect(fakeDatabase.read("snapshots", REJECTED_PROFILE_KEY)).toBeUndefined();
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
    await expect(
      importLearnerData(fileOf({ schemaVersion: 2, learnerState: sampleState() })),
    ).rejects.toThrow(/不是兼容/);
    // A file that is not JSON at all fails with the same localized message,
    // not a raw English SyntaxError.
    await expect(
      importLearnerData({ text: async () => "not json at all" } as unknown as File),
    ).rejects.toThrow(/不是兼容/);
  });

  it("rejects learner states whose required collections are missing or malformed", async () => {
    const broken = { schemaVersion: 1, learnerState: { version: 2, xp: 5, streak: "many" } };
    await expect(importLearnerData(fileOf(broken))).rejects.toThrow(/不是兼容/);

    const noAttempts = { schemaVersion: 1, learnerState: { ...emptyLearnerState(), attempts: "log" } };
    await expect(importLearnerData(fileOf(noAttempts))).rejects.toThrow(/不是兼容/);
  });

  it("rejects attempt collections containing malformed events", async () => {
    const partialEvent = {
      schemaVersion: 1,
      learnerState: { ...emptyLearnerState(), attempts: [{ eventId: "x" }] },
    };
    await expect(importLearnerData(fileOf(partialEvent))).rejects.toThrow(/不是兼容/);

    const unknownType = {
      schemaVersion: 1,
      learnerState: {
        ...emptyLearnerState(),
        attempts: [{ ...sampleState().attempts[0], exerciseType: "spelling" }],
      },
    };
    await expect(importLearnerData(fileOf(unknownType))).rejects.toThrow(/不是兼容/);

    const badDate = {
      schemaVersion: 1,
      learnerState: {
        ...emptyLearnerState(),
        attempts: [{ ...sampleState().attempts[0], occurredAt: "yesterday" }],
      },
    };
    await expect(importLearnerData(fileOf(badDate))).rejects.toThrow(/不是兼容/);
  });

  it("rejects mastery maps whose entries are not mastery states", async () => {
    const nullEntry = {
      schemaVersion: 1,
      learnerState: { ...emptyLearnerState(), mastery: { "hedge::pledge": null } },
    };
    await expect(importLearnerData(fileOf(nullEntry))).rejects.toThrow(/不是兼容/);

    const partialEntry = {
      schemaVersion: 1,
      learnerState: {
        ...emptyLearnerState(),
        mastery: { "hedge::pledge": { confusionPairId: "hedge::pledge" } },
      },
    };
    await expect(importLearnerData(fileOf(partialEntry))).rejects.toThrow(/不是兼容/);
  });

  it("rejects invalid collection members and negative or fractional counters", async () => {
    const invalidStates = [
      { ...emptyLearnerState(), completedLessonIds: ["u1l1", 42] },
      { ...emptyLearnerState(), seenConceptIds: [null] },
      { ...emptyLearnerState(), xp: -1 },
      { ...emptyLearnerState(), streak: 1.5 },
      { ...emptyLearnerState(), attempts: [{ ...sampleState().attempts[0], conceptIds: ["hedge", {}] }] },
      { ...emptyLearnerState(), attempts: [{ ...sampleState().attempts[0], latencyMs: -1 }] },
    ];
    for (const learnerState of invalidStates) {
      await expect(importLearnerData(fileOf({ schemaVersion: 1, learnerState }))).rejects.toThrow(/不是兼容/);
    }
  });

  it("accepts records written before the retry flag existed", async () => {
    // Every saved attempt from engine 0.1.0 lacks isRetry. Rejecting them
    // would wipe the learner's history on the first load after the upgrade.
    const legacy = sampleState();
    for (const attempt of legacy.attempts) delete (attempt as { isRetry?: boolean }).isRetry;
    await saveLearnerState(legacy);
    const loaded = await loadLearnerState();
    expect(loaded.attempts).toHaveLength(legacy.attempts.length);
    expect(loaded.attempts[0].isRetry).toBeUndefined();
  });

  it("accepts an explicit retry flag and rejects a non-boolean one", async () => {
    const marked = sampleState();
    marked.attempts[0].isRetry = true;
    await expect(saveLearnerState(marked)).resolves.toBeUndefined();
    await expect(
      importLearnerData(
        fileOf({
          schemaVersion: 1,
          learnerState: {
            ...sampleState(),
            attempts: [{ ...sampleState().attempts[0], isRetry: "yes" }],
          },
        }),
      ),
    ).rejects.toThrow(/不是兼容/);
  });

  it("rejects invalid mastery counters, evidence types, and pair identities", async () => {
    const mastery = sampleMastery();
    const invalidEntries = [
      { key: "hedge::pledge", value: { ...mastery, consecutiveCorrect: 0.5 } },
      { key: "hedge::pledge", value: { ...mastery, consecutiveCorrect: 999 } },
      { key: "hedge::pledge", value: { ...mastery, lapses: -1 } },
      { key: "hedge::pledge", value: { ...mastery, evidenceTypes: ["meaning", "spelling"] } },
      { key: "hedge::pledge", value: { ...mastery, evidenceTypes: ["meaning", "meaning"] } },
      { key: "hedge::pledge", value: { ...mastery, confusionPairId: "call::put" } },
      { key: "pledge::hedge", value: { ...mastery, confusionPairId: "pledge::hedge" } },
      { key: "hedge::hedge", value: { ...mastery, confusionPairId: "hedge::hedge" } },
    ];
    for (const entry of invalidEntries) {
      const learnerState = { ...emptyLearnerState(), mastery: { [entry.key]: entry.value } };
      await expect(importLearnerData(fileOf({ schemaVersion: 1, learnerState }))).rejects.toThrow(/不是兼容/);
    }
    const invalidAttempt = {
      ...emptyLearnerState(),
      attempts: [{ ...sampleState().attempts[0], confusionPairId: "pledge::hedge" }],
    };
    await expect(
      importLearnerData(fileOf({ schemaVersion: 1, learnerState: invalidAttempt })),
    ).rejects.toThrow(/不是兼容/);
  });

  it("accepts a complete canonical mastery entry", async () => {
    const mastery = sampleMastery();
    const learnerState = {
      ...emptyLearnerState(),
      mastery: { [mastery.confusionPairId]: mastery },
    } as LearnerState;
    await expect(importLearnerData(fileOf({ schemaVersion: 1, learnerState }))).resolves.toEqual(
      learnerState,
    );
  });

  it("keeps the original snapshot when an invalid profile is replaced with an empty state", async () => {
    const broken = { ...emptyLearnerState(), attempts: "broken", xp: 77 };
    fakeDatabase.seed("snapshots", "local-profile", broken);

    expect(await loadLearnerState()).toEqual(emptyLearnerState());
    expect(fakeDatabase.read("snapshots", "local-profile")).toEqual(emptyLearnerState());
    expect(fakeDatabase.read("snapshots", REJECTED_PROFILE_KEY)).toEqual(broken);
    expect(fakeDatabase.read("meta", "recovery")).toMatchObject({
      reason: "invalid-snapshot",
      preservedKey: REJECTED_PROFILE_KEY,
    });

    expect(await loadLearnerState()).toEqual(emptyLearnerState());
    expect(fakeDatabase.read("snapshots", REJECTED_PROFILE_KEY)).toEqual(broken);
    expect(fakeDatabase.read("meta", "upgrade")).toBeUndefined();
  });

  it("upgrades a readable v1 snapshot in place and does not park it as rejected", async () => {
    const legacy = { ...sampleState(), version: 1 as const, completedLessonIds: ["u1l1"] };
    fakeDatabase.seed("snapshots", "local-profile", legacy);

    const loaded = await loadLearnerState();
    expect(loaded.version).toBe(2);
    expect(loaded.completedLessonIds).toEqual(["hedge-or-pledge/u1l1"]);
    expect(loaded.xp).toBe(legacy.xp);
    expect(loaded.attempts).toEqual(legacy.attempts);
    expect(fakeDatabase.read("snapshots", "local-profile")).toEqual(loaded);
    expect(fakeDatabase.read("snapshots", REJECTED_PROFILE_KEY)).toBeUndefined();
    expect(fakeDatabase.read("meta", "upgrade")).toMatchObject({ fromVersion: 1, qualifiedLessons: 1 });
    expect(fakeDatabase.read("meta", "recovery")).toBeUndefined();

    expect(await loadLearnerState()).toEqual(loaded);
    expect(fakeDatabase.read("snapshots", REJECTED_PROFILE_KEY)).toBeUndefined();
  });
});
