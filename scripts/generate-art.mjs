#!/usr/bin/env node
/**
 * generate-art.mjs — batch concept art via `codex exec` + built-in imagegen.
 *
 * Why this shape:
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
import { execFile, spawn } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
async function pendingConcepts(options) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  const packs = readPackIds();
  const wanted = options.only.length
    ? (await Promise.all(packs.map(conceptsOf))).flat().filter((c) => options.only.includes(c.id))
    : (await Promise.all(packs.filter((id) => !options.pack || id === options.pack).map(conceptsOf))).flat();
  return wanted.filter((c) => options.force || !manifest.concepts[c.id]);
}

function readPackIds() {
  const indexPath = path.join(ROOT, "content/packs/index.json");
  if (!existsSync(indexPath)) return ["hedge-or-pledge"];
  return JSON.parse(readFileSync(indexPath, "utf8")).packs.map((pack) => pack.id);
}

async function conceptsOf(packId) {
  const file = path.join(ROOT, "content/packs", packId, "zh-CN/course.json");
  if (!existsSync(file)) return [];
  const course = JSON.parse(readFileSync(file, "utf8"));
  // scene lives in the pack's source.mjs (it is art direction, not course
  // content, so it is not published in course.json). Read it when available.
  const scenes = await readScenes(packId);
  return course.concepts.map((concept) => ({
    id: concept.id,
    term: concept.term,
    scene: scenes[concept.id] ?? concept.caption ?? concept.definition ?? concept.term,
    packId,
  }));
}

/**
 * Import a pack's source.mjs and pull the per-concept scene description.
 * The pack source is the only place the art direction is written down; without
 * it every prompt would fall back to the caption, which describes meaning
 * rather than what to draw.
 */
async function readScenes(packId) {
  const sourceFile = path.join(ROOT, "content/packs", packId, "source.mjs");
  if (!existsSync(sourceFile)) return {};
  try {
    // The source is plain ESM with no side effects beyond building consts.
    const module = await import(pathToFileURL(sourceFile).href);
    const out = {};
    for (const concept of module.CONCEPTS ?? []) {
      if (concept.scene) out[concept.id] = concept.scene;
    }
    return out;
  } catch (error) {
    console.warn(`  [warn] could not read scenes from ${packId}: ${error.message}`);
    return {};
  }
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

/**
 * Filesystem/URL-safe name for a concept id. Ids contain spaces ("interest
 * rate") and slashes ("p/e"), which either break a path or need escaping in a
 * URL — neither is worth carrying.
 */
function slug(id) {
  return id
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** The PNG codex produced: the requested path if honoured, else the newest generated file. */
function locateProduced(pngTarget, sinceMs) {
  if (existsSync(pngTarget)) return pngTarget;
  return newestGenerated(sinceMs);
}

/** Run codex for one prompt with stdin closed (it blocks on a non-TTY stdin). */
async function invokeCodex(prompt, label) {
  await new Promise((resolve, reject) => {
    const child = spawn("codex", ["exec", "--skip-git-repo-check", "--sandbox", "workspace-write", prompt], {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let err = "";
    child.stderr.on("data", (chunk) => {
      err += chunk;
    });
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`${label}: codex timed out after 300s`));
    }, 300_000);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`${label}: codex exited ${code}: ${err.slice(-300)}`));
    });
  });
}

async function generateOne(concept, options) {
  const base = slug(concept.id);
  const pngTarget = path.join(ART_DIR, `${base}.png`);
  const prompt = `Generate one image at 512x512, PNG, saved to ${pngTarget}.

Art direction (must follow exactly):
${STYLE}

Subject: ${concept.scene}`;

  if (options.dryRun) {
    console.log(`\n=== ${concept.id} ===\n${prompt}`);
    return "dry-run";
  }

  const started = Date.now();
  await invokeCodex(prompt, concept.id);

  // codex usually honors the target path, but has also written into
  // ~/.codex/generated_images instead — accept either. Occasionally it exits 0
  // having written nothing at all, which in a 36-image batch would strand the
  // run on one word; retry once before giving up.
  let produced = locateProduced(pngTarget, started);
  if (!produced) {
    console.warn(`  [retry] ${concept.id}: no file after first attempt`);
    const retryStart = Date.now();
    await invokeCodex(prompt, concept.id);
    produced = locateProduced(pngTarget, retryStart);
  }
  if (!produced) throw new Error(`codex reported success but wrote no image for ${concept.id}`);

  mkdirSync(ART_DIR, { recursive: true });
  const hero = path.join(ART_DIR, `${base}.webp`);
  const chip = path.join(ART_DIR, `${base}@128.webp`);
  // sips reads webp but cannot write it, so cwebp encodes (the word-atlas
  // pipeline uses the same tool). -resize takes one dimension; 0 keeps ratio.
  await run("cwebp", ["-quiet", "-q", "82", "-resize", "512", "0", produced, "-o", hero]);
  await run("cwebp", ["-quiet", "-q", "82", "-resize", "128", "0", produced, "-o", chip]);
  if (produced === pngTarget) rmSync(pngTarget, { force: true });
  return "ok";
}

function record(id, packId) {
  const manifest = JSON.parse(readFileSync(MANIFEST, "utf8"));
  manifest.concepts[id] = { file: `/art/${slug(id)}.webp`, bg: "#ffffff", pack: packId };
  writeFileSync(MANIFEST, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const pending = await pendingConcepts(options);
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
