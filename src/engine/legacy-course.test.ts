import { describe, expect, it } from "vitest";
import rawCourse from "../../content/packs/hedge-or-pledge/zh-CN/course.json";
import type { Course, Environment, Exercise } from "../domain";
import { validateCourse } from "../schema";
import { applyAnswer, currentExercise, emptyLearnerState, MAX_ATTEMPT_LOG, startSession } from "./index";

const course = rawCourse as Course;
let sequence = 0;
const environment: Environment = {
  now: () => new Date("2026-08-28T12:00:00.000Z"),
  random: () => 0.5,
  deviceId: "test-device",
  eventId: () => `event-${++sequence}`,
};

function correctAnswer(prompt: Exercise): string | boolean {
  if (prompt.type === "match") return "matched";
  if (prompt.type === "truefalse") return Boolean(prompt.answer);
  if (prompt.type === "fill") return String(prompt.answer);
  if (typeof prompt.answer !== "number" || !prompt.options)
    throw new Error(`No choice answer for ${prompt.id}`);
  return prompt.options[prompt.answer].text;
}

describe("migrated Hedge or Pledge course", () => {
  it("has the expected legacy coverage and passes structural validation", () => {
    // Units 1-5 are the original course; 6-7 (rates, commodities) extend it.
    expect(course.lessons).toHaveLength(23);
    expect(course.concepts).toHaveLength(40);
    expect(new Set(course.lessons.flatMap((lesson) => lesson.prompts.map((prompt) => prompt.id))).size).toBe(
      208,
    );
    expect(validateCourse(course)).toEqual([]);
    expect(course.units[0].title).toBe("对冲还是质押");
    expect(course.units[0].blurb).toBe("是保护它，还是拿它去借钱？");
  });

  it("can run 500 complete sessions without mutating published lessons", () => {
    const source = JSON.stringify(course.lessons);
    let state = emptyLearnerState();
    for (let run = 0; run < 500; run += 1) {
      let session = startSession(course, "u1l1", environment);
      while (currentExercise(course, session)) {
        const prompt = currentExercise(course, session)!;
        const result = applyAnswer(course, state, session, correctAnswer(prompt), environment);
        state = result.state;
        session = result.session;
      }
    }
    expect(JSON.stringify(course.lessons)).toBe(source);
    // Completed lessons are namespaced by pack so two courses cannot collide.
    expect(state.completedLessonIds).toEqual(["hedge-or-pledge/u1l1"]);
    // The attempt log is capped. Replaying the same perfect lesson also pays
    // its XP once: 10 prompts × 10, plus the completion and flawless bonuses.
    expect(state.attempts).toHaveLength(MAX_ATTEMPT_LOG);
    expect(state.xp).toBe(140);
  });

  it("records a miss but advances instead of failing the lesson", () => {
    const session = startSession(course, "u1l1", environment);
    const result = applyAnswer(course, emptyLearnerState(), session, "not the right answer", environment);

    expect(result.attempt.correct).toBe(false);
    expect(result.finished).toBe(false);
    expect(result.session.index).toBe(1);
    expect(result.state.attempts).toHaveLength(1);
  });
});
