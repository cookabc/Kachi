import { describe, expect, it } from "vitest";
import type { Course, Environment } from "@kachi/domain";
import { applyAnswer, emptyLearnerState, startSession } from "./index";

const course: Course = {
  schemaVersion: 1,
  packId: "test",
  contentVersion: "1",
  locale: "zh-CN",
  generatedAt: "2026-08-28T00:00:00.000Z",
  units: [{ id: 1, title: "Test", blurb: "Test" }],
  concepts: [{ id: "hedge", unit: 1, term: "hedge", caption: "", definition: "", example: "", mixUp: "pledge", mixUpWhy: "", sourceIds: [], risk: "evergreen", reviewStatus: "legacy" }],
  lessons: [{ id: "lesson", unit: 1, title: "Test", icon: "", review: false, prompts: [{ id: "one", type: "meaning", termId: "hedge", termIds: ["hedge"], stem: "", options: [{ text: "right" }, { text: "wrong" }], answer: 0, why: "" }] }],
  sources: []
};

const environment: Environment = {
  now: () => new Date("2026-08-28T12:00:00.000Z"),
  random: () => 0.5,
  deviceId: "test-device",
  eventId: () => "event-1"
};

describe("learning engine", () => {
  it("does not mutate published prompt arrays when a session advances", () => {
    const sourcePromptIds = course.lessons[0].prompts.map((prompt) => prompt.id);
    const session = startSession(course, "lesson", environment);
    const result = applyAnswer(course, emptyLearnerState(), session, "right", environment);

    expect(course.lessons[0].prompts.map((prompt) => prompt.id)).toEqual(sourcePromptIds);
    expect(result.session.promptIds).toEqual(sourcePromptIds);
    expect(result.session.mode).toBe("lesson");
    expect(result.finished).toBe(true);
  });
});
