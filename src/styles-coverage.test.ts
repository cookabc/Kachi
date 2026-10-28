import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

// styles.css has been rewritten wholesale twice (once during the art work),
// and both times it silently dropped rules from the tail. Nothing caught it:
// every test passed, the DOM still had the elements, and only a screenshot
// showed the pack picker rendering as a wall of plain text with no hit areas.
//
// These assertions cover classes whose absence makes a surface unusable rather
// than merely plain. They check for the rule, not its exact declarations —
// restyling is fine, disappearing is not.
// vitest runs under jsdom here, where import.meta.url is not a file: URL.
const css = readFileSync(resolve(process.cwd(), "src/styles.css"), "utf8");

const hasRule = (selector: string) =>
  new RegExp(`(^|\\n)\\s*${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*[,{]`).test(css);

describe("styles for surfaces that stop working without them", () => {
  it("keeps the course pack picker styled", () => {
    // Without these the six packs collapse into one run of text and cannot be
    // tapped — the only way to change course.
    for (const selector of [".pack-switch", ".pack-choice", ".pack-level", ".pack-title"]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });

  it("keeps the folded glossary row styled", () => {
    // The row is the only control that opens a term's contrast bench.
    for (const selector of [".g-row", ".g-row-twin", ".g-row-chevron"]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });

  it("keeps the unit toggle and its lesson list styled", () => {
    for (const selector of ["button.lab-unit-head", ".lab-unit-chevron"]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });

  it("keeps the exercise surfaces styled", () => {
    // audit and listen are the two exercise types with their own layout; losing
    // either leaves an unstyled block of sentences or a bare speaker glyph.
    for (const selector of [".audit-opt", ".claim", ".listen-replay", ".speak-btn"]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });
});
