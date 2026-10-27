import hedgeZh from "../content/packs/hedge-or-pledge/zh-CN/course.json";
import registry from "../content/packs/index.json";
import type { Course } from "./domain";

export type Lang = "zh-CN" | "en-US";

// A pack id names a course. The default pack ships in the main bundle; every
// other pack (and every en-US locale) is a lazy chunk, so first paint never
// parses a second course.
//
// The service worker precaches the chunks, so all packs stay available offline
// after the first online visit.
export const DEFAULT_PACK = "hedge-or-pledge";

interface PackMeta {
  id: string;
  level: number;
  title: string;
  goal: string;
  conceptCount: number;
  status: string;
  legacy?: boolean;
}

/** Packs that have content on disk. Planned packs stay in the registry only. */
export const PACKS = (registry.packs as PackMeta[]).filter((pack) => pack.status !== "planned");

/** Every registered pack, including ones not yet written. */
export const ALL_PACKS = registry.packs as PackMeta[];

const cache: Partial<Record<string, Course>> = {
  [`${DEFAULT_PACK}/zh-CN`]: hedgeZh as Course,
};

const pending: Partial<Record<string, Promise<Course>>> = {};

function cacheKey(packId: string, lang: Lang): string {
  return `${packId}/${lang}`;
}

/**
 * Lazy loaders, spelled out so the bundler can see every chunk statically.
 * A computed `import()` path would make Vite emit one giant context module.
 */
// JSON imports are typed as literals (risk: string, etc.), which is wider than
// the Course unions. Reading external data through unknown is the standard
// escape: the validator is what actually guarantees the shape.
type CourseModule = { default: unknown };
const asCourse = (module: CourseModule): Course => module.default as Course;

const LOADERS: Record<string, () => Promise<CourseModule>> = {
  "hedge-or-pledge/en-US": () => import("../content/packs/hedge-or-pledge/en-US/course.json"),
  "t1-finance-news/zh-CN": () => import("../content/packs/t1-finance-news/zh-CN/course.json"),
  "t1-finance-news/en-US": () => import("../content/packs/t1-finance-news/en-US/course.json"),
  "t2-company-earnings/zh-CN": () => import("../content/packs/t2-company-earnings/zh-CN/course.json"),
  "t2-company-earnings/en-US": () => import("../content/packs/t2-company-earnings/en-US/course.json"),
  "t3-bonds-rates/zh-CN": () => import("../content/packs/t3-bonds-rates/zh-CN/course.json"),
  "t3-bonds-rates/en-US": () => import("../content/packs/t3-bonds-rates/en-US/course.json"),
  "t4-forex-macro/zh-CN": () => import("../content/packs/t4-forex-macro/zh-CN/course.json"),
  "t4-forex-macro/en-US": () => import("../content/packs/t4-forex-macro/en-US/course.json"),
};

/** Default pack — zh-CN. Tests and legacy call sites read this. */
export const course: Course = hedgeZh as Course;

/** A pack already in memory, if any (no fetch). */
export function courseFor(packId: string, lang: Lang): Course | undefined {
  return cache[cacheKey(packId, lang)];
}

/** Resolve the pack to render, fetching its lazy chunk on first need. */
export function loadCourse(packId: string, lang: Lang): Promise<Course> {
  const key = cacheKey(packId, lang);
  const ready = cache[key];
  if (ready) return Promise.resolve(ready);
  const inFlight = pending[key];
  if (inFlight) return inFlight;

  const loader = LOADERS[key];
  if (!loader) {
    // Asking for a pack that has no chunk is a caller bug, not a runtime
    // condition: name the pack so the failure is diagnosable.
    return Promise.reject(new Error(`No course chunk for ${key}`));
  }

  const attempt = loader().then((module) => {
    const loaded = asCourse(module);
    cache[key] = loaded;
    return loaded;
  });
  pending[key] = attempt;
  // A failed fetch must not poison the cache: the next switch retries.
  void attempt.catch(() => {
    if (pending[key] === attempt) delete pending[key];
  });
  return attempt;
}
