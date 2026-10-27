import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { Lang } from "./course";
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

function installMemoryIndexedDB() {
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

async function waitForHome() {
  const started = Date.now();
  while (!document.body.textContent?.includes("分清易混的财经英语")) {
    if (Date.now() - started > 2000) {
      throw new Error(`still booting: ${document.body.textContent}`);
    }
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

beforeEach(async () => {
  localStorage.clear();
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
    expect(document.querySelector("[role='alert']")?.textContent).toContain("暂时读不到学习记录");
  });

  it("falls back to the bundled Chinese pack when the selected course fails to load", async () => {
    localStorage.setItem("kachi-lang", "en-US");
    loadCourseMock.mockImplementation((packId, lang) => {
      if (lang === "en-US") return Promise.reject(new Error("missing chunk"));
      return vi
        .importActual<typeof import("./course")>("./course")
        .then((actual) => actual.loadCourse(packId, lang));
    });
    await renderApp();
    await waitForHome();
    expect(document.querySelector(".loading")).toBeNull();
    expect(document.body.textContent).not.toContain("Preparing your offline study space");
    expect(loadLang()).toBe("zh-CN");
  });
});
