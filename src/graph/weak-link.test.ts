import { describe, expect, test } from "vitest";
import { course } from "../course";
import { prereqMap, weakLinks } from "./weak-link";

describe("the weak link", () => {
  test("finds no weak links for a learner who has seen everything", () => {
    const all = course.concepts.map((concept) => concept.id);
    const links = weakLinks(course, all);
    expect(links.length).toBe(0);
  });

  test("suggests a term the learner has not met", () => {
    const links = weakLinks(course, ["hedge"], 3);
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link.id).not.toBe("hedge");
    }
  });

  test("never suggests something already learned", () => {
    const seen = ["hedge", "pledge", "put"];
    const links = weakLinks(course, seen, 5);
    for (const link of links) {
      expect(seen).not.toContain(link.id);
    }
  });

  test("a term with a prereq chain comes before one with no chain", () => {
    // A learner who knows only "hedge": the terms hedge depends on through
    // prereq edges are reachable, so they must rank above the far reaches
    // of the course that are not connected at all.
    const links = weakLinks(course, ["hedge"], 10);
    const chained = links.filter((link) => link.chain.length > 0);
    const unchained = links.filter((link) => link.chain.length === 0);
    if (chained.length && unchained.length) {
      const lastChained = links.lastIndexOf(chained[chained.length - 1]);
      const firstUnchained = links.indexOf(unchained[0]);
      expect(lastChained).toBeLessThan(firstUnchained);
    }
  });

  test("the chain starts at something the learner already knows", () => {
    const seen = ["hedge"];
    for (const link of weakLinks(course, seen, 10)) {
      if (!link.chain.length) continue;
      // The first link in the chain is the learned term the path starts at.
      expect(seen).toContain(link.chain[0]);
      // And the last link is the term itself.
      expect(link.chain[link.chain.length - 1]).toBe(link.id);
    }
  });

  test("a real chain in the shipped course is found and traced", () => {
    // The course declares: basis depends on spot, contango depends on basis,
    // backwardation depends on contango. A learner who knows "spot" should
    // be pointed at "basis" first, with the chain running spot → basis.
    const links = weakLinks(course, ["spot"], 10);
    const basis = links.find((link) => link.id === "basis");
    expect(basis).toBeDefined();
    expect(basis?.chain).toEqual(["spot", "basis"]);
    // And "basis" is what a known "spot" actually unlocks.
    expect(basis?.unlocks).toBeGreaterThan(0);
  });

  test("the unlock count says how much a term would open up", () => {
    const links = weakLinks(course, [], 10);
    for (const link of links) {
      expect(link.unlocks).toBeGreaterThanOrEqual(0);
    }
    // Some term in this course must unlock at least one other term.
    expect(Math.max(...links.map((link) => link.unlocks))).toBeGreaterThan(0);
  });

  test("the prereq map only holds real prereq relations", () => {
    const map = prereqMap(course);
    const ids = new Set(course.concepts.map((concept) => concept.id));
    for (const [term, needs] of map) {
      expect(ids.has(term)).toBe(true);
      for (const need of needs) {
        expect(ids.has(need)).toBe(true);
        expect(need).not.toBe(term);
      }
    }
  });

  test("the result is deterministic", () => {
    const a = weakLinks(course, ["hedge", "put"], 4);
    const b = weakLinks(course, ["hedge", "put"], 4);
    expect(a.map((link) => link.id)).toEqual(b.map((link) => link.id));
  });
});
