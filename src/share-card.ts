import { HEDGEHOG_PATHS, heroSceneInner } from "./art";

export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;
const SAFE = 72;
const CARD_PAD = 56;
const TEXT_MEASURE = CARD_WIDTH - SAFE * 2 - CARD_PAD * 2;
const EXAMPLE_PAD = 34;
const EXAMPLE_MEASURE = TEXT_MEASURE - EXAMPLE_PAD * 2;
const CONTENT_TOP = SAFE + CARD_PAD;
const CONTENT_BOTTOM = CARD_HEIGHT - SAFE - CARD_PAD;
const FOOTER_RESERVE = 72;
const TERM_LINE_CAP = 2;
const DUEL_ZONE = 130;
const DUEL_ART = 108;
const STAMP_R = 44;

const TIERS = [
  { term: 88, fork: 42, example: 38 },
  { term: 80, fork: 39, example: 36 },
  { term: 72, fork: 36, example: 34 },
] as const;

const KICKER_SIZE = 30;
const TERM_LH = 1.15;
const TEXT_LH = 1.4;

const FONT_STACK = "'Avenir Next', 'PingFang SC', 'Segoe UI', 'Microsoft YaHei', sans-serif";

const COLOR = {
  sky: "#fed2e1",
  mint: "#fff7ed",
  card: "#fdfdff",
  ink: "#182449",
  inkSoft: "#56468b",
  muted: "#777b84",
  line: "#e3dfe6",
  yellow: "#ffc53d",
  greenSoft: "#ddf9f2",
  green: "#ec5a72",
  greenDeep: "#ca244d",
  skyBlue: "#3e63dd",
} as const;

export interface PairCardInput {
  kicker: string;
  termA: string;
  forkA: string;
  termB: string;
  forkB: string;
  example: string;
  artA?: string;
  artB?: string;
}

export interface CardBlock {
  lines: string[];
  fontSize: number;
  lineHeight: number;
  firstBaseline: number;
}

export interface PairCardLayout {
  tier: number;
  sizes: { term: number; fork: number; example: number };
  kicker: CardBlock;
  termA: CardBlock;
  forkA: CardBlock;
  termB: CardBlock;
  forkB: CardBlock;
  example: CardBlock;
  duelY: number;
  panel: { y: number; height: number };
  flowHeight: number;
  topY: number;
}

const CJK = /[ᄀ-ᅟ⺀-〾぀-ヿ㐀-䶿一-鿿ꥠ-꥿가-힯豈-﫿︰-﹏＀-｠￠-￦—‘’“”「」『』、。，；：？！…《》〈〉【】]/;

function charEm(ch: string): number {
  if (CJK.test(ch)) return 1.04;
  if (ch === " ") return 0.36;
  if (ch === "-") return 0.44;
  if (/[A-Za-z0-9]/.test(ch)) return 0.64;
  return 0.5;
}

export function measureText(text: string, fontSize: number): number {
  let em = 0;
  for (const ch of text) em += charEm(ch);
  return em * fontSize;
}

interface Atom {
  text: string;
  em: number;
  spaceBefore: boolean;
}

function tokenize(text: string): Atom[] {
  const atoms: Atom[] = [];
  if (!CJK.test(text)) {
    for (const word of text.split(" ")) {
      if (!word) continue;
      let segment = "";
      let first = true;
      for (const ch of word) {
        segment += ch;
        if (ch === "-" && segment.length < word.length) {
          atoms.push({ text: segment, em: widthEm(segment), spaceBefore: first });
          segment = "";
          first = false;
        }
      }
      if (segment) atoms.push({ text: segment, em: widthEm(segment), spaceBefore: first });
    }
    return atoms;
  }
  let latin = "";
  let pendingSpace = false;
  const push = (atomText: string, em: number) => {
    atoms.push({ text: atomText, em, spaceBefore: pendingSpace });
    pendingSpace = false;
  };
  for (const ch of text) {
    if (ch === " ") {
      if (latin) {
        push(latin, widthEm(latin));
        latin = "";
      }
      pendingSpace = true;
      continue;
    }
    if (CJK.test(ch)) {
      if (latin) {
        push(latin, widthEm(latin));
        latin = "";
      }
      push(ch, charEm(ch));
    } else {
      latin += ch;
    }
  }
  if (latin) push(latin, widthEm(latin));
  return atoms;
}

function widthEm(text: string): number {
  let em = 0;
  for (const ch of text) em += charEm(ch);
  return em;
}

const NO_LINE_START = /^[，。；：？！、…」』）》〉”’]/;
const NO_LINE_END = /[「『（《〈“‘]$/;

export function wrapText(text: string, fontSize: number, measure: number): string[] | null {
  const maxEm = measure / fontSize;
  const atoms = tokenize(text.trim());
  const lines: Atom[][] = [];
  let line: Atom[] = [];
  let lineEm = 0;
  for (const atom of atoms) {
    if (atom.em > maxEm) return null;
    const sepEm =
      line.length > 0 && atom.spaceBefore && needsSpace(line[line.length - 1], atom) ? charEm(" ") : 0;
    if (line.length && lineEm + sepEm + atom.em > maxEm) {
      if (NO_LINE_START.test(atom.text)) {
        line.push(atom);
        lineEm += sepEm + atom.em;
        continue;
      }
      let carry: Atom[] = [];
      let carryEm = 0;
      const tail = line[line.length - 1];
      if (line.length > 1 && NO_LINE_END.test(tail.text)) {
        carry = [line.pop() as Atom];
        carryEm = tail.em;
      }
      lines.push(line);
      line = [...carry, atom];
      lineEm = carryEm + atom.em;
    } else {
      line.push(atom);
      lineEm += sepEm + atom.em;
    }
  }
  if (line.length) lines.push(line);
  if (!lines.length) return null;
  rebalanceLastLine(lines, maxEm);
  return lines.map(joinAtoms);
}

function needsSpace(prev: Atom, next: Atom): boolean {
  return !CJK.test(next.text[0]) || !CJK.test(prev.text[prev.text.length - 1]);
}

function joinAtoms(atoms: Atom[]): string {
  let out = "";
  for (const atom of atoms) {
    if (out.length > 0 && atom.spaceBefore && needsSpace({ text: out, em: 0, spaceBefore: false }, atom))
      out += " ";
    out += atom.text;
  }
  return out;
}

// A last line shorter than 30% of the measure reads as an orphan ("掉。").
// Pull atoms back from the previous line until it clears the threshold —
// never creating a line that starts with closing punctuation, and never
// exceeding the measure on the last line.
function rebalanceLastLine(lines: Atom[][], maxEm: number): void {
  if (lines.length < 2) return;
  const last = lines[lines.length - 1];
  const prev = lines[lines.length - 2];
  let lastEm = 0;
  for (const atom of last) lastEm += atom.em;
  while (lastEm < maxEm * 0.3 && prev.length > 1) {
    const atom = prev[prev.length - 1];
    if (NO_LINE_START.test(atom.text)) break;
    if (lastEm + atom.em > maxEm) break;
    prev.pop();
    last.unshift(atom);
    lastEm += atom.em;
  }
}

function latinUpper(text: string): string {
  return text.replace(/[a-z]/g, (ch) => ch.toUpperCase());
}

const ASCENT = 0.8;
const DESCENT = 0.25;

export function layoutPairCard(input: PairCardInput): PairCardLayout | null {
  const kickerLines = wrapText(latinUpper(input.kicker), KICKER_SIZE, TEXT_MEASURE);
  if (kickerLines?.length !== 1) return null;
  const budget = CONTENT_BOTTOM - CONTENT_TOP - FOOTER_RESERVE;
  for (let tier = 0; tier < TIERS.length; tier++) {
    const sizes = TIERS[tier];
    const termA = wrapText(input.termA, sizes.term, TEXT_MEASURE);
    const termB = wrapText(input.termB, sizes.term, TEXT_MEASURE);
    const forkA = wrapText(input.forkA, sizes.fork, TEXT_MEASURE);
    const forkB = wrapText(input.forkB, sizes.fork, TEXT_MEASURE);
    const example = wrapText(input.example, sizes.example, EXAMPLE_MEASURE);
    if (!termA || !termB || !forkA || !forkB || !example) continue;
    if (termA.length > TERM_LINE_CAP || termB.length > TERM_LINE_CAP) continue;
    const termLh = sizes.term * TERM_LH;
    const forkLh = sizes.fork * TEXT_LH;
    const exampleLh = sizes.example * TEXT_LH;
    const kickerBase = KICKER_SIZE * ASCENT;
    const termABase = kickerBase + KICKER_SIZE * DESCENT + 22 + sizes.term * ASCENT;
    const forkABase =
      termABase + (termA.length - 1) * termLh + sizes.term * DESCENT + 10 + sizes.fork * ASCENT;
    const duelY = forkABase + (forkA.length - 1) * forkLh + sizes.fork * DESCENT + 18 + DUEL_ZONE / 2;
    const termBBase = duelY + DUEL_ZONE / 2 + 18 + sizes.term * ASCENT;
    const forkBBase =
      termBBase + (termB.length - 1) * termLh + sizes.term * DESCENT + 10 + sizes.fork * ASCENT;
    const panelY = forkBBase + (forkB.length - 1) * forkLh + sizes.fork * DESCENT + 18;
    const panelHeight =
      EXAMPLE_PAD * 2 + (example.length - 1) * exampleLh + sizes.example * (ASCENT + DESCENT);
    const flowHeight = panelY + panelHeight;
    if (flowHeight > budget) continue;
    const topY = CONTENT_TOP + Math.max(0, (budget - flowHeight) / 2);
    const block = (
      lines: string[],
      fontSize: number,
      lineHeight: number,
      firstBaseline: number,
    ): CardBlock => ({
      lines,
      fontSize,
      lineHeight,
      firstBaseline: firstBaseline + topY,
    });
    return {
      tier,
      sizes: { ...sizes },
      kicker: block(kickerLines, KICKER_SIZE, KICKER_SIZE * 1.2, kickerBase),
      termA: block(termA, sizes.term, termLh, termABase),
      forkA: block(forkA, sizes.fork, forkLh, forkABase),
      termB: block(termB, sizes.term, termLh, termBBase),
      forkB: block(forkB, sizes.fork, forkLh, forkBBase),
      example: block(example, sizes.example, exampleLh, panelY + EXAMPLE_PAD + sizes.example * ASCENT),
      duelY: duelY + topY,
      panel: { y: panelY + topY, height: panelHeight },
      flowHeight,
      topY,
    };
  }
  return null;
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function textBlock(
  lines: string[],
  x: number,
  y: number,
  fontSize: number,
  lineHeight: number,
  weight: number,
  fill: string,
  extra = "",
): string {
  const tspans = lines
    .map(
      (line, i) => `<tspan x="${x}" dy="${i === 0 ? 0 : fontSize * lineHeight}">${escapeXml(line)}</tspan>`,
    )
    .join("");
  return `<text y="${y}" font-family="${FONT_STACK}" font-size="${fontSize}" font-weight="${weight}" fill="${fill}"${extra}>${tspans}</text>`;
}

export function buildPairCardSvg(input: PairCardInput): string {
  const layout = layoutPairCard(input);
  if (!layout) throw new Error(`pair card does not fit at floor size: ${input.termA} vs ${input.termB}`);
  const innerX = SAFE + CARD_PAD;
  const innerRight = CARD_WIDTH - SAFE - CARD_PAD;
  const midX = CARD_WIDTH / 2;
  const parts: string[] = [];
  const emit = (block: CardBlock, weight: number, fill: string, extra = "", x = innerX) =>
    textBlock(
      block.lines,
      x,
      block.firstBaseline,
      block.fontSize,
      block.lineHeight / block.fontSize,
      weight,
      fill,
      extra,
    );

  parts.push(emit(layout.kicker, 800, COLOR.skyBlue, ' letter-spacing="2" text-anchor="middle"', midX));
  parts.push(emit(layout.termA, 900, COLOR.ink, ' text-anchor="middle"', midX));
  parts.push(emit(layout.forkA, 700, COLOR.inkSoft, ' text-anchor="middle"', midX));

  const dy = layout.duelY;
  const sceneA = input.artA ? heroSceneInner(input.artA) : null;
  const sceneB = input.artB ? heroSceneInner(input.artB) : null;
  if (sceneA || sceneB) {
    const scale = DUEL_ART / 64;
    if (sceneA)
      parts.push(
        `<g class="duel-art" transform="translate(${midX - STAMP_R - 28 - DUEL_ART} ${dy - DUEL_ART / 2}) scale(${scale})">${sceneA}</g>`,
      );
    if (sceneB)
      parts.push(
        `<g class="duel-art" transform="translate(${midX + STAMP_R + 28} ${dy - DUEL_ART / 2}) scale(${scale})">${sceneB}</g>`,
      );
  } else {
    parts.push(
      `<line x1="${innerX}" y1="${dy}" x2="${midX - STAMP_R - 12}" y2="${dy}" stroke="${COLOR.line}" stroke-width="3"/>`,
      `<line x1="${midX + STAMP_R + 12}" y1="${dy}" x2="${innerRight}" y2="${dy}" stroke="${COLOR.line}" stroke-width="3"/>`,
    );
  }
  parts.push(
    `<circle cx="${midX}" cy="${dy + 5}" r="${STAMP_R}" fill="${COLOR.greenDeep}"/>`,
    `<circle cx="${midX}" cy="${dy}" r="${STAMP_R}" fill="#fdfdff" stroke="${COLOR.green}" stroke-width="7"/>`,
    `<text x="${midX}" y="${dy + 17}" text-anchor="middle" font-family="${FONT_STACK}" font-size="52" font-weight="900" fill="${COLOR.greenDeep}">≠</text>`,
  );

  parts.push(emit(layout.termB, 900, COLOR.ink, ' text-anchor="middle"', midX));
  parts.push(emit(layout.forkB, 700, COLOR.inkSoft, ' text-anchor="middle"', midX));

  parts.push(
    `<rect x="${innerX}" y="${layout.panel.y}" width="${TEXT_MEASURE}" height="${layout.panel.height}" rx="24" fill="${COLOR.greenSoft}"/>`,
  );
  parts.push(
    textBlock(
      layout.example.lines,
      innerX + EXAMPLE_PAD,
      layout.example.firstBaseline,
      layout.example.fontSize,
      layout.example.lineHeight / layout.example.fontSize,
      700,
      COLOR.ink,
    ),
  );

  const hedgeH = 56;
  const hedgeScale = hedgeH / 64;
  const hedgeW = 72 * hedgeScale;
  const wordmark = "Kachi";
  const wordmarkW = measureText(wordmark, 34);
  const footerW = hedgeW + 16 + wordmarkW;
  const footerX = midX - footerW / 2;
  const footerY = CONTENT_BOTTOM - hedgeH;
  parts.push(
    `<g transform="translate(${footerX} ${footerY}) scale(${hedgeScale})">${HEDGEHOG_PATHS}</g>`,
    `<text x="${footerX + hedgeW + 16}" y="${footerY + hedgeH / 2 + 12}" font-family="${FONT_STACK}" font-size="34" font-weight="800" fill="${COLOR.muted}">${wordmark}</text>`,
  );

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_WIDTH}" height="${CARD_HEIGHT}" viewBox="0 0 ${CARD_WIDTH} ${CARD_HEIGHT}">`,
    `<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${COLOR.sky}"/><stop offset="1" stop-color="${COLOR.mint}"/></linearGradient></defs>`,
    `<rect width="${CARD_WIDTH}" height="${CARD_HEIGHT}" fill="url(#bg)"/>`,
    `<rect x="${SAFE}" y="${SAFE + 12}" width="${CARD_WIDTH - SAFE * 2}" height="${CARD_HEIGHT - SAFE * 2}" rx="32" fill="${COLOR.ink}" opacity="0.08"/>`,
    `<rect x="${SAFE}" y="${SAFE}" width="${CARD_WIDTH - SAFE * 2}" height="${CARD_HEIGHT - SAFE * 2}" rx="32" fill="${COLOR.card}"/>`,
    ...parts,
    `</svg>`,
  ].join("");
}
