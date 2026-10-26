// Build-time content gate. Every locale pack must pass the shared
// validateCourse rules from ../src/schema — a hand-rolled subset used
// to live here, so an English pack could violate course rules while CI stayed
// green — and the packs must stay structurally identical (ids, exercise types,
// answers, pairings) so one locale cannot drift from the other.
import fs from "node:fs";
import path from "node:path";
import { validateCourse } from "../src/schema/index.ts";

const root = process.cwd();
const packsDir = path.join(root, "content/packs/hedge-or-pledge");
const packFiles = fs
  .readdirSync(packsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packsDir, entry.name, "course.json"))
  .filter((file) => fs.existsSync(file));

if (packFiles.length === 0) {
  console.error("No course packs found under content/packs/hedge-or-pledge.");
  process.exit(1);
}

let failed = false;
const fail = (message) => {
  console.error(message);
  failed = true;
};

const packs = packFiles.map((file) => {
  const name = path.relative(packsDir, path.dirname(file));
  const course = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!course.locale || course.locale !== name) {
    fail(`[${name}] locale "${course.locale}" does not match the pack directory "${name}"`);
  }
  for (const issue of validateCourse(course)) {
    fail(`[${name}] ${issue.path}: ${issue.message}`);
  }
  const prompts = course.lessons.flatMap((lesson) => lesson.prompts);
  console.log(
    `[${name}] Valid: ${course.lessons.length} lessons, ${course.concepts.length} concepts, ${prompts.length} prompts`,
  );
  return { name, course };
});

for (let i = 1; i < packs.length; i += 1) {
  comparePacks(packs[0], packs[i]);
}

// Vocabulary evidence gate (docs/vocabulary-system.md §6).
//
// A term earns its place in a pack by appearing in the material that pack
// teaches you to read. Without this check the word list drifts toward
// whatever the author happened to know — the 2026-10 audit found 30 of 40
// concepts never appear in 172 real headlines.
//
// The corpus is optional per pack: a pack with no corpus file is skipped
// rather than failed, so adding a pack does not require inventing evidence
// before the content exists. Once the file exists, every term must hit.
const corpusDir = path.join(root, "content/corpus");
const corpusText = () => {
  if (!fs.existsSync(corpusDir)) return null;
  const parts = [];
  for (const entry of fs.readdirSync(corpusDir, { withFileTypes: true })) {
    if (entry.isDirectory()) continue;
    const file = path.join(corpusDir, entry.name);
    if (entry.name.endsWith(".json")) {
      // headline batches: flatten every array of strings
      const walk = (value) => {
        if (typeof value === "string") parts.push(value);
        else if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") Object.values(value).forEach(walk);
      };
      try {
        walk(JSON.parse(fs.readFileSync(file, "utf8")));
      } catch (error) {
        fail(`[corpus] ${entry.name} is not valid JSON: ${error.message}`);
      }
    } else if (entry.name.endsWith(".txt")) {
      parts.push(fs.readFileSync(file, "utf8"));
    }
  }
  return parts.length ? parts.join("\n").toLowerCase() : null;
};

const corpus = corpusText();
// Terms the author has explicitly justified without corpus evidence. Empty by
// default: an entry here is a promise that docs/vocabulary-system.md says why
// the term is taught even though the target material never uses it.
//
// The current pack predates the gate. Its 25 unlisted terms are the exact
// finding the 2026-10 audit produced, so they are carried as a known debt
// rather than silently exempted — the list is printed on every build and must
// shrink to zero as the packs are rebuilt. New packs start with no allowance.
const KNOWN_UNGATED = new Set(
  [
    // pledge collateral haircut margin call leverage derivative option put call
    // short selling notional basis risk diversification counterparty default
    // mark-to-market securities-backed loan capital gains buy-borrow-die real rate
    // quantitative easing spot contango backwardation cost of carry
    "pledge",
    "collateral",
    "haircut",
    "margin call",
    "leverage",
    "derivative",
    "option",
    "put",
    "call",
    "short selling",
    "notional",
    "basis risk",
    "diversification",
    "counterparty",
    "default",
    "mark-to-market",
    "securities-backed loan",
    "capital gains",
    "buy-borrow-die",
    "real rate",
    "quantitative easing",
    "spot",
    "contango",
    "backwardation",
    "cost of carry",
  ].map((term) => term.toLowerCase()),
);

if (!corpus) {
  console.log("[corpus] no corpus files — vocabulary evidence gate skipped");
} else {
  for (const { name, course } of packs) {
    const missing = [];
    let excused = 0;
    for (const concept of course.concepts) {
      const term = String(concept.term).toLowerCase();
      // Match the term as a phrase, allowing inflection on the final word:
      // "yield" hits "yields", "rate hike" hits "rate hikes".
      const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const pattern = new RegExp(`\\b${escaped}(s|es|ed|ing)?\\b`);
      if (pattern.test(corpus)) continue;
      if (KNOWN_UNGATED.has(term)) {
        excused += 1;
        continue;
      }
      missing.push(concept.term);
    }
    if (missing.length) {
      fail(
        `[corpus] ${name}: ${missing.length}/${course.concepts.length} concepts never appear in content/corpus — ` +
          `add corpus evidence or justify the term in docs/vocabulary-system.md: ${missing.join(", ")}`,
      );
    } else if (excused) {
      console.log(
        `[corpus] ${name}: every concept appears in the corpus (${excused} carried as known debt — see KNOWN_UNGATED)`,
      );
    } else {
      console.log(`[corpus] ${name}: every concept appears in the corpus`);
    }
  }
}

if (failed) process.exit(1);

// Locale packs are translations of one course: ids, exercise types, answers,
// and pairings must line up exactly, or grading and mastery attribution stop
// meaning the same thing in every language. Locale text (stems, option texts,
// definitions) may differ freely.
function comparePacks(a, b) {
  const tag = `[parity] ${a.name} vs ${b.name}`;
  const ids = (list) => list.map((item) => String(item.id));
  const sameIds = (label, left, right) => {
    if (JSON.stringify(left) === JSON.stringify(right)) return true;
    fail(`${tag} ${label} differ: [${left.join(", ")}] vs [${right.join(", ")}]`);
    return false;
  };

  if (!sameIds("unit ids", ids(a.course.units), ids(b.course.units))) return;
  if (!sameIds("concept ids", ids(a.course.concepts), ids(b.course.concepts))) return;
  if (!sameIds("source ids", ids(a.course.sources), ids(b.course.sources))) return;
  if (!sameIds("lesson ids", ids(a.course.lessons), ids(b.course.lessons))) return;

  for (const concept of a.course.concepts) {
    const other = b.course.concepts.find((item) => item.id === concept.id);
    // relations are concept-graph edges (ids only) — structural, so they must be
    // identical across locales just like mixUp pairings.
    for (const field of [
      "unit",
      "mixUp",
      "relations",
      "risk",
      "reviewStatus",
      "jurisdiction",
      "asOf",
      "reviewDue",
    ]) {
      if (JSON.stringify(concept[field]) !== JSON.stringify(other?.[field])) {
        fail(`${tag} concept ${concept.id} ${field} differs`);
      }
    }
    if (JSON.stringify(concept.sourceIds) !== JSON.stringify(other?.sourceIds)) {
      fail(`${tag} concept ${concept.id} sourceIds differ`);
    }
  }

  for (const lesson of a.course.lessons) {
    const other = b.course.lessons.find((item) => item.id === lesson.id);
    if (!other) continue;
    if (lesson.unit !== other.unit || Boolean(lesson.review) !== Boolean(other.review)) {
      fail(`${tag} lesson ${lesson.id} unit/review differs`);
    }
    if (!sameIds(`lesson ${lesson.id} prompt order`, ids(lesson.prompts), ids(other.prompts))) continue;
    lesson.prompts.forEach((prompt, index) => {
      comparePrompts(prompt, other.prompts[index], tag);
    });
  }
}

function comparePrompts(a, b, tag) {
  const label = `${tag} prompt ${a.id}`;
  if (a.type !== b.type) fail(`${label} type differs`);
  if (a.termId !== b.termId) fail(`${label} termId differs`);
  if (JSON.stringify(a.termIds ?? []) !== JSON.stringify(b.termIds ?? [])) fail(`${label} termIds differ`);
  if (Boolean(a.assessmentOnly) !== Boolean(b.assessmentOnly)) fail(`${label} assessmentOnly differs`);
  if (JSON.stringify(a.answer) !== JSON.stringify(b.answer)) fail(`${label} answer differs`);
  if ((a.options?.length ?? 0) !== (b.options?.length ?? 0)) return fail(`${label} option count differs`);
  a.options?.forEach((option, index) => {
    if (option.art !== b.options[index].art) fail(`${label} option ${index} art differs`);
  });
  if ((a.bank?.length ?? 0) !== (b.bank?.length ?? 0)) fail(`${label} bank size differs`);
  if (
    JSON.stringify((a.pairs ?? []).map((pair) => pair.id)) !==
    JSON.stringify((b.pairs ?? []).map((pair) => pair.id))
  ) {
    fail(`${label} pair ids differ`);
  }
}
