import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { bucketFor, clampLevel, confettiBits, effectiveLevel } from "./motion";

describe("motion level", () => {
  beforeEach(() => {
    localStorage.removeItem("kachi-motion");
  });
  afterEach(() => {
    delete document.documentElement.dataset.motion;
  });

  it("clamps any input into 0..100", () => {
    expect(clampLevel(-20)).toBe(0);
    expect(clampLevel(37.4)).toBe(37);
    expect(clampLevel(999)).toBe(100);
    expect(clampLevel(Number.NaN)).toBe(100);
  });

  it("maps levels onto off/scaled/full buckets", () => {
    expect(bucketFor(0)).toBe("off");
    expect(bucketFor(1)).toBe("scaled");
    expect(bucketFor(55)).toBe("scaled");
    expect(bucketFor(100)).toBe("full");
  });

  it("scales confetti density linearly and silences it at 0", () => {
    expect(confettiBits(0)).toBe(0);
    expect(confettiBits(50)).toBe(20);
    expect(confettiBits(100)).toBe(40);
  });

  it("untouched slider follows the OS preference", () => {
    // jsdom reports matchMedia matches as false
    expect(effectiveLevel(null)).toBe(100);
  });

  it("a pinned level overrides the OS preference", () => {
    expect(effectiveLevel(30)).toBe(30);
    expect(effectiveLevel(0)).toBe(0);
  });
});
