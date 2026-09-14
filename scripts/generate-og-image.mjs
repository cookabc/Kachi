// Generates the Open Graph image (1200x630) shown when the app URL is posted
// to X/Twitter etc. Run: pnpm generate:og
// The script composes the duel-poster SVG from the same art assets as the app
// (hero scenes + hedgehog, extracted from src/art.tsx), then rasterizes it with
// macOS qlmanage — the PNG is a committed asset (public/og-image.png), so CI
// never needs to run this.
import { execFileSync } from "node:child_process";
import { readFileSync, rmSync, writeFileSync } from "node:fs";

const source = readFileSync(new URL("../src/art.tsx", import.meta.url), "utf8");
function extract(pattern) {
  const match = source.match(pattern);
  if (!match) throw new Error("art.tsx structure changed — update the extractor");
  return match[0];
}
const groundLiteral = source.match(/const GROUND = ('[^']*');/)?.[1];
if (!groundLiteral) throw new Error("art.tsx structure changed — GROUND not found");
const haloFn = extract(/function halo\(color: string\) \{[\s\S]*?\n\}/).replace(
  "function halo(color: string)",
  "function (color)",
);
// biome-ignore lint/security/noGlobalEval: build-time asset extraction from our own source file
const HEDGEHOG_PATHS = eval(
  `(${extract(/export const HEDGEHOG_PATHS =[\s\S]*?;/)
    .replace("export const HEDGEHOG_PATHS =", "")
    .replace(/;$/, "")})`,
);
const heroBlock = extract(/export const HERO_ART[\s\S]*?\n\};/)
  .replace("export const", "const")
  .replace(": Record<string, string>", "");
// biome-ignore lint/security/noGlobalEval: same as above
const HERO_ART = eval(`(() => {
  const termSvg = (inner) => \`<svg viewBox="0 0 64 64">\${inner}</svg>\`;
  const GROUND = ${groundLiteral};
  const halo = ${haloFn};
  ${heroBlock};
  return HERO_ART;
})()`);

function scene(id, x, y, size) {
  const inner = HERO_ART[id].replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
  return `<g transform="translate(${x} ${y}) scale(${size / 64})">${inner}</g>`;
}

const W = 1200;
const H = 630;
const FONT_STACK =
  "ui-rounded, 'Nunito', 'Trebuchet MS', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";
const INK = "#1b2e24";
const INK_SOFT = "#4a6b58";
const MUTED = "#5f7d6e";
const GREEN = "#58cc02";
const GREEN_DEEP = "#46a302";
const ART = 200;
const STAMP_R = 52;
const DUEL_CX = 890;
const DUEL_CY = 300;

const stamp = [
  `<circle cx="${DUEL_CX}" cy="${DUEL_CY + 6}" r="${STAMP_R}" fill="${GREEN_DEEP}"/>`,
  `<circle cx="${DUEL_CX}" cy="${DUEL_CY}" r="${STAMP_R}" fill="#fff" stroke="${GREEN}" stroke-width="8"/>`,
  `<text x="${DUEL_CX}" y="${DUEL_CY + 22}" text-anchor="middle" font-family="${FONT_STACK}" font-size="64" font-weight="900" fill="${GREEN_DEEP}">≠</text>`,
].join("");

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8f7ff"/><stop offset="1" stop-color="#d8f8ec"/></linearGradient>`,
  `<radialGradient id="glow" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#ffc800" stop-opacity="0.28"/><stop offset="0.7" stop-color="#ffc800" stop-opacity="0"/></radialGradient></defs>`,
  `<rect width="${W}" height="${H}" fill="url(#bg)"/>`,
  `<circle cx="${DUEL_CX}" cy="${DUEL_CY}" r="230" fill="url(#glow)"/>`,
  `<g transform="translate(84 96) scale(1.5)">${HEDGEHOG_PATHS}</g>`,
  `<text x="84" y="300" font-family="${FONT_STACK}" font-size="96" font-weight="900" fill="${INK}" letter-spacing="-2">Kachi</text>`,
  `<text x="84" y="376" font-family="${FONT_STACK}" font-size="44" font-weight="800" fill="${INK_SOFT}">分清易混的财经英语。</text>`,
  `<text x="84" y="436" font-family="${FONT_STACK}" font-size="34" font-weight="700" fill="${MUTED}">五分钟，没有投资建议。</text>`,
  scene("hedge", DUEL_CX - STAMP_R - 32 - ART, DUEL_CY - ART / 2, ART),
  scene("pledge", DUEL_CX + STAMP_R + 32, DUEL_CY - ART / 2, ART),
  stamp,
  `<text x="${DUEL_CX - STAMP_R - 32 - ART / 2}" y="${DUEL_CY + ART / 2 + 52}" text-anchor="middle" font-family="${FONT_STACK}" font-size="34" font-weight="800" fill="${INK}">hedge</text>`,
  `<text x="${DUEL_CX + STAMP_R + 32 + ART / 2}" y="${DUEL_CY + ART / 2 + 52}" text-anchor="middle" font-family="${FONT_STACK}" font-size="34" font-weight="800" fill="${INK}">pledge</text>`,
  `</svg>`,
].join("");

const svgPath = "public/og-image.svg";
const pngPath = "public/og-image.png";
writeFileSync(svgPath, svg);
try {
  execFileSync("rsvg-convert", ["-w", "1200", "-o", pngPath, svgPath], { stdio: "ignore" });
  rmSync(svgPath);
  console.log(`wrote ${pngPath}`);
} catch {
  console.log(`rsvg-convert unavailable — rasterize ${svgPath} to ${pngPath} manually (1200x630)`);
}
