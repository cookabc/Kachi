import raw from "../content/ipa.json";

/**
 * US IPA for each course term, generated from the CMU Pronouncing Dictionary by
 * scripts/build-ipa.mjs.
 *
 * Read as data rather than computed at runtime: the conversion is a build step
 * (ARPAbet → IPA with syllable-aware stress placement), and shipping the 3.5MB
 * source dictionary to browsers to redo it would be absurd.
 *
 * Terms the dictionary does not list — abbreviations like p/e, eps, capex — are
 * simply absent. Callers must treat undefined as "no transcription", never as
 * an excuse to print a guessed one.
 */
const TABLE = (raw as { words: Record<string, string> }).words;

export function ipaFor(conceptId: string): string | undefined {
  return TABLE[conceptId];
}
