// Deterministic social preview for the candy (Dopa-style) reskin. No remote assets or fonts.
import { execFileSync } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";

const WIDTH = 1200;
const HEIGHT = 630;
const INK = "#1b1d4d";
const PAPER = "#fff8ec";
const CORAL = "#ff7ab6";
const BLUE = "#3b6bff";
const MUTED = "#6b6f99";
const PINK2 = "#ff7ab6";

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">`,
  `<defs><pattern id="grid" width="52" height="52" patternUnits="userSpaceOnUse"><path d="M 52 0 L 0 0 0 52" fill="none" stroke="${INK}" stroke-opacity=".08" stroke-width="1"/></pattern></defs>`,
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>`,
  `<rect width="${WIDTH}" height="${HEIGHT}" fill="url(#grid)"/>`,
  `<circle cx="1090" cy="120" r="285" fill="none" stroke="${INK}" stroke-opacity=".12"/>`,
  `<circle cx="1090" cy="120" r="205" fill="none" stroke="${INK}" stroke-opacity=".1"/>`,
  `<circle cx="88" cy="79" r="7" fill="${CORAL}"/>`,
  `<text x="112" y="86" fill="${MUTED}" font-family="Menlo,monospace" font-size="19" letter-spacing="3">THE CONTRAST LAB / 01</text>`,
  `<text x="1020" y="86" fill="${MUTED}" font-family="Menlo,monospace" font-size="19" text-anchor="end" letter-spacing="2">KACHI*</text>`,
  `<text x="84" y="295" fill="${INK}" font-family="'Dela Gothic One',sans-serif" font-size="128" letter-spacing="-6">HEDGE</text>`,
  `<path d="M 610 147 L 568 325" stroke="${CORAL}" stroke-width="12" stroke-linecap="round"/>`,
  `<text x="84" y="463" fill="${INK}" font-family="'Dela Gothic One',sans-serif" font-size="128" letter-spacing="-6">PLEDGE<tspan fill="${CORAL}">.</tspan></text>`,
  `<line x1="84" y1="509" x2="1116" y2="509" stroke="${PAPER}" stroke-opacity=".25"/>`,
  `<text x="84" y="562" fill="${BLUE}" font-family="Menlo,monospace" font-size="20" letter-spacing="2">01 / 对冲风险</text>`,
  `<text x="414" y="562" fill="${MUTED}" font-family="Menlo,monospace" font-size="20" letter-spacing="2">≠</text>`,
  `<text x="484" y="562" fill="${PINK2}" font-family="Menlo,monospace" font-size="20" letter-spacing="2">02 / 抵押资产</text>`,
  `<text x="1116" y="562" fill="${MUTED}" font-family="Menlo,monospace" font-size="18" text-anchor="end" letter-spacing="1">财经英语 · 不靠背，靠分辨</text>`,
  `</svg>`,
].join("");

const svgPath = "public/og-image.svg";
const pngPath = "public/og-image.png";
writeFileSync(svgPath, svg);
try {
  execFileSync("rsvg-convert", ["-w", String(WIDTH), "-o", pngPath, svgPath], { stdio: "ignore" });
  rmSync(svgPath);
  console.log(`wrote ${pngPath}`);
} catch {
  console.log(`rsvg-convert unavailable — rasterize ${svgPath} to ${pngPath} manually`);
}
