import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Lang } from "./course";
import { courseFor, DEFAULT_PACK } from "./course";
import { loadLang } from "./ui";

const { loadCourseMock } = vi.hoisted(() => ({
  loadCourseMock: vi.fn<(packId: string, lang: Lang) => Promise<unknown>>(),
}));

vi.mock("./course", async () => {
  const actual = await vi.importActual<typeof import("./course")>("./course");
  return {
    ...actual,
    loadCourse: (packId: string, lang: Lang) => loadCourseMock(packId, lang),
  };
});

let failSnapshotPutsAfter = Number.POSITIVE_INFINITY;

function installMemoryIndexedDB() {
  const stores = new Map<string, Map<string, unknown>>();
  let snapshotPuts = 0;
  class FakeRequest {
    result: unknown;
    error: unknown = null;
    onsuccess: (() => void) | null = null;
    onerror: (() => void) | null = null;
  }
  class FakeTransaction {
    error: unknown = null;
    oncomplete: (() => void) | null = null;
    onerror: (() => void) | null = null;
    onabort: (() => void) | null = null;
    pending = 0;
    objectStore(name: string) {
      return new FakeStore(name, this);
    }
    settle() {
      this.pending -= 1;
      if (this.pending === 0) {
        setTimeout(() => {
          if (this.pending === 0) this.oncomplete?.();
        }, 0);
      }
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
        if (this.name === "snapshots") snapshotPuts += 1;
        if (this.name === "snapshots" && snapshotPuts > failSnapshotPutsAfter) {
          const error = new Error("quota");
          request.error = error;
          this.transaction.error = error;
          request.onerror?.();
          this.transaction.onerror?.();
          return;
        }
        const record = value as Record<string, unknown>;
        this.map().set(key ?? String(record.eventId), value);
        request.onsuccess?.();
        this.transaction.settle();
      }, 0);
      return request;
    }
  }
  class FakeDatabase {
    objectStoreNames = {
      contains: (name: string) => ["snapshots", "events", "meta"].includes(name),
    };
    onversionchange: (() => void) | null = null;
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
  vi.stubGlobal("indexedDB", {
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
  });
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderApp() {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<App />);
  });
}

// Boot is done once the home tagline is on screen. The signal is the English
// string because English is the default language now.
async function waitForHome() {
  const started = Date.now();
  while (!document.body.textContent?.includes("Tell the mix-ups apart")) {
    if (Date.now() - started > 2000) {
      throw new Error(`still booting: ${document.body.textContent}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

beforeEach(async () => {
  vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
  localStorage.clear();
  failSnapshotPutsAfter = Number.POSITIVE_INFINITY;
  installMemoryIndexedDB();
  const actual = await vi.importActual<typeof import("./course")>("./course");
  loadCourseMock.mockImplementation((packId, lang) => actual.loadCourse(packId, lang));
});

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
  localStorage.clear();
  vi.unstubAllGlobals();
});

describe("startup failures", () => {
  it("leaves the loading screen when IndexedDB cannot be opened", async () => {
    vi.stubGlobal("indexedDB", {
      open() {
        throw new Error("idb-blocked");
      },
    });
    await renderApp();
    await waitForHome();
    expect(document.querySelector(".loading")).toBeNull();
    expect(document.querySelector("[role='alert']")?.textContent).toContain("can't read saved progress");
  });

  it("shows the storage alert and logs when a save fails", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    // The boot transaction writes the fresh profile. The next snapshot write
    // is the save effect, and that one fails.
    failSnapshotPutsAfter = 1;
    installMemoryIndexedDB();
    await renderApp();
    await waitForHome();
    const started = Date.now();
    while (!document.querySelector("[role='alert']")) {
      if (Date.now() - started > 2000) {
        throw new Error(`save failure was not surfaced: ${document.body.textContent}`);
      }
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
      });
    }
    expect(document.querySelector("[role='alert']")?.textContent).toContain("can't read saved progress");
    expect(errorSpy).toHaveBeenCalledWith("Failed to save learning progress", expect.any(Error));
    errorSpy.mockRestore();
  });

  it("boots the default pack offline, in the restored language", async () => {
    // Both locales of the default pack ship in the main bundle, so `courseFor`
    // answers for either one with no fetch. That is what lets the first screen
    // render offline whatever language was restored.
    expect(courseFor(DEFAULT_PACK, "en-US")).toBeDefined();
    expect(courseFor(DEFAULT_PACK, "zh-CN")).toBeDefined();

    localStorage.setItem("kachi-lang", "en-US");
    await renderApp();
    await waitForHome();
    expect(document.querySelector(".loading")).toBeNull();
    expect(loadLang()).toBe("en-US");
  });
});

it("keeps the current pack and language after a failed switch, then retries the same request", async () => {
  await renderApp();
  await waitForHome();
  const settings = document.querySelector<HTMLButtonElement>('.nav button[aria-label="Settings"]');
  expect(settings).not.toBeNull();
  await act(async () => {
    settings!.click();
    await import("./screens/Settings");
  });
  const firstPack = document.querySelector<HTMLButtonElement>(".pack-choice");
  expect(firstPack).not.toBeNull();
  loadCourseMock.mockRejectedValueOnce(new Error("offline"));
  await act(async () => firstPack!.click());
  expect(document.querySelector('[role="alert"]')?.textContent).toContain(
    "current course and progress are kept",
  );
  expect(loadLang()).toBe("en-US");
  expect(document.querySelector('.pack-choice[aria-pressed="true"]')?.textContent).toContain(
    "Borrow and hedge",
  );
  const retry = document.querySelector<HTMLButtonElement>(".course-alert button");
  await act(async () => {
    retry!.click();
    await loadCourseMock.mock.results.at(-1)?.value;
  });
  expect(document.querySelector(".course-alert")).toBeNull();
  expect(document.querySelector('.pack-choice[aria-pressed="true"]')?.textContent).toContain("front page");
  expect(loadLang()).toBe("en-US");
});
