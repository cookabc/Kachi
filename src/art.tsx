// Term art, aliases, and mascot ported verbatim from the original single-file
// prototype so the React app renders the same palette SVGs.
export const HEDGEHOG_PATHS =
  '<path d="M18 34l-8-12 10 8-2-16 10 14 4-18 6 18 8-16 4 16 12-10-8 14 12-4-10 12" fill="#58CC02" />' +
  '<ellipse cx="38" cy="40" rx="20" ry="14" fill="#46A302" />' +
  '<ellipse cx="42" cy="44" rx="15" ry="11" fill="#FFE08A" />' +
  '<ellipse cx="54" cy="44" rx="5" ry="3.4" fill="#FFD56A" />' +
  '<circle cx="48" cy="42" r="1.8" fill="#1B2E24" />' +
  '<circle cx="56" cy="44" r="1.2" fill="#1B2E24" />' +
  '<path d="M50 47q4 3 8 0" stroke="#FF4B4B" stroke-width="1.4" fill="none" />' +
  '<circle cx="18" cy="42" r="3.2" fill="#FFE08A" />';

function termSvg(inner: string) {
  return `<svg viewBox="0 0 64 64" class="term-svg" aria-hidden="true">${inner}</svg>`;
}
export const TERM_ART: Record<string, string> = {
  hedge: termSvg(
    '<path d="M6 54 Q16 34 32 34 Q48 34 58 54 Z" fill="#58CC02"/><path d="M12 52 Q20 38 32 38 Q44 38 52 52 Z" fill="#89E219"/><rect x="14" y="34" width="36" height="22" rx="4" fill="#FFC800"/><rect x="14" y="34" width="36" height="7" rx="3" fill="#FFD966"/><circle cx="32" cy="46" r="6" fill="#E6A100"/><path d="M32 8 Q50 8 52 30 L12 30 Q14 8 32 8 Z" fill="#1CB0F6"/><path d="M32 30 L32 40" stroke="#1899D6" stroke-width="5" stroke-linecap="round"/><path d="M8 16 l-3 -5 M14 12 l-2 -6 M22 10 l-1 -6 M42 10 l1 -6 M50 12 l2 -6 M56 16 l3 -5" stroke="#FF8A65" stroke-width="3.4" stroke-linecap="round"/>',
  ),
  pledge: termSvg(
    '<rect x="6" y="24" width="30" height="26" rx="4" fill="#FFC800"/><rect x="6" y="24" width="30" height="7" rx="3" fill="#FFD966"/><circle cx="21" cy="37" r="5.5" fill="#E6A100"/><rect x="36" y="20" width="22" height="34" rx="4" fill="#46A302"/><rect x="40" y="24" width="14" height="12" rx="2" fill="#89E219"/><circle cx="47" cy="30" r="3" fill="#FFC800"/><path d="M36 46 h22 v8 h-22 z" fill="#3D8C00"/><path d="M36 14 q12 -8 24 0 l-4 8 q-8 -5 -16 0 Z" fill="#1CB0F6"/><path d="M18 8 v10 M24 8 v10" stroke="#8AA396" stroke-width="4" stroke-linecap="round"/>',
  ),
  haircut: termSvg(
    '<rect x="6" y="26" width="34" height="26" rx="4" fill="#FFC800"/><rect x="6" y="26" width="34" height="7" rx="3" fill="#FFD966"/><circle cx="23" cy="39" r="6" fill="#E6A100"/><path d="M46 8 q10 0 10 10 q0 8 -8 8 l-14 0 q-6 0 -6 -6 q0 -6 6 -6 l16 0" fill="none" stroke="#FF8A65" stroke-width="7" stroke-linecap="round"/><path d="M40 34 L58 52" stroke="#1CB0F6" stroke-width="6" stroke-linecap="round"/><path d="M40 52 L58 34" stroke="#1CB0F6" stroke-width="6" stroke-linecap="round" opacity=".55"/>',
  ),
  put: termSvg(
    '<path d="M10 50 Q20 30 32 30 Q44 30 54 50 Z" fill="#58CC02"/><path d="M16 48 Q24 36 32 36 Q40 36 48 48 Z" fill="#89E219"/><path d="M32 30 L32 20" stroke="#1899D6" stroke-width="6" stroke-linecap="round"/><path d="M10 18 Q32 2 54 18 L54 26 Q32 12 10 26 Z" fill="#1CB0F6"/>',
  ),
  call: termSvg(
    '<path d="M8 52 L24 34 L34 42 L54 20" fill="none" stroke="#58CC02" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><path d="M40 16 L56 16 L56 32" fill="none" stroke="#58CC02" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/><circle cx="24" cy="34" r="5" fill="#FFC800"/><circle cx="34" cy="42" r="5" fill="#FFC800"/>',
  ),
  "margin call": termSvg(
    '<circle cx="14" cy="46" r="9" fill="#FFC800"/><rect x="11" y="28" width="6" height="12" rx="3" fill="#FFD966"/><path d="M14 14 a14 14 0 0 1 14 14 l-6 0 a8 8 0 0 0 -16 0 l-6 0 a14 14 0 0 1 14 -14 Z" fill="#FF8A65"/><rect x="30" y="12" width="26" height="34" rx="5" fill="#1CB0F6"/><rect x="34" y="17" width="18" height="8" rx="2" fill="#E8F7FF"/><path d="M38 32 h10 M38 38 h14" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M8 56 h48" stroke="#46A302" stroke-width="4" stroke-linecap="round"/>',
  ),
  collateral: termSvg(
    '<rect x="8" y="24" width="48" height="30" rx="6" fill="#FFC800"/><rect x="8" y="24" width="48" height="8" rx="4" fill="#E6A100"/><rect x="20" y="14" width="24" height="14" rx="3" fill="#1CB0F6"/><circle cx="32" cy="38" r="8" fill="#58CC02"/><rect x="29.5" y="36" width="5" height="9" rx="1.5" fill="#fff"/><circle cx="32" cy="35" r="2.2" fill="#fff"/>',
  ),
  margin: termSvg(
    '<rect x="10" y="10" width="16" height="44" rx="5" fill="#58CC02"/><rect x="38" y="26" width="16" height="28" rx="5" fill="#1CB0F6"/><rect x="26" y="28" width="12" height="16" rx="6" fill="#FFC800"/>',
  ),
  leverage: termSvg(
    '<polygon points="32,38 22,54 42,54" fill="#1CB0F6"/><rect x="6" y="30" width="52" height="8" rx="4" fill="#FFC800" transform="rotate(-12 32 34)"/><circle cx="14" cy="24" r="7" fill="#FF8A65"/><rect x="42" y="8" width="16" height="20" rx="4" fill="#58CC02"/>',
  ),
  derivative: termSvg(
    '<rect x="18" y="10" width="34" height="42" rx="4" fill="#E8F7FF" stroke="#1CB0F6" stroke-width="3"/><path d="M24 40 L32 28 L40 34 L48 18" fill="none" stroke="#58CC02" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M8 22 L22 16 L22 52 L8 46 Z" fill="#FFC800" opacity=".85"/><path d="M12 40 L16 32 L20 36" fill="none" stroke="#46A302" stroke-width="2.4" stroke-linecap="round"/>',
  ),
  option: termSvg(
    '<rect x="8" y="18" width="48" height="28" rx="6" fill="#FFC800"/><rect x="8" y="18" width="12" height="28" rx="6" fill="#1CB0F6"/><circle cx="20" cy="32" r="6" fill="#E8F7FF"/><circle cx="38" cy="32" r="3.2" fill="#fff"/><circle cx="48" cy="32" r="3.2" fill="#fff"/>',
  ),
  "short selling": termSvg(
    '<circle cx="26" cy="28" r="14" fill="#FFC800"/><circle cx="26" cy="28" r="8" fill="#FFE08A"/><path d="M40 14 L52 36 L28 36 Z" fill="#FF8A65"/><rect x="42" y="36" width="8" height="16" rx="2" fill="#FF8A65"/>',
  ),
  liquidity: termSvg(
    '<rect x="10" y="8" width="22" height="10" rx="4" fill="#1CB0F6"/><rect x="24" y="14" width="8" height="14" rx="3" fill="#1899D6"/><path d="M28 28 q4 10 0 20" fill="none" stroke="#1CB0F6" stroke-width="5" stroke-linecap="round"/><rect x="22" y="42" width="32" height="16" rx="4" fill="#58CC02"/><rect x="22" y="42" width="32" height="6" rx="3" fill="#46A302"/>',
  ),
  notional: termSvg(
    '<rect x="6" y="10" width="52" height="36" rx="8" fill="none" stroke="#58CC02" stroke-width="5"/><circle cx="18" cy="54" r="5" fill="#FFC800"/><circle cx="28" cy="56" r="4" fill="#FF8A65"/><circle cx="22" cy="58" r="3.2" fill="#1CB0F6"/>',
  ),
  premium: termSvg(
    '<rect x="22" y="14" width="34" height="22" rx="5" fill="#1CB0F6"/><circle cx="22" cy="25" r="5" fill="#E8F7FF"/><circle cx="22" cy="44" r="14" fill="#FFC800"/><circle cx="22" cy="44" r="8" fill="#FFE08A"/>',
  ),
  yield: termSvg(
    '<circle cx="32" cy="46" r="12" fill="#FFC800"/><path d="M32 40 C32 22 18 18 18 12" fill="none" stroke="#58CC02" stroke-width="5" stroke-linecap="round"/><path d="M32 28 C24 24 20 28 16 24" fill="none" stroke="#89E219" stroke-width="4" stroke-linecap="round"/><path d="M32 22 C40 16 46 20 48 14" fill="none" stroke="#46A302" stroke-width="4" stroke-linecap="round"/><circle cx="18" cy="12" r="4" fill="#58CC02"/><circle cx="48" cy="14" r="4" fill="#89E219"/>',
  ),
  duration: termSvg(
    '<circle cx="10" cy="32" r="8" fill="#1CB0F6"/><circle cx="54" cy="32" r="8" fill="#1CB0F6"/><path d="M16 32 C24 12 40 12 48 32 C40 52 24 52 16 32" fill="none" stroke="#FFC800" stroke-width="6"/>',
  ),
  "basis risk": termSvg(
    '<circle cx="16" cy="16" r="8" fill="#FFC800"/><path d="M8 36 C16 20 28 20 32 36 L32 44 L8 44 Z" fill="#58CC02"/><ellipse cx="50" cy="16" rx="12" ry="8" fill="#1CB0F6"/><path d="M44 26 v18 M50 24 v22 M56 26 v18" stroke="#1CB0F6" stroke-width="3" stroke-linecap="round"/>',
  ),
  long: termSvg(
    '<circle cx="20" cy="18" r="8" fill="#FFC800"/><rect x="14" y="26" width="12" height="22" rx="6" fill="#1CB0F6"/><path d="M30 40 L46 18 L40 18 L40 10 L56 10 L56 26 L48 26 L48 18 L34 40 Z" fill="#58CC02"/>',
  ),
  volatility: termSvg(
    '<rect x="6" y="8" width="52" height="48" rx="10" fill="#E8F7FF"/><path d="M10 40 L20 18 L28 46 L38 14 L46 36 L54 22" fill="none" stroke="#FF8A65" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  diversification: termSvg(
    '<ellipse cx="16" cy="42" rx="12" ry="8" fill="#FFC800"/><ellipse cx="32" cy="48" rx="12" ry="8" fill="#1CB0F6"/><ellipse cx="48" cy="42" rx="12" ry="8" fill="#58CC02"/><ellipse cx="16" cy="34" rx="6" ry="8" fill="#FFF6D0"/><ellipse cx="32" cy="40" rx="6" ry="8" fill="#E8F7FF"/><ellipse cx="48" cy="34" rx="6" ry="8" fill="#E7FFD4"/>',
  ),
  counterparty: termSvg(
    '<circle cx="18" cy="16" r="8" fill="#FFC800"/><circle cx="46" cy="16" r="8" fill="#1CB0F6"/><rect x="10" y="26" width="16" height="22" rx="8" fill="#FFC800"/><rect x="38" y="26" width="16" height="22" rx="8" fill="#1CB0F6"/><rect x="20" y="36" width="24" height="8" rx="4" fill="#58CC02"/>',
  ),
  default: termSvg(
    '<circle cx="16" cy="16" r="8" fill="#FFC800"/><circle cx="48" cy="16" r="8" fill="#1CB0F6"/><rect x="8" y="26" width="16" height="22" rx="8" fill="#FFC800"/><rect x="40" y="26" width="16" height="22" rx="8" fill="#1CB0F6"/><path d="M22 38 L42 38" stroke="#FF8A65" stroke-width="5" stroke-linecap="round"/><path d="M32 30 L32 46" stroke="#FF8A65" stroke-width="4" stroke-linecap="round"/>',
  ),
  "mark-to-market": termSvg(
    '<path d="M18 12 L46 12 L54 24 L32 56 L10 24 Z" fill="#FFC800"/><path d="M24 12 L46 12 L52 22 L36 22 Z" fill="#1CB0F6"/><circle cx="32" cy="30" r="7" fill="#fff"/><path d="M32 24 L32 36 M26 30 L38 30" stroke="#58CC02" stroke-width="3" stroke-linecap="round"/>',
  ),
  "securities-backed loan": termSvg(
    '<rect x="8" y="18" width="28" height="34" rx="4" fill="#1CB0F6"/><rect x="8" y="18" width="28" height="10" rx="4" fill="#1899D6"/><rect x="14" y="32" width="6" height="8" rx="1" fill="#fff"/><rect x="24" y="32" width="6" height="8" rx="1" fill="#fff"/><rect x="36" y="28" width="20" height="24" rx="3" fill="#FFC800"/><rect x="40" y="34" width="12" height="3" fill="#fff"/><rect x="40" y="40" width="12" height="3" fill="#fff"/><circle cx="22" cy="14" r="6" fill="#58CC02"/>',
  ),
  "capital gains": termSvg(
    '<circle cx="30" cy="32" r="20" fill="#FFC800"/><circle cx="30" cy="32" r="12" fill="#FFE08A"/><path d="M44 18 C56 22 58 40 48 50 L40 40 C46 36 46 26 44 18 Z" fill="#FF8A65"/>',
  ),
  "buy-borrow-die": termSvg(
    '<circle cx="12" cy="32" r="10" fill="#58CC02"/><rect x="8" y="28" width="8" height="8" rx="1" fill="#fff"/><circle cx="32" cy="32" r="10" fill="#1CB0F6"/><rect x="27" y="26" width="10" height="12" rx="2" fill="#fff"/><circle cx="52" cy="32" r="10" fill="#FFC800"/><rect x="47" y="36" width="10" height="6" rx="2" fill="#1B2E24"/>',
  ),
  futures: termSvg(
    '<rect x="8" y="12" width="32" height="36" rx="4" fill="#fff" stroke="#1CB0F6" stroke-width="3"/><rect x="8" y="12" width="32" height="10" fill="#1CB0F6"/><circle cx="16" cy="32" r="2.4" fill="#58CC02"/><circle cx="24" cy="32" r="2.4" fill="#58CC02"/><circle cx="32" cy="32" r="2.4" fill="#FFC800"/><circle cx="16" cy="40" r="2.4" fill="#FFC800"/><circle cx="24" cy="40" r="2.4" fill="#58CC02"/><circle cx="48" cy="40" r="10" fill="#FFC800"/><circle cx="56" cy="40" r="10" fill="#58CC02"/><rect x="44" y="44" width="16" height="6" rx="3" fill="#fff"/>',
  ),
  swap: termSvg(
    '<circle cx="16" cy="20" r="10" fill="#FFC800"/><circle cx="48" cy="44" r="10" fill="#1CB0F6"/><path d="M28 18 H50" stroke="#58CC02" stroke-width="5" stroke-linecap="round"/><path d="M44 10 L54 18 L44 26" fill="#58CC02"/><path d="M36 46 H14" stroke="#FF8A65" stroke-width="5" stroke-linecap="round"/><path d="M20 38 L10 46 L20 54" fill="#FF8A65"/>',
  ),
  sell: termSvg(
    '<rect x="8" y="16" width="28" height="36" rx="4" fill="#fff" stroke="#1CB0F6" stroke-width="3"/><rect x="12" y="24" width="20" height="4" rx="2" fill="#1CB0F6"/><rect x="12" y="32" width="14" height="4" rx="2" fill="#58CC02"/><path d="M36 20 L56 32 L36 44 Z" fill="#FF8A65"/>',
  ),
  true: termSvg(
    '<circle cx="32" cy="32" r="24" fill="#58CC02"/><path d="M18 34 L28 44 L48 22" fill="none" stroke="#fff" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>',
  ),
  false: termSvg(
    '<circle cx="32" cy="32" r="24" fill="#FF8A65"/><path d="M22 22 L42 42 M42 22 L22 42" stroke="#fff" stroke-width="6" stroke-linecap="round"/>',
  ),
  joke: termSvg(
    '<polygon points="32,8 48,40 16,40" fill="#FFC800"/><circle cx="32" cy="8" r="5" fill="#FF8A65"/><circle cx="18" cy="50" r="5" fill="#58CC02"/><circle cx="46" cy="52" r="4" fill="#1CB0F6"/><circle cx="32" cy="56" r="3.5" fill="#FF8A65"/>',
  ),
};

const ART_ALIASES: Record<string, string> = {
  "capital gain": "capital gains",
  future: "futures",
  short: "short selling",
  "short sale": "short selling",
  pledged: "pledge",
  marked: "mark-to-market",
  "in default": "default",
  sbl: "securities-backed loan",
  true: "true",
  false: "false",
  sell: "sell",
};

export function artIdForLabel(label: string | null | undefined): string {
  const raw = String(label == null ? "" : label).trim();
  const s = raw
    .toLowerCase()
    .replace(/^an?\s+/, "")
    .replace(/\.$/, "")
    .trim();
  if (TERM_ART[raw]) return raw;
  if (TERM_ART[s]) return s;
  if (ART_ALIASES[s]) return ART_ALIASES[s];
  return "joke";
}

export type ArtSize = "xs" | "sm" | "lg" | "hero";

// Hero scenes: poster-grade art for the teach card's 168px stage only.
// Same palette and 64×64 viewBox as TERM_ART, plus a ground shadow, a soft
// halo, and a second element acting out the caption. Chip sizes keep the
// simpler icons; hero falls back to TERM_ART when no scene exists yet.
const GROUND = '<ellipse cx="32" cy="57" rx="20" ry="3.5" fill="#1B2E24" opacity=".08"/>';
function halo(color: string) {
  return `<circle cx="32" cy="27" r="21" fill="${color}" opacity=".55"/>`;
}
export const HERO_ART: Record<string, string> = {
  hedge: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<path d="M10 54 Q20 38 32 38 Q44 38 54 54 Z" fill="#58CC02"/><path d="M17 52 Q24 43 32 43 Q40 43 47 52 Z" fill="#89E219"/><rect x="18" y="36" width="28" height="15" rx="4" fill="#FFC800"/><rect x="18" y="36" width="28" height="5" rx="2.5" fill="#FFD966"/><circle cx="32" cy="44" r="5" fill="#E6A100"/><path d="M32 28 L32 37" stroke="#1899D6" stroke-width="5" stroke-linecap="round"/><path d="M32 4 Q52 4 54 28 L10 28 Q12 4 32 4 Z" fill="#1CB0F6"/><path d="M8 15 l-3 -6 M15 11 l-2 -6 M23 8 l-1 -6" stroke="#FF8A65" stroke-width="3.2" stroke-linecap="round"/>',
  ),
  pledge: termSvg(
    halo("#FFF6D0") +
      GROUND +
      '<circle cx="20" cy="36" r="12" fill="#FFC800"/><circle cx="20" cy="36" r="7" fill="#FFE08A"/><path d="M29 30 q5 2 4 7" fill="none" stroke="#8AA396" stroke-width="3.4" stroke-linecap="round"/><path d="M31 36 C36 32 38 34 42 33" fill="none" stroke="#8AA396" stroke-width="3.4" stroke-linecap="round"/><rect x="40" y="20" width="19" height="28" rx="3" fill="#46A302"/><rect x="44" y="25" width="11" height="9" rx="2" fill="#89E219"/><circle cx="49.5" cy="29.5" r="2.6" fill="#FFC800"/><rect x="40" y="42" width="19" height="6" fill="#3D8C00"/>',
  ),
  collateral: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<rect x="11" y="26" width="42" height="26" rx="6" fill="#FFC800"/><rect x="11" y="26" width="42" height="8" rx="4" fill="#E6A100"/><rect x="25" y="15" width="14" height="13" rx="3" fill="#1CB0F6"/><path d="M39 18 q8 -5 13 1" fill="none" stroke="#8AA396" stroke-width="2.8" stroke-linecap="round"/><circle cx="32" cy="41" r="7.5" fill="#58CC02"/><rect x="30.2" y="39" width="3.6" height="8" rx="1.8" fill="#fff"/><circle cx="32" cy="37.5" r="2.1" fill="#fff"/>',
  ),
  haircut: termSvg(
    halo("#FFF6D0") +
      GROUND +
      '<circle cx="24" cy="41" r="13" fill="#FFC800"/><circle cx="24" cy="41" r="8" fill="#FFE08A"/><polygon points="38,24 50,29 39,37" fill="#FFC800" stroke="#E6A100" stroke-width="2" stroke-linejoin="round"/><path d="M46 16 L32 32 M52 20 L36 34" stroke="#FF8A65" stroke-width="4.6" stroke-linecap="round"/><circle cx="47" cy="16" r="2.4" fill="#E56A48"/><circle cx="53" cy="10" r="4" fill="none" stroke="#FF8A65" stroke-width="3.2"/><circle cx="58" cy="17" r="4" fill="none" stroke="#FF8A65" stroke-width="3.2"/>',
  ),
  margin: termSvg(
    halo("#E7FFD4") +
      GROUND +
      '<rect x="8" y="44" width="15" height="6" rx="3" fill="#FFC800"/><rect x="8" y="38" width="15" height="6" rx="3" fill="#FFD966"/><circle cx="15.5" cy="34" r="4" fill="#E6A100"/><path d="M28 42 L28 24" stroke="#46A302" stroke-width="4" stroke-linecap="round"/><path d="M23 29 L28 22 L33 29" fill="none" stroke="#46A302" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><rect x="38" y="12" width="18" height="38" rx="6" fill="#58CC02"/><rect x="38" y="30" width="18" height="20" rx="6" fill="#1CB0F6"/>',
  ),
  "margin call": termSvg(
    halo("#FFE8D6") +
      GROUND +
      '<circle cx="14" cy="47" r="7" fill="#FFC800"/><rect x="7" y="41" width="14" height="5" rx="2.5" fill="#FFD966"/><circle cx="22" cy="49" r="5" fill="#E6A100"/><path d="M4 36 l-2 -4 M10 32 l-1 -5" stroke="#FF8A65" stroke-width="2.8" stroke-linecap="round"/><rect x="30" y="14" width="26" height="36" rx="5" fill="#1CB0F6"/><rect x="34" y="19" width="18" height="9" rx="2" fill="#E8F7FF"/><path d="M38 35 h8 M38 40 h12" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M33 9 q5 -6 10 -3" fill="none" stroke="#FF8A65" stroke-width="3.2" stroke-linecap="round"/><path d="M46 5 q6 -5 11 -1" fill="none" stroke="#FF8A65" stroke-width="3.2" stroke-linecap="round" opacity=".6"/>',
  ),
  leverage: termSvg(
    halo("#E7FFD4") +
      GROUND +
      '<polygon points="36,42 28,54 44,54" fill="#1CB0F6"/><rect x="8" y="30" width="48" height="7" rx="3.5" fill="#FFC800" transform="rotate(-12 32 34)"/><circle cx="12" cy="24" r="5" fill="#FFC800"/><rect x="8" y="27" width="9" height="4" rx="2" fill="#E6A100"/><rect x="44" y="8" width="14" height="16" rx="3" fill="#58CC02"/><rect x="44" y="8" width="14" height="5" rx="2.5" fill="#89E219"/>',
  ),
  derivative: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<rect x="8" y="12" width="30" height="40" rx="4" fill="#E8F7FF" stroke="#1CB0F6" stroke-width="3"/><path d="M14 42 L21 30 L27 35 L34 22" fill="none" stroke="#58CC02" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M39 30 C44 27 44 37 48 34" fill="none" stroke="#8AA396" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/><rect x="42" y="34" width="16" height="16" rx="3" fill="#FFC800"/><rect x="42" y="34" width="16" height="5" rx="2.5" fill="#FFD966"/>',
  ),
  option: termSvg(
    halo("#FFF6D0") +
      GROUND +
      '<rect x="8" y="22" width="38" height="24" rx="6" fill="#FFC800"/><rect x="8" y="22" width="12" height="24" rx="6" fill="#1CB0F6"/><path d="M32 24 v20" stroke="#E6A100" stroke-width="2.4" stroke-dasharray="3 4" stroke-linecap="round"/><polygon points="50,13 59,18 56,27 47,23" fill="#FFC800" stroke="#E6A100" stroke-width="2" stroke-linejoin="round" transform="rotate(18 53 20)"/>',
  ),
  put: termSvg(
    halo("#E7FFD4") +
      GROUND +
      '<rect x="8" y="44" width="48" height="7" rx="3.5" fill="#58CC02"/><path d="M12 10 L24 24 L30 20 L42 34" fill="none" stroke="#FF8A65" stroke-width="4.5" stroke-linecap="round" stroke-linejoin="round"/><polygon points="36,28 46,36 35,38" fill="#FF8A65"/><circle cx="50" cy="38" r="5" fill="#FFC800"/>',
  ),
  call: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<path d="M8 34 H56" stroke="#8AA396" stroke-width="2.6" stroke-dasharray="5 4" stroke-linecap="round"/><path d="M10 48 L24 38 L32 43 L52 20" fill="none" stroke="#58CC02" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><polygon points="45,15 55,16 51,26" fill="#58CC02"/><circle cx="24" cy="38" r="4.5" fill="#FFC800"/><circle cx="48" cy="11" r="4" fill="#FFC800"/>',
  ),
  "short selling": termSvg(
    halo("#FFE8D6") +
      GROUND +
      '<rect x="10" y="10" width="20" height="16" rx="3" fill="#E8F7FF" stroke="#1CB0F6" stroke-width="3" stroke-dasharray="4 3"/><path d="M22 32 v12" stroke="#FF8A65" stroke-width="5" stroke-linecap="round"/><polygon points="17,42 22,51 27,42" fill="#FF8A65"/><path d="M32 22 C40 30 42 36 43 40" fill="none" stroke="#8AA396" stroke-width="3" stroke-dasharray="4 4" stroke-linecap="round"/><circle cx="44" cy="47" r="7" fill="#FFC800"/><circle cx="44" cy="47" r="4" fill="#FFE08A"/>',
  ),
  liquidity: termSvg(
    halo("#E7FFD4") +
      GROUND +
      '<rect x="14" y="10" width="36" height="38" rx="8" fill="none" stroke="#58CC02" stroke-width="5"/><circle cx="30" cy="30" r="8" fill="#FFC800"/><circle cx="30" cy="30" r="5" fill="#FFE08A"/><path d="M10 24 h7 M8 30 h9 M10 36 h7" stroke="#1CB0F6" stroke-width="3" stroke-linecap="round"/><path d="M10 52 h44" stroke="#8AA396" stroke-width="3" stroke-linecap="round"/>',
  ),
  notional: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<rect x="10" y="8" width="34" height="44" rx="5" fill="#E8F7FF" stroke="#1CB0F6" stroke-width="3"/><circle cx="27" cy="26" r="10" fill="none" stroke="#E6A100" stroke-width="3" stroke-dasharray="5 4"/><path d="M38 34 q5 5 3 8" fill="none" stroke="#8AA396" stroke-width="2.6" stroke-dasharray="3 3" stroke-linecap="round"/><circle cx="46" cy="47" r="7" fill="#FFC800"/><circle cx="46" cy="47" r="4" fill="#FFE08A"/>',
  ),
  premium: termSvg(
    halo("#FFF6D0") +
      GROUND +
      '<rect x="8" y="16" width="30" height="22" rx="6" fill="#1CB0F6"/><rect x="8" y="16" width="10" height="22" rx="6" fill="#1899D6"/><path d="M20 19 v16" stroke="#E8F7FF" stroke-width="2" stroke-dasharray="3 3"/><path d="M38 26 q4 -3 6 1" fill="none" stroke="#8AA396" stroke-width="2.4" stroke-linecap="round"/><polygon points="40,24 53,24 58,31 53,38 40,38" fill="#FFC800" stroke="#E6A100" stroke-width="2.5" stroke-linejoin="round"/><circle cx="44" cy="31" r="2.4" fill="#fff"/>',
  ),
  yield: termSvg(
    halo("#E7FFD4") +
      GROUND +
      '<circle cx="32" cy="44" r="11" fill="#FFC800"/><circle cx="32" cy="44" r="6.5" fill="#FFE08A"/><path d="M32 40 C32 26 24 22 20 14" fill="none" stroke="#58CC02" stroke-width="5" stroke-linecap="round"/><path d="M32 34 C38 28 44 28 47 20" fill="none" stroke="#46A302" stroke-width="4" stroke-linecap="round"/><path d="M27 31 q-8 0 -9 -9 q8 0 9 9 Z" fill="#89E219"/><circle cx="20" cy="12" r="5" fill="#FFC800"/><circle cx="48" cy="17" r="4.5" fill="#FFD966"/>',
  ),
  duration: termSvg(
    halo("#FFE8D6") +
      GROUND +
      '<path d="M14 42 C24 37 40 37 50 42" fill="none" stroke="#FFC800" stroke-width="5.5" stroke-linecap="round"/><polygon points="32,44 27,52 37,52" fill="#E6A100"/><circle cx="15" cy="27" r="6" fill="#1CB0F6"/><path d="M12 15 l1 4 M18 15 l-1 4" stroke="#1899D6" stroke-width="2.8" stroke-linecap="round"/><circle cx="49" cy="14" r="6" fill="#FFC800"/><path d="M46 22 l-1.5 4 M52 22 l1.5 4" stroke="#E6A100" stroke-width="2.8" stroke-linecap="round"/>',
  ),
  "basis risk": termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<path d="M10 32 C20 32 24 30 32 26 C40 22 46 18 54 14" fill="none" stroke="#58CC02" stroke-width="4.5" stroke-linecap="round"/><path d="M10 32 C20 32 24 34 32 38 C40 42 46 46 54 50" fill="none" stroke="#1CB0F6" stroke-width="4.5" stroke-linecap="round"/><path d="M54 18 L54 46" stroke="#FF8A65" stroke-width="3" stroke-dasharray="3 4" stroke-linecap="round"/>',
  ),
  long: termSvg(
    halo("#E7FFD4") +
      GROUND +
      '<path d="M14 36 q0 14 18 14 q18 0 18 -14 l-6 0 q0 8 -12 8 q-12 0 -12 -8 Z" fill="#1CB0F6"/><circle cx="32" cy="33" r="7" fill="#FFC800"/><circle cx="32" cy="33" r="4" fill="#FFE08A"/><path d="M32 26 v-14" stroke="#58CC02" stroke-width="5" stroke-linecap="round"/><polygon points="27,16 32,8 37,16" fill="#58CC02"/><path d="M50 10 v6 M47 13 h6" stroke="#FFC800" stroke-width="2.6" stroke-linecap="round"/>',
  ),
  volatility: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<path d="M32 8 L47 38" stroke="#46A302" stroke-width="3" stroke-linecap="round"/><circle cx="32" cy="8" r="2.4" fill="#46A302"/><circle cx="47" cy="41" r="7" fill="#FFC800"/><circle cx="47" cy="41" r="4" fill="#FFE08A"/><circle cx="17" cy="41" r="7" fill="none" stroke="#8AA396" stroke-width="2.6" stroke-dasharray="3 3"/>',
  ),
  diversification: termSvg(
    halo("#FFF6D0") +
      GROUND +
      '<g transform="rotate(-40 14 40)"><rect x="4" y="34" width="20" height="4" rx="2" fill="#46A302"/><path d="M5 38 h18 l-4 13 h-10 Z" fill="#58CC02"/></g><g transform="rotate(-25 10 48)"><ellipse cx="10" cy="48" rx="5" ry="6" fill="#fff" stroke="#E6A100" stroke-width="2"/><path d="M10 43 l2 3 l-2 3 l2 2" fill="none" stroke="#E56A48" stroke-width="1.8" stroke-linecap="round"/></g><rect x="24" y="34" width="20" height="4" rx="2" fill="#1899D6"/><path d="M25 38 h18 l-4 13 h-10 Z" fill="#1CB0F6"/><ellipse cx="34" cy="29" rx="4.5" ry="6" fill="#fff" stroke="#E6A100" stroke-width="2"/><rect x="42" y="34" width="20" height="4" rx="2" fill="#E6A100"/><path d="M43 38 h18 l-4 13 h-10 Z" fill="#FFC800"/><ellipse cx="52" cy="29" rx="4.5" ry="6" fill="#fff" stroke="#E6A100" stroke-width="2"/>',
  ),
  counterparty: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<circle cx="16" cy="15" r="7" fill="#FFC800"/><rect x="9" y="25" width="16" height="21" rx="8" fill="#FFC800"/><circle cx="48" cy="15" r="7" fill="#1CB0F6"/><rect x="41" y="25" width="16" height="21" rx="8" fill="#1CB0F6"/><path d="M43 33 C36 28 28 28 21 33" fill="none" stroke="#8AA396" stroke-width="3" stroke-dasharray="4 3" stroke-linecap="round"/><circle cx="32" cy="29" r="5" fill="#FFC800"/><path d="M8 51 h48" stroke="#46A302" stroke-width="4" stroke-linecap="round"/>',
  ),
  default: termSvg(
    halo("#FFE8D6") +
      GROUND +
      '<rect x="8" y="26" width="18" height="12" rx="6" fill="none" stroke="#1CB0F6" stroke-width="4"/><rect x="40" y="20" width="18" height="12" rx="6" fill="none" stroke="#8AA396" stroke-width="4" transform="rotate(10 49 26)"/><path d="M29 22 l4 5 l-4 4 l4 6" fill="none" stroke="#FF8A65" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="20" cy="47" r="6.5" fill="none" stroke="#8AA396" stroke-width="3" stroke-dasharray="4 3"/>',
  ),
  "mark-to-market": termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<rect x="12" y="34" width="28" height="16" rx="3" fill="#FFC800"/><rect x="12" y="34" width="28" height="5" rx="2.5" fill="#FFD966"/><path d="M26 34 q4 -10 8 -12" fill="none" stroke="#8AA396" stroke-width="2.4" stroke-linecap="round"/><rect x="30" y="10" width="24" height="18" rx="3" fill="#1CB0F6"/><path d="M34 17 h10" stroke="#E8F7FF" stroke-width="3" stroke-linecap="round"/><path d="M33 14 l13 9" stroke="#FF8A65" stroke-width="2.4" stroke-linecap="round"/><path d="M34 24 h12" stroke="#fff" stroke-width="3" stroke-linecap="round"/>',
  ),
  "securities-backed loan": termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<rect x="8" y="14" width="26" height="32" rx="4" fill="#fff" stroke="#1CB0F6" stroke-width="3"/><rect x="8" y="14" width="26" height="8" fill="#1CB0F6"/><path d="M12 36 L18 30 L23 33 L29 26" fill="none" stroke="#58CC02" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M34 30 C38 27 40 28 43 27" fill="none" stroke="#8AA396" stroke-width="3" stroke-linecap="round"/><rect x="42" y="20" width="17" height="24" rx="3" fill="#46A302"/><rect x="45" y="24" width="11" height="8" rx="2" fill="#89E219"/><circle cx="50.5" cy="28" r="2.4" fill="#FFC800"/><rect x="42" y="39" width="17" height="5" fill="#3D8C00"/><circle cx="46" cy="50" r="4.5" fill="#FFC800"/><circle cx="53" cy="52" r="3.5" fill="#E6A100"/>',
  ),
  "capital gains": termSvg(
    halo("#FFF6D0") +
      GROUND +
      '<circle cx="26" cy="38" r="14" fill="#FFC800"/><circle cx="26" cy="38" r="9" fill="#FFE08A"/><g transform="rotate(8 46 20)"><rect x="38" y="10" width="16" height="20" rx="2" fill="#fff" stroke="#1CB0F6" stroke-width="2.6"/><path d="M42 16 h8 M42 21 h8" stroke="#1899D6" stroke-width="2.4" stroke-linecap="round"/></g><path d="M36 8 l2 -3 M44 5 l0 -3 M52 8 l-2 -3" stroke="#FF8A65" stroke-width="2.6" stroke-linecap="round"/>',
  ),
  "buy-borrow-die": termSvg(
    halo("#E7FFD4") +
      GROUND +
      '<path d="M8 52 C22 48 42 48 58 52" fill="none" stroke="#8AA396" stroke-width="2.4" stroke-dasharray="3 3" stroke-linecap="round"/><circle cx="13" cy="40" r="7" fill="#FFC800"/><circle cx="13" cy="40" r="4" fill="#FFE08A"/><circle cx="31" cy="38" r="7" fill="#FFC800"/><path d="M36 31 q5 2 4 8" fill="none" stroke="#8AA396" stroke-width="3" stroke-linecap="round"/><circle cx="50" cy="43" r="5.5" fill="#FFC800"/><path d="M42 45 a9 10 0 0 1 18 0 Z" fill="#E8F7FF" fill-opacity=".75" stroke="#1CB0F6" stroke-width="2.6"/>',
  ),
  futures: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<rect x="10" y="10" width="32" height="36" rx="4" fill="#fff" stroke="#1CB0F6" stroke-width="3"/><rect x="10" y="10" width="32" height="9" fill="#1CB0F6"/><circle cx="18" cy="32" r="2.2" fill="#58CC02"/><circle cx="26" cy="32" r="2.2" fill="#FFC800"/><circle cx="34" cy="32" r="2.2" fill="#58CC02"/><circle cx="18" cy="39" r="2.2" fill="#FFC800"/><circle cx="26" cy="39" r="2.2" fill="#58CC02"/><circle cx="34" cy="39" r="5" fill="none" stroke="#FF8A65" stroke-width="3"/><circle cx="50" cy="46" r="6" fill="#FFC800"/><path d="M44 40 l-3 -3 M48 36 l-2 -4" stroke="#E6A100" stroke-width="2.6" stroke-linecap="round"/>',
  ),
  swap: termSvg(
    halo("#E8F7FF") +
      GROUND +
      '<path d="M10 30 H46" stroke="#58CC02" stroke-width="5" stroke-linecap="round"/><polygon points="44,25 56,30 44,35" fill="#58CC02"/><path d="M18 25 v10 M30 25 v10 M40 25 v10" stroke="#46A302" stroke-width="2.6" stroke-linecap="round"/><path d="M10 44 C24 26 40 50 50 34" fill="none" stroke="#1CB0F6" stroke-width="5" stroke-linecap="round"/><polygon points="46,28 58,33 47,40" fill="#1CB0F6"/><path d="M22 38 v6 M34 40 v10 M46 34 v7" stroke="#1899D6" stroke-width="2.6" stroke-linecap="round"/>',
  ),
};

export function artForSize(id: string, size: ArtSize): string {
  const base = id.replace(/_u1intro$/, "");
  if (size === "hero") {
    const scene = HERO_ART[id] ?? HERO_ART[base];
    if (scene) return scene;
  }
  return TERM_ART[id] ?? TERM_ART[base] ?? TERM_ART.joke;
}

// Raw scene markup (svg shell stripped) for embedding into the share card's
// duel band via <g transform>.
export function heroSceneInner(id: string): string | null {
  const svg = HERO_ART[id];
  if (!svg) return null;
  return svg.replace(/^<svg[^>]*>/, "").replace(/<\/svg>$/, "");
}

export function TermArt({ id, size }: { id: string; size: ArtSize }) {
  return (
    /* biome-ignore lint/security/noDangerouslySetInnerHtml: static, code-owned SVG art markup */
    <span className={`term-art ${size}`} dangerouslySetInnerHTML={{ __html: artForSize(id, size) }} />
  );
}

export function Hedgehog() {
  return (
    <svg viewBox="0 0 72 64" width="88" height="78" aria-hidden="true">
      {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, code-owned SVG art markup */}
      <g dangerouslySetInnerHTML={{ __html: HEDGEHOG_PATHS }} />
    </svg>
  );
}

export const NAV_ICONS = {
  learn: '<svg class="icon" viewBox="0 0 24 24"><path d="M4 19V5m0 14h16M8 17V9m4 8V7m4 10v-6"/></svg>',
  practice:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M6 7h3v10H6zm9 0h3v10h-3M3 10h3m12 0h3M3 14h3m12 0h3"/></svg>',
  glossary:
    '<svg class="icon" viewBox="0 0 24 24"><path d="M6 4h11a3 3 0 013 3v13H8a2 2 0 01-2-2V4zm0 0v14"/><path d="M10 8h7M10 12h7"/></svg>',
  graph:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="6" cy="6" r="2.4"/><circle cx="18" cy="9" r="2.4"/><circle cx="10" cy="18" r="2.4"/><path d="M8.4 6.8l7.2 1.5M7.2 8.2l2 7.6M16.6 11l-5 5.4"/></svg>',
  settings:
    '<svg class="icon" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.4"/><path d="M12 2.5v3.2m0 12.6v3.2M2.5 12h3.2m12.6 0h3.2M5.3 5.3l2.2 2.2m9 9l2.2 2.2M18.7 5.3l-2.2 2.2m-9 9l-2.2 2.2"/></svg>',
} as const;
