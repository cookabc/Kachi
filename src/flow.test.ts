import { describe, expect, it } from "vitest";
import { course } from "./course";
import type { Exercise, LearnerState, SessionState } from "./domain";
import { emptyLearnerState } from "./engine";
import {
  lessonPair,
  PRACTICE_ROUND,
  practicePool,
  present,
  resolveMatch,
  sessionSummary,
  teachPlan,
} from "./flow";

const environmentNow = new Date("2026-08-29T08:00:00.000Z");

function lessonById(id: string) {
  return course.lessons.find((lesson) => lesson.id === id)!;
}

function publishedPrompt(id: string): Exercise {
  for (const lesson of course.lessons) {
    const found = lesson.prompts.find((prompt) => prompt.id === id);
    if (found) return found;
  }
  throw new Error(`no prompt ${id}`);
}

function attempt(correct: boolean, termIds: string[]) {
  return {
    eventId: `${termIds.join("-")}-${correct}`,
    deviceId: "test",
    contentVersion: course.contentVersion,
    engineVersion: "0.1.0",
    exerciseId: "x",
    conceptIds: termIds,
    exerciseType: "meaning" as const,
    answer: "x",
    correct,
    hintUsed: false,
    latencyMs: 0,
    occurredAt: environmentNow.toISOString(),
  };
}

describe("present", () => {
  it("shuffles choice options but keeps the correct answer identifiable and the course untouched", () => {
    const published = publishedPrompt("u1l1a");
    const before = JSON.stringify(published);
    const shown = present(published);

    expect(shown).not.toBe(published);
    expect(shown.options).toHaveLength(published.options!.length);
    expect([...shown.options!].sort((a, b) => a.text.localeCompare(b.text))).toEqual(
      [...published.options!].sort((a, b) => a.text.localeCompare(b.text)),
    );
    expect(shown.correctText).toBe(published.options![published.answer as number].text);
    expect(JSON.stringify(published)).toBe(before); // published content is never mutated
  });

  it("splits match pairs into two shuffled single-column copies", () => {
    const published = publishedPrompt("u1l1f");
    const shown = present(published);
    const pairIds = published.pairs!.map((pair) => pair.id).sort();

    expect(shown.left.map((chip) => chip.id).sort()).toEqual(pairIds);
    expect(shown.right.map((chip) => chip.id).sort()).toEqual(pairIds);
    shown.left.forEach((chip) => {
      expect(chip.text).toBe(published.pairs!.find((pair) => pair.id === chip.id)!.left);
    });
  });

  it("shuffles the fill bank and preserves the story", () => {
    const published = publishedPrompt("u1l1d");
    const shown = present(published);

    expect([...shown.bank!].sort()).toEqual([...published.bank!].sort());
    expect(shown.story).toBe(published.story);
  });

  it("survives exercises without options or pairs", () => {
    const tf: Exercise = { id: "t", type: "truefalse", termIds: ["hedge"], stem: "x", answer: true, why: "" };
    const shown = present(tf);
    expect(shown.correctText).toBeUndefined();
    expect(shown.left).toEqual([]);
    expect(shown.right).toEqual([]);
  });
});

describe("teachPlan", () => {
  it("teaches the fresh terms of the first lesson, skipping pseudo-terms", () => {
    const plan = teachPlan(lessonById("u1l1"), course);
    expect(plan).toEqual({ mode: "first", terms: ["hedge", "pledge"] });
  });

  it("skips terms already taught by earlier lessons of the same unit", () => {
    const plan = teachPlan(lessonById("u1l2"), course);
    expect(plan.terms).toEqual(["collateral", "haircut"]);
    expect(plan.terms).not.toContain("hedge");
  });

  it("turns a unit review into a recap of every unit term", () => {
    const plan = teachPlan(lessonById("u1r"), course);
    expect(plan.mode).toBe("recap");
    expect(plan.terms).toEqual(["hedge", "pledge", "collateral", "haircut", "margin", "margin call"]);
  });
});

describe("lessonPair", () => {
  it("names the pair a lesson teaches, from the first resolvable mix-up", () => {
    expect(lessonPair(course, "u1l1")).toEqual({ a: "hedge", b: "pledge" });
  });

  it("skips freshly taught terms whose mix-up is not a published concept", () => {
    const pair = lessonPair(course, "u1l2");
    expect(pair).not.toBeNull();
    expect(pair!.a).not.toBe(pair!.b);
  });

  it("resolves a pair for every lesson, including long terms and reviews", () => {
    course.lessons.forEach((lesson) => {
      const pair = lessonPair(course, lesson.id);
      expect(pair, lesson.id).not.toBeNull();
      expect(pair!.a.length).toBeGreaterThan(0);
      expect(pair!.b.length).toBeGreaterThan(0);
    });
  });

  it("returns null for an unknown lesson id", () => {
    expect(lessonPair(course, "nope")).toBeNull();
  });
});

describe("practicePool", () => {
  it("seeds a brand-new player with u1l1+u1l2 drills only, capped at ten", () => {
    const ids = practicePool(emptyLearnerState(), course);
    expect(ids.length).toBeLessThanOrEqual(10);
    expect(new Set(ids).size).toBe(ids.length);
    const poolLessons = new Set(ids.map((id) => id.slice(0, 4)));
    expect([...poolLessons].every((prefix) => prefix.startsWith("u1l1") || prefix.startsWith("u1l2"))).toBe(
      true,
    );
  });

  it("puts prompts tagged with the focus terms first", () => {
    const state: LearnerState = {
      ...emptyLearnerState(),
      attempts: [attempt(false, ["hedge"]), attempt(false, ["pledge"])],
    };
    const ids = practicePool(state, course);
    const weakCount = ids.filter((id) => {
      const prompt = publishedPrompt(id);
      return (prompt.termIds ?? []).some((term) => term === "hedge" || term === "pledge");
    }).length;
    expect(weakCount).toBeGreaterThan(0);
    ids.slice(0, weakCount).forEach((id) => {
      const prompt = publishedPrompt(id);
      expect((prompt.termIds ?? []).some((term) => term === "hedge" || term === "pledge")).toBe(true);
    });
  });

  it("treats due confusion pairs as focus without being told", () => {
    const state: LearnerState = {
      ...emptyLearnerState(),
      mastery: {
        "hedge::pledge": {
          confusionPairId: "hedge::pledge",
          consecutiveCorrect: 1,
          lapses: 1,
          evidenceTypes: ["meaning"],
          unseenScenarioCorrect: false,
          dueAt: new Date(environmentNow.getTime() - 1000).toISOString(),
          schedulerVersion: "0.1.0",
        },
      },
    };
    const ids = practicePool(state, course, undefined, PRACTICE_ROUND, environmentNow);
    expect(ids.length).toBeGreaterThan(0);
    const first = publishedPrompt(ids[0]);
    expect((first.termIds ?? []).some((term) => term === "hedge" || term === "pledge")).toBe(true);
  });

  it("focuses an observed mispair even when it is no published mix-up", () => {
    // a live match mispair ("collateral::hedge") is not any concept's canonical
    // pair — both halves must still reach the practice pool when it comes due
    const state: LearnerState = {
      ...emptyLearnerState(),
      mastery: {
        "collateral::hedge": {
          confusionPairId: "collateral::hedge",
          consecutiveCorrect: 0,
          lapses: 1,
          evidenceTypes: [],
          unseenScenarioCorrect: false,
          dueAt: new Date(environmentNow.getTime() - 1000).toISOString(),
          schedulerVersion: "0.1.0",
        },
      },
    };
    const ids = practicePool(state, course, undefined, PRACTICE_ROUND, environmentNow);
    const weakCount = ids.filter((id) => {
      const prompt = publishedPrompt(id);
      return (prompt.termIds ?? []).some((term) => term === "hedge" || term === "collateral");
    }).length;
    expect(weakCount).toBeGreaterThan(0);
    ids.slice(0, weakCount).forEach((id) => {
      const prompt = publishedPrompt(id);
      expect((prompt.termIds ?? []).some((term) => term === "hedge" || term === "collateral")).toBe(true);
    });
  });

  it("honors an explicit focus (Practice those)", () => {
    const state: LearnerState = { ...emptyLearnerState(), completedLessonIds: ["u1l1", "u1l2"] };
    const ids = practicePool(state, course, ["margin", "margin call"]);
    const weak = ids.filter((id) => {
      const prompt = publishedPrompt(id);
      return (prompt.termIds ?? []).some((term) => term === "margin" || term === "margin call");
    });
    expect(weak.length).toBeGreaterThan(0); // margin drills live in u1l2/u1l3, unlocked by the completed lessons
    ids.slice(0, weak.length).forEach((id) => {
      const prompt = publishedPrompt(id);
      expect((prompt.termIds ?? []).some((term) => term === "margin" || term === "margin call")).toBe(true);
    });
  });
});

describe("resolveMatch", () => {
  const pairs = [
    { id: "hedge", left: "hedge", right: "Insurance on a position you own" },
    { id: "pledge", left: "pledge", right: "Put the asset up for a loan" },
  ];

  it("locks a correct pair and keeps judging", () => {
    const outcome = resolveMatch([], pairs, "hedge", "hedge");
    expect(outcome).toEqual({ locked: ["hedge"], judged: null });
  });

  it("judges the whole prompt wrong on the first mispair", () => {
    const outcome = resolveMatch([], pairs, "hedge", "pledge");
    expect(outcome).toEqual({ locked: [], judged: false });
  });

  it("judges correct immediately when the last pair locks", () => {
    const outcome = resolveMatch(["hedge"], pairs, "pledge", "pledge");
    expect(outcome).toEqual({ locked: ["hedge", "pledge"], judged: "matched" });
  });
});

describe("sessionSummary", () => {
  function sessionOf(mode: "lesson" | "practice", results: SessionState["results"]): SessionState {
    return {
      lessonId: mode === "practice" ? "practice" : "u1l1",
      mode,
      promptIds: results.map((_, index) => `p${index}`),
      index: results.length,
      results,
      startedAt: environmentNow.toISOString(),
    };
  }

  it("mirrors the engine payout for a lesson", () => {
    const results = [
      attempt(true, ["hedge"]),
      attempt(true, ["hedge"]),
      attempt(true, ["pledge"]),
      attempt(false, ["hedge"]),
      attempt(false, ["margin call"]),
      attempt(true, ["hedge"]),
      attempt(true, ["hedge"]),
      attempt(true, ["hedge"]),
      attempt(false, ["hedge"]),
      attempt(true, ["hedge"]),
    ];
    const summary = sessionSummary(sessionOf("lesson", results));
    expect(summary).toEqual({
      gained: 90,
      xpHit: 70,
      xpDone: 20,
      xpPerfect: 0,
      correct: 7,
      total: 10,
      mix: ["hedge", "margin call"],
    });
  });

  it("pays practice rounds per correct answer only", () => {
    const results = [attempt(true, ["hedge"]), attempt(false, ["hedge"]), attempt(true, ["hedge"])];
    const summary = sessionSummary(sessionOf("practice", results));
    expect(summary.gained).toBe(20);
    expect(summary.xpDone).toBe(0);
    expect(summary.xpPerfect).toBe(0);
  });

  it("pays the no-mistake bonus only for a flawless lesson", () => {
    const results = [attempt(true, ["hedge"]), attempt(true, ["pledge"])];
    const summary = sessionSummary(sessionOf("lesson", results));
    expect(summary.xpPerfect).toBe(20);
    expect(summary.gained).toBe(60);
  });
});
