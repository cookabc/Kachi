import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const file = path.join(root, "content/packs/hedge-or-pledge/zh-CN/course.json");
if (!fs.existsSync(file)) {
  console.error("Missing generated course. Run pnpm migrate:legacy-content first.");
  process.exit(1);
}
const course = JSON.parse(fs.readFileSync(file, "utf8"));
const ids = new Set();
const fail = (message) => {
  console.error(message);
  process.exitCode = 1;
};
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
if (process.exitCode) process.exit(process.exitCode);
console.log(`Valid course: ${course.lessons.length} lessons, ${course.concepts.length} concepts, ${course.lessons.flatMap((lesson) => lesson.prompts).length} prompts`);
