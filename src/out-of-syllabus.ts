/**
 * Ids that carry art but are deliberately *not* concepts.
 *
 * A true/false question needs art for its two answers, and a multiple-choice
 * distractor can name something the course never teaches ("sell" is the natural
 * wrong answer for "pledge"). None of these have a unit, a definition or a
 * mix-up, and none may appear in the map or the glossary.
 *
 * Deliberately dependency-free: the build-time validator runs under plain Node,
 * which cannot resolve extensionless relative imports, so anything it loads must
 * be a leaf module (same constraint as fill.ts). content/out-of-syllabus.json is
 * the same list in data form for that script; a test asserts they match.
 */
export const OUT_OF_SYLLABUS_ART: ReadonlySet<string> = new Set(["sell", "true", "false"]);
