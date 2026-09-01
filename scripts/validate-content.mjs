// Build-time content gate. Every locale pack must pass the shared
// validateCourse rules from @kachi/content-schema — a hand-rolled subset used
// to live here, so an English pack could violate course rules while CI stayed
// green — and the packs must stay structurally identical (ids, exercise types,
// answers, pairings) so one locale cannot drift from the other.
import fs from "node:fs";
import path from "node:path";
import { validateCourse } from "@kachi/content-schema";

const root = process.cwd();
const packsDir = path.join(root, "content/packs/hedge-or-pledge");
const packFiles = fs
  .readdirSync(packsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packsDir, entry.name, "course.json"))
  .filter((file) => fs.existsSync(file));

if (packFiles.length === 0) {
  console.error(
    "No course packs found under content/packs/hedge-or-pledge. Run pnpm migrate:legacy-content first.",
  );
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
    for (const field of ["unit", "mixUp", "risk", "reviewStatus", "jurisdiction", "asOf", "reviewDue"]) {
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
