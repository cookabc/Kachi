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
  it("keeps navigation and the level picker styled", () => {
    // Without these the tab bar is a row of text and the six levels cannot be
    // tapped — the only way to change course.
    for (const selector of [".tabbar", ".level-btn", ".level-item", ".level-badge", "dialog.sheet"]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });

  it("keeps the learning path and pair album styled", () => {
    for (const selector of [".today", ".trail", ".node", ".pcard", ".album-grid"]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });

  it("keeps the twin teach card styled", () => {
    // The side-by-side twins are the product's core moment.
    for (const selector of [".twins", ".twin", ".twin-art", ".trick"]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });

  it("keeps every exercise surface styled", () => {
    for (const selector of [
      ".opt",
      ".tf",
      ".bank",
      ".chip-btn",
      ".match",
      ".match-btn",
      ".news",
      ".blank",
      ".claim",
      ".listen",
      ".feedback",
    ]) {
      expect(hasRule(selector), `${selector} lost its rule`).toBe(true);
    }
  });

  it("does not let the image class 'hero' collide with a layout rule", () => {
    // TermArt renders <img class="term-art-img hero">. A bare `.hero` layout
    // rule once stretched every hero image to the full viewport height.
    expect(hasRule(".hero")).toBe(false);
  });
});
