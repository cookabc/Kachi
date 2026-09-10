export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1440;

const SAFE = 72;
const CARD_PAD = 56;
const TEXT_MEASURE = CARD_WIDTH - SAFE * 2 - CARD_PAD * 2;
const EXAMPLE_PAD = 40;
const EXAMPLE_MEASURE = TEXT_MEASURE - EXAMPLE_PAD * 2;
const CONTENT_TOP = SAFE + CARD_PAD;
const CONTENT_BOTTOM = CARD_HEIGHT - SAFE - CARD_PAD;
const FOOTER_RESERVE = 88;
const TERM_LINE_CAP = 2;
const HAIRLINE_ZONE = 48;

const TIERS = [
  { term: 88, fork: 42, example: 38 },
  { term: 80, fork: 39, example: 36 },
  { term: 72, fork: 36, example: 34 },
] as const;

const KICKER_SIZE = 30;
const TERM_LH = 1.15;
const TEXT_LH = 1.45;

const FONT_STACK =
  "ui-rounded, 'Nunito', 'Trebuchet MS', 'Segoe UI', 'PingFang SC', 'Microsoft YaHei', sans-serif";

const COLOR = {
  sky: "#e8f7ff",
  mint: "#d8f8ec",
  card: "#ffffff",
  ink: "#1b2e24",
  inkSoft: "#4a6b58",
  muted: "#5f7d6e",
  line: "#dceee4",
  yellow: "#ffc800",
  greenSoft: "#e7ffd4",
  skyBlue: "#1cb0f6",
} as const;

export const HEDGEHOG_PATHS =
  '<path d="M18 34l-8-12 10 8-2-16 10 14 4-18 6 18 8-16 4 16 12-10-8 14 12-4-10 12" fill="#58CC02" />' +
  '<ellipse cx="38" cy="40" rx="20" ry="14" fill="#46A302" />' +
  '<ellipse cx="42" cy="44" rx="15" ry="11" fill="#FFE08A" />' +
  '<ellipse cx="54" cy="44" rx="5" ry="3.4" fill="#FFD56A" />' +
  '<circle cx="48" cy="42" r="1.8" fill="#1B2E24" />' +
  '<circle cx="56" cy="44" r="1.2" fill="#1B2E24" />' +
  '<path d="M50 47q4 3 8 0" stroke="#FF4B4B" stroke-width="1.4" fill="none" />' +
  '<circle cx="18" cy="42" r="3.2" fill="#FFE08A" />';

export interface PairCardInput {
  kicker: string;
  termA: string;
  forkA: string;
  termB: string;
  forkB: string;
  example: string;
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
  hairlineY: number;
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
  const lines: string[] = [];
  let line = "";
  let lineEm = 0;
  for (const atom of atoms) {
    if (atom.em > maxEm) return null;
    const withSpace =
      line.length > 0 && atom.spaceBefore && (!CJK.test(atom.text[0]) || !CJK.test(line[line.length - 1]));
    const sepEm = withSpace ? charEm(" ") : 0;
    if (line && lineEm + sepEm + atom.em > maxEm) {
      if (NO_LINE_START.test(atom.text)) {
        line += (withSpace ? " " : "") + atom.text;
        lineEm += sepEm + atom.em;
        continue;
      }
      let carry = "";
      let carryEm = 0;
      if (line.length > 1 && NO_LINE_END.test(line)) {
        carry = line[line.length - 1];
        carryEm = charEm(carry);
        line = line.slice(0, -1);
      }
      lines.push(line);
      line = carry + atom.text;
      lineEm = carryEm + atom.em;
    } else {
      line += (withSpace ? " " : "") + atom.text;
      lineEm += sepEm + atom.em;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : null;
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
    const termABase = kickerBase + KICKER_SIZE * DESCENT + 28 + sizes.term * ASCENT;
    const forkABase =
      termABase + (termA.length - 1) * termLh + sizes.term * DESCENT + 12 + sizes.fork * ASCENT;
    const hairlineY = forkABase + (forkA.length - 1) * forkLh + sizes.fork * DESCENT + 24 + HAIRLINE_ZONE / 2;
    const termBBase = hairlineY + HAIRLINE_ZONE / 2 + 24 + sizes.term * ASCENT;
    const forkBBase =
      termBBase + (termB.length - 1) * termLh + sizes.term * DESCENT + 12 + sizes.fork * ASCENT;
    const panelY = forkBBase + (forkB.length - 1) * forkLh + sizes.fork * DESCENT + 24;
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
      hairlineY: hairlineY + topY,
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
  const emit = (block: CardBlock, weight: number, fill: string, extra = "") =>
    textBlock(
      block.lines,
      innerX,
      block.firstBaseline,
      block.fontSize,
      block.lineHeight / block.fontSize,
      weight,
      fill,
      extra,
    );

  parts.push(emit(layout.kicker, 800, COLOR.skyBlue, ' letter-spacing="2"'));
  parts.push(emit(layout.termA, 900, COLOR.ink));
  parts.push(emit(layout.forkA, 700, COLOR.inkSoft));

  const chipW = 64;
  const chipH = 44;
  const hy = layout.hairlineY;
  parts.push(
    `<line x1="${innerX}" y1="${hy}" x2="${midX - chipW / 2 - 12}" y2="${hy}" stroke="${COLOR.line}" stroke-width="3"/>`,
    `<line x1="${midX + chipW / 2 + 12}" y1="${hy}" x2="${innerRight}" y2="${hy}" stroke="${COLOR.line}" stroke-width="3"/>`,
    `<rect x="${midX - chipW / 2}" y="${hy - chipH / 2}" width="${chipW}" height="${chipH}" rx="22" fill="${COLOR.yellow}"/>`,
    `<text x="${midX}" y="${hy + 11}" text-anchor="middle" font-family="${FONT_STACK}" font-size="32" font-weight="900" fill="${COLOR.ink}">≠</text>`,
  );

  parts.push(emit(layout.termB, 900, COLOR.ink));
  parts.push(emit(layout.forkB, 700, COLOR.inkSoft));

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
