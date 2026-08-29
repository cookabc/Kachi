import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const packsDir = path.join(root, "content/packs/hedge-or-pledge");
const packFiles = fs
  .readdirSync(packsDir, { withFileTypes: true })
  .filter((entry) => entry.isDirectory())
  .map((entry) => path.join(packsDir, entry.name, "course.json"))
  .filter((file) => fs.existsSync(file));

if (packFiles.length === 0) {
  console.error("No course packs found under content/packs/hedge-or-pledge. Run pnpm migrate:legacy-content first.");
  process.exit(1);
}

for (const file of packFiles) {
  validatePack(file);
}
if (process.exitCode) process.exit(process.exitCode);

function validatePack(file) {
  const packName = path.relative(packsDir, path.dirname(file));
  const course = JSON.parse(fs.readFileSync(file, "utf8"));
  const ids = new Set();
  const fail = (message) => {
    console.error(`[${packName}] ${message}`);
    process.exitCode = 1;
  };
  if (!course.locale || course.locale !== packName) {
    fail(`locale "${course.locale}" does not match the pack directory "${packName}"`);
  }
  for (const entity of [...course.concepts, ...course.lessons, ...course.lessons.flatMap((lesson) => lesson.prompts)]) {
    if (ids.has(entity.id)) fail(`Duplicate ID: ${entity.id}`);
    ids.add(entity.id);
  }
  const conceptIds = new Set(course.concepts.map((concept) => concept.id));
  for (const concept of course.concepts) {
    if (!conceptIds.has(concept.mixUp)) fail(`Unknown mix-up ${concept.mixUp} for ${concept.id}`);
  }
  for (const prompt of course.lessons.flatMap((lesson) => lesson.prompts)) {
    if (!prompt.termIds?.length) fail(`Prompt ${prompt.id} has no term IDs`);
    if (["meaning", "scenario"].includes(prompt.type) && (!prompt.options || typeof prompt.answer !== "number")) {
      fail(`Prompt ${prompt.id} is missing a choice answer`);
    }
  }
  console.log(`[${packName}] Valid: ${course.lessons.length} lessons, ${course.concepts.length} concepts, ${course.lessons.flatMap((lesson) => lesson.prompts).length} prompts`);
}
