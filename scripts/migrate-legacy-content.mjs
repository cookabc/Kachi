import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";

const root = process.cwd();
const legacyPath = path.join(root, "Hedge-or-Pledge.html");
const outputPath = path.join(root, "content/packs/hedge-or-pledge/zh-CN/course.json");
const html = fs.readFileSync(legacyPath, "utf8");
const start = html.indexOf("const TERMS = {");
const end = html.indexOf("/* ========== STATE");

if (start < 0 || end < 0) throw new Error("Could not find legacy content section");
const code = `${html.slice(start, end)}\nglobalThis.__legacy = { TERMS, UNITS, LESSONS };`;
const sandbox = { globalThis: {} };
vm.runInNewContext(code, sandbox, { filename: "Hedge-or-Pledge.html" });
const { TERMS, UNITS, LESSONS } = sandbox.globalThis.__legacy;

const legacyRisk = new Set(["securities-backed loan", "capital gains", "buy-borrow-die"]);
const course = {
  schemaVersion: 1,
  packId: "hedge-or-pledge",
  contentVersion: "2026.08.28-legacy",
  locale: "zh-CN",
  generatedAt: new Date().toISOString(),
  units: UNITS,
  concepts: Object.values(TERMS).map((term) => ({
    ...term,
    sourceIds: [],
    risk: legacyRisk.has(term.id) ? "jurisdictional" : "evergreen",
    jurisdiction: legacyRisk.has(term.id) ? "US context in legacy content" : undefined,
    reviewStatus: "legacy"
  })),
  lessons: LESSONS,
  sources: []
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(course, null, 2)}\n`);
console.log(`Migrated ${course.lessons.length} lessons and ${course.concepts.length} concepts to ${outputPath}`);
