/**
 * Fill-exercise blanking, shared by the T1 generator and the build-time
 * validator so both ask the same question: does the stem give the answer away?
 *
 * The naive `example.replace(term, "____")` leaked answers through inflected
 * forms — "rallied" kept the visible "rall" stem of "rally" in the sentence,
 * so 7 of 42 T1 fills either showed the answer or appended a hint next to it.
 * Matching the inflected form lets the whole word disappear ("Oil prices ____
 * 4%…"), which is also the better exercise: recognizing that "rallied" comes
 * from "rally" is the skill being taught.
 */

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * A case-insensitive, word-bounded pattern matching the term and its regular
 * inflections: plural/third-person `-s/-es`, past `-ed/-d/-ied`, and
 * `-ing/-ying`. The `y → ies/ied/ying` branch only applies to terms ending in
 * y ("rally" matches "rallied", "currency" matches "currencies").
 */
export function fillPattern(term: string): RegExp {
  const bare = escapeRegExp(term);
  const forms = [`${bare}(?:s|es|ed|d|ing)?`];
  if (/y$/i.test(term)) {
    const stem = escapeRegExp(term.slice(0, -1));
    forms.push(`${stem}(?:ies|ied|ying)`);
  }
  return new RegExp(`\\b(?:${forms.join("|")})\\b`, "i");
}

export interface BlankResult {
  /** The example with the (inflected) term replaced by `____`, or the example
   *  unchanged when the term never appears. */
  story: string;
  /** True when a real blank was cut; false means the caller must decide on a
   *  fallback (the term simply is not in the sentence). */
  blanked: boolean;
}

export function blankTerm(example: string, term: string): BlankResult {
  const pattern = fillPattern(term);
  if (!pattern.test(example)) return { story: example, blanked: false };
  return { story: example.replace(pattern, "____"), blanked: true };
}

/** Whether a fill stem leaks its answer outside the blank. */
export function fillLeaksAnswer(story: string, answer: string): boolean {
  return fillPattern(answer).test(story.split("____").join(" "));
}
