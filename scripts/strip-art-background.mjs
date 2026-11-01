#!/usr/bin/env node
/**
 * strip-art-background.mjs — turn the generated term art's white square into
 * real transparency.
 *
 * The image model paints every illustration on a white ground. The UI used to
 * hide that with `mix-blend-mode: multiply`, which only works on light tints and
 * dims the colours a little. This pass removes the ground instead:
 *
 *   1. decode the WebP to raw RGBA (dwebp -pam)
 *   2. flood-fill from the image border through pixels that are close to white
 *      and low in saturation — so the white *inside* a drawing (eyes, paper,
 *      highlights) is untouched because the fill can't reach it across the
 *      dark outline
 *   3. feather: pixels next to the cleared area get partial alpha according to
 *      how white they are, which removes the light fringe around the outline
 *   4. the soft grey drop shadow the model adds under each sticker is kept but
 *      converted to a translucent ink, so it reads on any tint
 *   5. re-encode (cwebp, alpha preserved)
 *
 * Idempotent: an image whose corners are already transparent is skipped.
 * Usage: node scripts/strip-art-background.mjs [file …]   (default: public/art/*.webp)
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const ART_DIR = path.join(process.cwd(), "public/art");
const WHITE = 236; // min channel value counted as "ground"
const SAT = 18; // max (max-min) channel spread counted as neutral
const SHADOW = 214; // neutral pixels lighter than this but darker than WHITE are shadow

function readPam(file) {
  const buf = readFileSync(file);
  const end = buf.indexOf("ENDHDR\n") + 7;
  const header = buf.subarray(0, end).toString();
  const width = Number(/WIDTH (\d+)/.exec(header)[1]);
  const height = Number(/HEIGHT (\d+)/.exec(header)[1]);
  const depth = Number(/DEPTH (\d+)/.exec(header)[1]);
  const raw = buf.subarray(end);
  const rgba = Buffer.alloc(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba[i * 4] = raw[i * depth];
    rgba[i * 4 + 1] = raw[i * depth + 1];
    rgba[i * 4 + 2] = raw[i * depth + 2];
    rgba[i * 4 + 3] = depth === 4 ? raw[i * depth + 3] : 255;
  }
  return { width, height, rgba };
}

function writePam(file, { width, height, rgba }) {
  const header = `P7\nWIDTH ${width}\nHEIGHT ${height}\nDEPTH 4\nMAXVAL 255\nTUPLTYPE RGB_ALPHA\nENDHDR\n`;
  writeFileSync(file, Buffer.concat([Buffer.from(header), rgba]));
}

function strip(img) {
  const { width, height, rgba } = img;
  const n = width * height;
  const at = (i) => [rgba[i * 4], rgba[i * 4 + 1], rgba[i * 4 + 2]];
  const neutral = (r, g, b) => Math.max(r, g, b) - Math.min(r, g, b) <= SAT;
  const isGround = (i) => {
    const [r, g, b] = at(i);
    return neutral(r, g, b) && Math.min(r, g, b) >= SHADOW;
  };
  // Already transparent at the corners: done before.
  if (rgba[3] < 16 && rgba[(n - 1) * 4 + 3] < 16) return false;

  const reached = new Uint8Array(n);
  const stack = [];
  const seed = (i) => {
    if (!reached[i] && isGround(i)) {
      reached[i] = 1;
      stack.push(i);
    }
  };
  for (let x = 0; x < width; x += 1) {
    seed(x);
    seed((height - 1) * width + x);
  }
  for (let y = 0; y < height; y += 1) {
    seed(y * width);
    seed(y * width + width - 1);
  }
  while (stack.length) {
    const i = stack.pop();
    const x = i % width;
    if (x > 0) seed(i - 1);
    if (x < width - 1) seed(i + 1);
    if (i >= width) seed(i - width);
    if (i < n - width) seed(i + width);
  }

  for (let i = 0; i < n; i += 1) {
    if (!reached[i]) continue;
    const [r, g, b] = at(i);
    const lum = (r + g + b) / 3;
    if (lum >= WHITE) {
      rgba[i * 4 + 3] = 0;
    } else {
      // Shadow band: keep it as translucent ink, proportional to its darkness.
      const alpha = Math.round(((WHITE - lum) / (WHITE - SHADOW)) * 70);
      rgba[i * 4] = 33;
      rgba[i * 4 + 1] = 28;
      rgba[i * 4 + 2] = 59;
      rgba[i * 4 + 3] = Math.min(70, alpha);
    }
  }
  // Feather one ring of unreached light pixels that touch the cleared area.
  for (let i = 0; i < n; i += 1) {
    if (reached[i]) continue;
    const x = i % width;
    const touches =
      (x > 0 && reached[i - 1]) ||
      (x < width - 1 && reached[i + 1]) ||
      (i >= width && reached[i - width]) ||
      (i < n - width && reached[i + width]);
    if (!touches) continue;
    const [r, g, b] = at(i);
    const lum = (r + g + b) / 3;
    if (lum > 200 && neutral(r, g, b)) rgba[i * 4 + 3] = Math.round(((255 - lum) / 55) * 255);
  }
  return true;
}

const files = process.argv.slice(2).length
  ? process.argv.slice(2)
  : readdirSync(ART_DIR)
      .filter((name) => name.endsWith(".webp"))
      .map((name) => path.join(ART_DIR, name));
const work = mkdtempSync(path.join(tmpdir(), "kachi-art-"));
let changed = 0;
let skipped = 0;
try {
  for (const file of files) {
    const pam = path.join(work, "in.pam");
    const out = path.join(work, "out.pam");
    execFileSync("dwebp", [file, "-pam", "-o", pam], { stdio: "ignore" });
    const img = readPam(pam);
    if (!strip(img)) {
      skipped += 1;
      continue;
    }
    writePam(out, img);
    // Encode beside the target and rename: an interrupted run never leaves a
    // half-written image in public/art.
    const encoded = `${file}.tmp`;
    execFileSync("cwebp", ["-q", "86", "-alpha_q", "100", "-m", "6", out, "-o", encoded], {
      stdio: "ignore",
    });
    renameSync(encoded, file);
    changed += 1;
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
console.log(`strip-art-background: ${changed} cleared, ${skipped} already transparent`);
