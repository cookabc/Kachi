import { describe, expect, it } from "vitest";
import earnings from "../content/packs/t2-company-earnings/en-US/course.json";
import type { AttemptEvent, Course, LearnerState, MasteryState } from "./domain";
import { emptyLearnerState } from "./engine";
import { validateCourse, validateVocabularyIdentities } from "./schema";
import { authoredCourse } from "./test-fixtures/authored-course";
import { findConcept, migrateVocabulary } from "./vocabulary";

const company = earnings as unknown as Course;

function record(key: string, date: string, correct = 2): MasteryState {
  return {
    confusionPairId: key,
    consecutiveCorrect: correct,
    lapses: 1,
    evidenceTypes: ["meaning", "scenario"],
    unseenScenarioCorrect: true,
    lastReviewedAt: date,
    dueAt: "2026-12-01T00:00:00.000Z",
    schedulerVersion: "0.2.0",
  };
}

function attempt(exerciseId: string, ids: string[], pair: string): AttemptEvent {
  return {
    eventId: exerciseId,
    exerciseId,
    conceptIds: ids,
    confusionPairId: pair,
    deviceId: "test",
    contentVersion: "legacy",
    engineVersion: "0.2.0",
    exerciseType: "scenario",
    answer: "original answer",
    correct: true,
    hintUsed: false,
    latencyMs: 1200,
    occurredAt: "2026-11-01T00:00:00.000Z",
  };
}

describe("concept identity", () => {
  it("resolves full names and abbreviations inside the current course", () => {
    expect(findConcept(company, " Capital Expenditure ")?.id).toBe("capex");
    expect(findConcept(company, "capital expenditures")?.id).toBe("capex");
    expect(findConcept(company, "margin")?.definition).toContain("percentage");
    expect(findConcept(authoredCourse, "margin")?.id).toBe("margin-collateral");
    expect(findConcept(company, "trading margin")).toBeUndefined();
  });

  it("rejects competing alias identities and a reused id with a different meaning", () => {
    const copy = structuredClone(company);
    copy.concepts.find((c) => c.id === "opex")!.aliases = ["capital expenditure"];
    expect(validateVocabularyIdentities([copy])).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "capital expenditure" })]),
    );
    const other = structuredClone(company);
    other.concepts.find((c) => c.id === "margin")!.sense = "trading-collateral";
    expect(validateVocabularyIdentities([company, other])).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: "margin" })]),
    );
    expect(validateVocabularyIdentities([company, authoredCourse])).toEqual([]);
  });

  it("rejects unusable aliases and incomplete extended explanations", () => {
    const copy = structuredClone(company);
    copy.concepts[0].aliases = [" "];
    copy.concepts[1].learning = { workedExample: "example", application: "", misconception: "trap" };
    expect(validateCourse(copy).map((issue) => issue.message)).toEqual(
      expect.arrayContaining([
        "aliases must contain non-empty strings",
        "learning needs a worked example, application, and misconception",
      ]),
    );
  });
});

describe("legacy vocabulary progress", () => {
  it("separates collateral and profit evidence while preserving completed work", () => {
    const old: LearnerState = {
      ...emptyLearnerState(),
      vocabularyRevision: undefined,
      xp: 321,
      streak: 5,
      completedLessonIds: ["hedge-or-pledge/u1l3", "t2-company-earnings/u1l1"],
      seenConceptIds: ["margin", "leverage", "profit", "capital expenditure", "capex"],
      mastery: {
        "leverage::margin": record("leverage::margin", "2026-11-01"),
        "margin::profit": record("margin::profit", "2026-11-02", 3),
        "capital expenditure::opex": record("capital expenditure::opex", "2026-11-03", 4),
        "capex::opex": record("capex::opex", "2026-11-04", 1),
      },
      attempts: [
        attempt("u1l3a", ["margin"], "leverage::margin"),
        attempt("u1l1-margin-s", ["margin"], "margin::profit"),
        attempt("u4l1-capital expenditure-s", ["capital expenditure"], "capital expenditure::opex"),
      ],
    };
    const migrated = migrateVocabulary(old);
    expect(migrated.xp).toBe(321);
    expect(migrated.streak).toBe(5);
    expect(migrated.completedLessonIds).toEqual(old.completedLessonIds);
    expect(migrated.seenConceptIds).toEqual(expect.arrayContaining(["margin", "margin-collateral", "capex"]));
    expect(migrated.seenConceptIds.filter((id) => id === "capex")).toHaveLength(1);
    expect(migrated.mastery["leverage::margin-collateral"].consecutiveCorrect).toBe(2);
    expect(migrated.mastery["margin::profit"].consecutiveCorrect).toBe(3);
    expect(migrated.mastery["capex::opex"].consecutiveCorrect).toBe(1);
    expect(migrated.mastery["capital expenditure::opex"]).toBeUndefined();
    expect(migrated.attempts[0]).toMatchObject({
      ...old.attempts[0],
      conceptIds: ["margin-collateral"],
      confusionPairId: "leverage::margin-collateral",
    });
    expect(migrated.attempts[1]).toEqual(old.attempts[1]);
    expect(migrated.attempts[2].conceptIds).toEqual(["capex"]);
    expect(migrateVocabulary(migrated)).toBe(migrated);
    expect(old.seenConceptIds).toContain("capital expenditure");
  });

  it("does not award profit knowledge for a collateral-only or unscoped seen record", () => {
    const old = {
      ...emptyLearnerState(),
      vocabularyRevision: undefined,
      seenConceptIds: ["margin"],
      completedLessonIds: ["hedge-or-pledge/u1l3"],
    };
    expect(migrateVocabulary(old).seenConceptIds).toEqual(["margin-collateral"]);
    expect(migrateVocabulary({ ...old, completedLessonIds: [] }).seenConceptIds).toEqual([]);
  });
});
