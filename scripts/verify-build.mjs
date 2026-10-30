import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";

const html = await readFile(new URL("../dist/index.html", import.meta.url), "utf8");
const worker = await readFile(new URL("../dist/sw.js", import.meta.url), "utf8");
const registry = JSON.parse(await readFile(new URL("../content/packs/index.json", import.meta.url), "utf8"));
const files = await readdir(new URL("../dist/assets/", import.meta.url));
const entry = html.match(/src="\/assets\/([^"/]+\.js)"/)[1];
assert.ok(
  (await stat(new URL("../dist/assets/" + entry, import.meta.url))).size <= 650000,
  "Initial JS exceeds 650 kB; review eager dependencies.",
);
const courses = files.filter((file) => /^course-.*\.js$/.test(file));
assert.equal(
  courses.length,
  (registry.packs.filter((pack) => pack.status !== "planned").length - 1) * 2,
  "Non-default packs must retain separate locale chunks.",
);
for (const file of files.filter((file) => /\.(js|css)$/.test(file))) {
  assert.ok(worker.includes("assets/" + file), `Offline precache missing ${file}`);
  if (file.endsWith(".css"))
    assert.ok(
      (await stat(new URL("../dist/assets/" + file, import.meta.url))).size <= 100000,
      "CSS exceeds 100 kB.",
    );
}
console.log(
  `Build boundary PASS: ${courses.length} lazy course editions, initial JS below 650 kB, runtime chunks precached.`,
);
