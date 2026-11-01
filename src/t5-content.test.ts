import { describe, expect, it } from "vitest";
import { AUDIT_REVIEWS, AUDITS } from "../content/packs/t5-quant-research/audits.mjs";
import en from "../content/packs/t5-quant-research/en-US/course.json";
import zh from "../content/packs/t5-quant-research/zh-CN/course.json";
import type { Course, Environment } from "./domain";
import { emptyLearnerState, isCorrect, lessonKey, startSession } from "./engine";
import { present } from "./flow";
import { type FlowEvent, idleState, reduceFlow } from "./flow-machine";

const environment: Environment = {
  now: () => new Date("2026-11-01T00:00:00Z"),
  random: () => 0.37,
  deviceId: "t5-test",
  eventId: () => "t5-event",
};

for (const [locale, data] of [
  ["zh", zh],
  ["en", en],
] as const) {
  const course = data as Course;
  const audits = course.lessons.flatMap((l) => l.prompts).filter((p) => p.type === "audit");

  describe(`T5 ${locale} published audit cases`, () => {
    it("publishes every authored case, with application practice in all six units", () => {
      expect(audits).toHaveLength(Object.keys(AUDITS).length + AUDIT_REVIEWS.length);
      for (const unit of course.units) {
        const lessons = course.lessons.filter((l) => l.unit === unit.id);
        const taught = lessons.filter((l) => !l.review).flatMap((l) => l.prompts);
        expect(taught.filter((p) => p.type === "audit").length, unit.title).toBeGreaterThanOrEqual(4);
        for (const lesson of lessons.filter((l) => !l.review)) {
          for (const prompt of lesson.prompts.filter((p) => p.type === "audit")) {
            const source = AUDITS[prompt.termId as keyof typeof AUDITS][locale];
            expect(prompt.story).toBe(source.claim);
            expect(prompt.stem).toBe(source.stem);
            expect(prompt.options?.map((o) => o.text)).toEqual(source.options);
            expect(prompt.answer).toBe(source.answer);
            expect(prompt.why).toBe(source.why);
          }
        }
      }
    });

    it("leads reviews with fresh cases and never tests a later unit's concepts", () => {
      const taughtStories = new Set(
        course.lessons.filter((l) => !l.review).flatMap((l) => l.prompts.map((p) => p.story)),
      );
      for (const lesson of course.lessons.filter((l) => l.review)) {
        const sources = AUDIT_REVIEWS.filter((d) => d.unit === lesson.unit);
        expect(sources).toHaveLength(2);
        const ids = sources.map((d) => `${lesson.id}-${d.id}`);
        expect(startSession(course, lesson.id, environment).promptIds.slice(0, 2)).toEqual(ids);
        for (const [index, drill] of sources.entries()) {
          const prompt = lesson.prompts[index];
          expect(prompt.type).toBe("audit");
          expect(prompt.stem).toBe(drill[locale].stem);
          expect(prompt.story).toBe(drill[locale].claim);
          expect(taughtStories.has(prompt.story), prompt.id).toBe(false);
          for (const id of prompt.termIds) {
            const concept = course.concepts.find((c) => c.id === id);
            expect(concept, id).toBeDefined();
            expect(concept!.unit, id).toBeLessThanOrEqual(lesson.unit);
          }
        }
      }
    });

    it("grades every published answer correctly after option shuffling", () => {
      for (const prompt of audits) {
        expect(new Set(prompt.options!.map((o) => o.text)).size, prompt.id).toBe(4);
        const shown = present(prompt, environment.random);
        expect(isCorrect(prompt, shown.correctText!), prompt.id).toBe(true);
        for (const option of shown.options!) {
          expect(isCorrect(prompt, option.text), `${prompt.id}: ${option.text}`).toBe(
            option.text === shown.correctText,
          );
        }
      }
    });

    it("rehearses a missed review case after the lesson without paying XP twice", () => {
      const lesson = course.lessons.find((l) => l.id === "u1r")!;
      const learner = emptyLearnerState();
      learner.completedLessonIds = [lessonKey(course, "u1l2")];
      const context = { course, environment };
      let state = idleState(learner);
      const step = (event: FlowEvent) => {
        state = reduceFlow(state, event, context).state;
      };
      step({ type: "startLesson", lessonId: lesson.id });
      while (state.flow.phase === "teach") step({ type: "teachContinue" });
      const first = state.flow.presented!;
      expect(first.id).toBe(lesson.prompts[0].id);
      const wrong = first.options!.find((o) => o.text !== first.correctText)!.text;
      step({ type: "submit", answer: wrong, latencyMs: 1000 });
      expect(state.flow.lastCorrect).toBe(false);
      step({ type: "continue" });
      expect(state.flow.session!.promptIds.at(-1)).toBe(first.id);
      for (let guard = 0; state.flow.phase !== "complete" && guard < 100; guard++) {
        if (state.flow.phase === "feedback") {
          step({ type: "continue" });
          continue;
        }
        const prompt = state.flow.presented!;
        if (prompt.type === "match") {
          for (const pair of prompt.pairs!)
            step({ type: "submitMatch", leftId: pair.id, rightId: pair.id, latencyMs: 1000 });
        } else {
          step({
            type: "submit",
            answer: prompt.correctText ?? (prompt.answer as string | boolean),
            latencyMs: 1000,
          });
          if (prompt.id === first.id) expect(state.learner.attempts.at(-1)?.isRetry).toBe(true);
        }
      }
      expect(state.flow.phase).toBe("complete");
      expect(state.learner.xp).toBe((lesson.prompts.length - 1) * 10 + 20);
      expect(state.learner.completedLessonIds).toContain(lessonKey(course, lesson.id));
      expect(state.learner.attempts.filter((a) => a.exerciseId === first.id)).toHaveLength(2);
    });
  });
}

it("keeps audit IDs, English excerpts and answer indexes aligned across locales", () => {
  const english = en.lessons.flatMap((l) => l.prompts).filter((p) => p.type === "audit");
  const chinese = zh.lessons.flatMap((l) => l.prompts).filter((p) => p.type === "audit");
  expect(english.map((p) => p.id)).toEqual(chinese.map((p) => p.id));
  for (const [index, prompt] of english.entries()) {
    expect(prompt.answer).toBe(chinese[index].answer);
    expect(prompt.story).toBe(chinese[index].story);
    expect(/[\u4e00-\u9fff]/.test(JSON.stringify(prompt)), prompt.id).toBe(false);
    expect(/[\u4e00-\u9fff]/.test(chinese[index].why), prompt.id).toBe(true);
  }
});
