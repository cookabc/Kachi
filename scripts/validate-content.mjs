// Build-time content gate. Every locale pack must pass the shared
// validateCourse rules from ../src/schema — a hand-rolled subset used
// to live here, so an English pack could violate course rules while CI stayed
// green — and the packs must stay structurally identical (ids, exercise types,
// answers, pairings) so one locale cannot drift from the other.
import fs from "node:fs";
import path from "node:path";
import { fillLeaksAnswer } from "../src/fill.ts";
import { validateCourse } from "../src/schema/index.ts";

// Ids that carry art but are not concepts. Read as data: this script runs under
// plain Node, which cannot resolve the app's extensionless TS imports.
const outOfSyllabus = new Set(
  JSON.parse(fs.readFileSync(new URL("../content/out-of-syllabus.json", import.meta.url), "utf8")).ids,
);

const root = process.cwd();
const registryPath = path.join(root, "content/packs/index.json");
const registry = fs.existsSync(registryPath) ? JSON.parse(fs.readFileSync(registryPath, "utf8")) : null;
// With a registry, validate every registered pack; otherwise fall back to the
// single legacy pack so an unregistered checkout still builds.
const packRoots = registry
  ? registry.packs.map((pack) => path.join(root, "content/packs", pack.id))
  : [path.join(root, "content/packs/hedge-or-pledge")];
const packFiles = [];
for (const packRoot of packRoots) {
  if (!fs.existsSync(packRoot)) continue;
  for (const entry of fs.readdirSync(packRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const file = path.join(packRoot, entry.name, "course.json");
    if (fs.existsSync(file)) packFiles.push(file);
  }
}

if (packFiles.length === 0) {
  console.error("No course packs found under content/packs.");
  process.exit(1);
}

let failed = false;
const fail = (message) => {
  console.error(message);
  failed = true;
};

const packs = packFiles.map((file) => {
  const localeDir = path.basename(path.dirname(file));
  const packId = path.basename(path.dirname(path.dirname(file)));
  const name = `${packId}/${localeDir}`;
  const course = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!course.locale || course.locale !== localeDir) {
    fail(`[${name}] locale "${course.locale}" does not match the locale directory "${localeDir}"`);
  }
  if (!course.packId || course.packId !== packId) {
    fail(`[${name}] packId "${course.packId}" does not match the pack directory "${packId}"`);
  }
  for (const issue of validateCourse(course, outOfSyllabus)) {
    fail(`[${name}] ${issue.path}: ${issue.message}`);
  }
  const prompts = course.lessons.flatMap((lesson) => lesson.prompts);
  console.log(
    `[${name}] Valid: ${course.lessons.length} lessons, ${course.concepts.length} concepts, ${prompts.length} prompts`,
  );
  return { name, course, packId };
});

// Locale parity is a within-pack property: an en-US pack must mirror its own
// zh-CN sibling, not some other pack's. Comparing across packs was the bug that
// greeted the first multi-pack checkout.
const byPack = new Map();
for (const entry of packs) {
  const list = byPack.get(entry.packId) ?? [];
  list.push(entry);
  byPack.set(entry.packId, list);
}
for (const [packId, list] of byPack) {
  for (let i = 1; i < list.length; i += 1) {
    comparePacks(list[0], list[i]);
  }
  if (list.length === 1) console.log(`[parity] ${packId}: single locale, nothing to compare`);
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
  // Corpus is organised by pack (content/corpus/t2-earnings/…), so the walk has
  // to descend: a top-level-only read silently ignored every pack subdirectory.
  const walkDir = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const file = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walkDir(file);
        continue;
      }
      if (entry.name.endsWith(".json")) {
        // headline batches: flatten every array of strings
        const walkJson = (value) => {
          if (typeof value === "string") parts.push(value);
          else if (Array.isArray(value)) value.forEach(walkJson);
          else if (value && typeof value === "object") Object.values(value).forEach(walkJson);
        };
        try {
          walkJson(JSON.parse(fs.readFileSync(file, "utf8")));
        } catch (error) {
          fail(`[corpus] ${entry.name} is not valid JSON: ${error.message}`);
        }
      } else if (entry.name.endsWith(".txt")) {
        parts.push(fs.readFileSync(file, "utf8"));
      }
    }
  };
  walkDir(corpusDir);
  return parts.length ? parts.join("\n").toLowerCase() : null;
};

/**
 * Does the corpus use this term?
 *
 * Two things the naive \b match got wrong:
 *  - Hyphenated terms ("write-down") — \b sits between "-" and a letter, so
 *    the pattern never matched even when the text said "write-down".
 *  - Compound terms whose words may carry other punctuation ("free cash flow"
 *    written across a line break or with different spacing).
 * The term is matched word-by-word, with the final word allowed to inflect.
 */
export function corpusHasTerm(corpus, term) {
  const words = term
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!words.length) return false;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const last = escaped.pop();
  // Words may be separated by a space or a hyphen in the text.
  const pattern = new RegExp(
    `\\b${escaped.join("[\\s-]+")}${escaped.length ? "[\\s-]+" : ""}${last}(s|es|ed|ing)?\\b`,
  );
  return pattern.test(corpus);
}

const corpus = corpusText();

// Vocabulary exemptions: a term may be taught without corpus evidence only if
// content/vocabulary-exemptions.json says why and when that claim expires.
//
// A whitelist with no reasons is not a justification, it is a silencer. Every
// entry carries a reason (what the term is for) and a reviewBy date, and the
// build fails when the date passes — the debt has to be renewed on purpose or
// paid off.
const exemptionsPath = path.join(root, "content/vocabulary-exemptions.json");
let exemptions = { terms: {} };
if (fs.existsSync(exemptionsPath)) {
  try {
    exemptions = JSON.parse(fs.readFileSync(exemptionsPath, "utf8"));
  } catch (error) {
    fail(`[exemptions] content/vocabulary-exemptions.json is not valid JSON: ${error.message}`);
  }
}
const EXEMPT_TERMS = new Map();
for (const [term, entry] of Object.entries(exemptions.terms ?? {})) {
  const key = term.toLowerCase();
  if (!entry?.reason || String(entry.reason).trim().length < 20) {
    fail(`[exemptions] "${term}" has no usable reason — an exemption must say what the term is for`);
    continue;
  }
  if (!entry.reviewBy || Number.isNaN(Date.parse(entry.reviewBy))) {
    fail(`[exemptions] "${term}" has no reviewBy date — exemptions expire, they do not persist`);
    continue;
  }
  EXEMPT_TERMS.set(key, entry);
}
// Expiry is a build failure, not a warning: a lapsed justification is the same
// as no justification.
const today = new Date().toISOString().slice(0, 10);
for (const [term, entry] of EXEMPT_TERMS) {
  if (entry.reviewBy < today) {
    fail(
      `[exemptions] "${term}" expired on ${entry.reviewBy} — re-justify it or find corpus evidence (content/vocabulary-exemptions.json)`,
    );
  }
}

if (!corpus) {
  console.log("[corpus] no corpus files — vocabulary evidence gate skipped");
} else {
  for (const { name, course } of packs) {
    const missing = [];
    let excused = 0;
    for (const concept of course.concepts) {
      const term = String(concept.term).toLowerCase();
      if (corpusHasTerm(corpus, term)) continue;
      const exempt = EXEMPT_TERMS.get(term);
      if (exempt) {
        // An exemption is per pack: the reason for teaching a term in T6 does
        // not automatically cover the same term in a different pack.
        if (exempt.pack && exempt.pack !== name.split("/")[0]) {
          missing.push(`${concept.term} (exemption names pack ${exempt.pack})`);
          continue;
        }
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
        `[corpus] ${name}: every concept appears in the corpus (${excused} exempted with a reason — see content/vocabulary-exemptions.json)`,
      );
    } else {
      console.log(`[corpus] ${name}: every concept appears in the corpus`);
    }
  }
}

if (failed) process.exit(1);

// A fill stem must not contain its answer. The generated pack once shipped
// stems like "Oil prices rallied 4%… (这里的词是 ____)" because blanking only
// matched the bare term, not "rallied" — the answer was printed in the
// sentence. fill.ts matches inflections, and this gate keeps every pack
// (hand-written ones included) honest about it.
for (const { name, course } of packs) {
  for (const lesson of course.lessons) {
    for (const prompt of lesson.prompts) {
      if (prompt.type !== "fill" || typeof prompt.answer !== "string") continue;
      if (fillLeaksAnswer(prompt.story ?? "", prompt.answer)) {
        fail(`[${name}] fill ${prompt.id}: the answer "${prompt.answer}" appears in its own stem`);
      }
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
