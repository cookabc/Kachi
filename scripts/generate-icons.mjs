// Rasterizes public/icon.svg into the PNG set the OS install surfaces need:
// SVG alone can't cover apple-touch-icon (iOS ignores SVG there) or the
// maskable safe zone, so the manifest ships raster variants beside the source.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const source = readFileSync("public/icon.svg", "utf8");

// The rounded ground works for "any" icons, but masked surfaces (iOS home
// screen, Android launcher circles) need a full-bleed square, and the spike
// tip sits ~6% past the maskable safe circle, so the artwork shrinks to 0.92.
const MARK_RECT = 'rx="128"';
const MARK_ART = '<path d="M111';
const fullBleed = source.replace(MARK_RECT, 'rx="0"');
if (fullBleed === source) throw new Error(`icon.svg no longer matches ${MARK_RECT}`);
const masked = fullBleed
  .replace(MARK_ART, `<g transform="translate(256 256) scale(0.92) translate(-256 -256)">${MARK_ART}`)
  .replace("</svg>", "</g></svg>");
if (!masked.includes("</g></svg>")) throw new Error(`icon.svg no longer matches ${MARK_ART}`);

const variants = [
  { svg: source, size: 192, out: "public/icon-192.png" },
  { svg: source, size: 512, out: "public/icon-512.png" },
  { svg: masked, size: 512, out: "public/icon-maskable-512.png" },
  { svg: fullBleed, size: 180, out: "public/apple-touch-icon.png" },
];

const work = mkdtempSync(join(tmpdir(), "kachi-icons-"));
try {
  for (const [index, variant] of variants.entries()) {
    const svgPath = join(work, `v${index}.svg`);
    writeFileSync(svgPath, variant.svg);
    execFileSync(
      "rsvg-convert",
      ["-w", String(variant.size), "-h", String(variant.size), "-o", variant.out, svgPath],
      { stdio: "ignore" },
    );
    console.log(`wrote ${variant.out} (${variant.size}x${variant.size})`);
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}
