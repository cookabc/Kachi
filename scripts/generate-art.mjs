#!/usr/bin/env node
/**
 * generate-art.mjs — batch concept art via `codex exec` + built-in imagegen.
 *
 * Why this shape (see docs/art-pipeline.md for the F0 measurements):
 *  - codex writes each image to ~/.codex/generated_images/<uuid>/ and does NOT
 *    honor a target path, so this script finds the newest file and renames it.
 *  - The style paragraph is a single constant. Three-image batches proved that
 *    reusing it verbatim keeps line weight, shadow and palette identical across
 *    images; per-concept rewording is what makes a set drift.
 *  - Output is .webp at 512px (hero) plus a 128px chip, matching the size slots
 *    in src/art-assets.ts.
 *
 * Usage:
 *   node scripts/generate-art.mjs --pack t1-finance-news          # whole pack
 *   node scripts/generate-art.mjs --only hedge,pledge             # specific ids
 *   node scripts/generate-art.mjs --pack t1 --dry-run             # print prompts
 *
 * Writes: public/art/<id>.webp, public/art/<id>@128.webp, content/art-manifest.json
 * Skips work already on disk (resumable), like the word-atlas forge pattern.
 */
import { execFile } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);
const ROOT = process.cwd();
const ART_DIR = path.join(ROOT, "public/art");
const MANIFEST = path.join(ROOT, "content/art-manifest.json");
const GENERATED = path.join(homedir(), ".codex/generated_images");

// Copied verbatim from the F0 verification. Do not edit per concept: the
// consistency of a 190-image set depends on this block staying identical.
const STYLE = `Cute sticker-style vector illustration, thick dark ink outlines (#1B2E24, 3-4px).
Hard offset drop shadow, no blur, offset down-right ~4px, #1B2E24 at 20% opacity.
Candy palette ONLY: lime #58CC02, yellow #FFC800, sky blue #1CB0F6, coral #FF8A65, cream #FFE08A.
Flat colors, no gradients, no texture.
Single centered subject, generous white negative space.
No text, letters, numbers, logos, watermarks.`;

function parseArgs(argv) {
  const out = { pack: null, only: [], dryRun: false, force: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--pack") out.pack = argv[++i];
    else if (arg === "--only") out.only = argv[++i].split(",").map((s) => s.trim());
    else if (arg === "--dry-run") out.dryRun = true;
    else if (arg === "--force") out.force = true;
  }
  return out;
}

/** Concepts that still need art: every concept in the pack without a manifest entry. */
function pendingConcepts(options) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const packs = readPackIds();
  const wanted = options.only.length
    ? packs.flatMap((id) => conceptsOf(id)).filter((c) => options.only.includes(c.id))
    : packs.filter((id) => !options.pack || id === options.pack).flatMap(conceptsOf);
  return wanted.filter((c) => options.force || !manifest.concepts[c.id]);
}

function readPackIds() {
  const indexPath = path.join(ROOT, "content/packs/index.json");
  if (!existsSync(indexPath)) return ["hedge-or-pledge"];
  return JSON.parse(readFileSync(indexPath, "utf8")).packs.map((pack) => pack.id);
}

function conceptsOf(packId) {
  const file = path.join(ROOT, "content/packs", packId, "zh-CN/course.json");
  if (!existsSync(file)) return [];
  return JSON.parse(readFileSync(file, "utf8")).concepts.map((concept) => ({
    id: concept.id,
    term: concept.term,
    scene: concept.scene ?? concept.caption ?? concept.definition ?? concept.term,
    packId,
  }));
}

/** Newest file under ~/.codex/generated_images, since codex ignores --out. */
function newestGenerated(sinceMs) {
  let best = null;
  if (!existsSync(GENERATED)) return null;
  for (const session of readdirSync(GENERATED)) {
    const dir = path.join(GENERATED, session);
    if (!statSync(dir).isDirectory()) continue;
    for (const file of readdirSync(dir)) {
      if (!/\.(png|webp|jpg)$/i.test(file)) continue;
      const full = path.join(dir, file);
      const { mtimeMs } = statSync(full);
      if (mtimeMs < sinceMs) continue;
      if (!best || mtimeMs > best.mtimeMs) best = { full, mtimeMs };
    }
  }
  return best?.full ?? null;
}

async function generateOne(concept, options) {
  const prompt = `Generate one image at 512x512, PNG, saved to ${ART_DIR}/${concept.id}.png.

Art direction (must follow exactly):
${STYLE}

Subject: ${concept.scene}`;

  if (options.dryRun) {
    console.log(`\n=== ${concept.id} ===\n${prompt}`);
    return "dry-run";
  }

  const started = Date.now();
  await run("codex", ["exec", "--skip-git-repo-check", "--sandbox", "workspace-write", prompt], {
    cwd: ROOT,
    maxBuffer: 32 * 1024 * 1024,
    timeout: 300_000,
  });

  const produced = newestGenerated(started);
  if (!produced) throw new Error(`codex reported success but wrote no image for ${concept.id}`);

  mkdirSync(ART_DIR, { recursive: true });
  const hero = path.join(ART_DIR, `${concept.id}.webp`);
  const chip = path.join(ART_DIR, `${concept.id}@128.webp`);
  // sips converts and resizes in one step; -z takes HEIGHT then WIDTH.
  await run("sips", ["-s", "format", "webp", "-z", "512", "512", produced, "--out", hero]);
  await run("sips", ["-s", "format", "webp", "-z", "128", "128", produced, "--out", chip]);
  return "ok";
}

function record(id, packId) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  manifest.concepts[id] = { file: `/art/${id}.webp`, bg: "#ffffff", pack: packId };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pending = pendingConcepts(options);
  console.log(`Pending: ${pending.length} concept(s)${options.dryRun ? " (dry run)" : ""}`);
  if (!pending.length) return;

  let done = 0;
  let failed = 0;
  for (const concept of pending) {
    try {
      const result = await generateOne(concept, options);
      if (result === "ok") {
        record(concept.id, concept.packId);
        done += 1;
        console.log(`  [${done}/${pending.length}] ${concept.id}`);
      }
    } catch (error) {
      failed += 1;
      // Keep going: one bad prompt should not lose the rest of a 190-image run.
      console.error(`  [fail] ${concept.id}: ${error.message}`);
    }
  }
  console.log(`\nDone ${done}, failed ${failed}.`);
  if (failed) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
