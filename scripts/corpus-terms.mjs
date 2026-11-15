/**
 * Does the corpus use this term?
 *
 * Two things the naive \b match got wrong:
 *  - Hyphenated terms ("write-down") — \b sits between "-" and a letter, so
 *    the pattern never matched even when the text said "write-down".
 *  - Compound terms whose words may carry other punctuation ("free cash flow"
 *    written across a line break or with different spacing).
 * The term is matched word-by-word, with the final word allowed to inflect.
 */
export function corpusHasTerm(corpus, term) {
  const words = term
    .toLowerCase()
    .split(/[\s-]+/)
    .filter(Boolean);
  if (!words.length) return false;
  const escaped = words.map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  const last = escaped.pop();
  // Words may be separated by a space or a hyphen in the text.
  const pattern = new RegExp(
    `\\b${escaped.join("[\\s-]+")}${escaped.length ? "[\\s-]+" : ""}${last}(s|es|ed|ing)?\\b`,
  );
  return pattern.test(corpus);
}
