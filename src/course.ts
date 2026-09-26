import zhCourse from "../content/packs/hedge-or-pledge/zh-CN/course.json";
import type { Course } from "./domain";

export type Lang = "zh-CN" | "en-US";

// zh-CN ships in the main bundle: it is the app's default language and its
// primary audience. en-US rides in a lazy chunk fetched only when a learner
// actually switches, so the first paint never parses a second course.
// The service worker precaches the chunk, so both languages stay available
// offline after the first online visit.
const packs: Partial<Record<Lang, Course>> = {
  "zh-CN": zhCourse as Course,
};

const loadingPacks: Partial<Record<Lang, Promise<Course>>> = {};

function fetchEnPack(): Promise<Course> {
  return import("../content/packs/hedge-or-pledge/en-US/course.json").then(
    (module) => module.default as Course,
  );
}

/** Default pack — zh-CN. Tests and legacy call sites read this. */
export const course: Course = zhCourse as Course;

/** The pack for a language, when it is already in memory (no fetch). */
export function courseFor(lang: Lang): Course | undefined {
  return packs[lang];
}

/** Resolve the pack to render, fetching the lazy en-US chunk on first need. */
export function loadCourse(lang: Lang): Promise<Course> {
  const ready = packs[lang];
  if (ready) return Promise.resolve(ready);
  const pending = loadingPacks[lang];
  if (pending) return pending;
  const attempt = fetchEnPack().then((loaded) => {
    packs[lang] = loaded;
    return loaded;
  });
  loadingPacks[lang] = attempt;
  // A failed fetch must not poison the cache: the next switch retries.
  void attempt.catch(() => {
    if (loadingPacks[lang] === attempt) delete loadingPacks[lang];
  });
  return attempt;
}
