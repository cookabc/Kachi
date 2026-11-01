import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { course } from "./course";
import { emptyLearnerState } from "./engine";
import { LearnHome } from "./screens/LearnHome";
import { legacyCourse } from "./test-fixtures/legacy-course";
import { UI } from "./ui";

function staticStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((item) => staticStrings(item));
}

describe("interface copy", () => {
  it("keeps Han out of the English chrome, aside from the language name", () => {
    const en = { ...UI["en-US"], me: { ...UI["en-US"].me, langNames: { "zh-CN": "", "en-US": "English" } } };
    expect(staticStrings(en).join("\n")).not.toMatch(/\p{Script=Han}/u);
    expect(UI["en-US"].statsAria(3, 4, 26)).toBe("3-day streak, 4 of 26 pairs met");
    expect(UI["zh-CN"].statsAria(3, 4, 26)).toBe("连续学习 3 天，已认识 4/26 组词对");
  });

  it("names every mix-up type in kid-friendly words, in both languages", () => {
    for (const lang of ["en-US", "zh-CN"] as const) {
      for (const [type, copy] of Object.entries(UI[lang].mixTypes)) {
        expect(copy.name, `${lang} ${type}`).toBeTruthy();
        expect(copy.tip, `${lang} ${type}`).toBeTruthy();
      }
    }
  });

  it("gives both locales the same shape", () => {
    const keys = (value: unknown, prefix = ""): string[] =>
      value && typeof value === "object" && !Array.isArray(value)
        ? Object.entries(value).flatMap(([key, item]) => [
            `${prefix}${key}`,
            ...keys(item, `${prefix}${key}.`),
          ])
        : [];
    expect(keys(UI["zh-CN"]).sort()).toEqual(keys(UI["en-US"]).sort());
  });
});

describe("rendered home", () => {
  let root: Root | null = null;
  let container: HTMLDivElement | null = null;

  afterEach(() => {
    act(() => {
      root?.unmount();
    });
    root = null;
    container?.remove();
    container = null;
  });

  function render(node: ReactNode) {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => {
      root?.render(node);
    });
  }

  const level = { level: 1, title: "Read the front page", goal: "Headlines" };

  it("features the first pair and opens only the first lesson for a new learner", () => {
    render(
      <LearnHome
        state={emptyLearnerState()}
        course={course}
        t={UI["zh-CN"]}
        level={level}
        now={new Date()}
        onStart={() => undefined}
        onReview={() => undefined}
        onLevels={() => undefined}
      />,
    );
    expect(container?.querySelector(".today-title")?.textContent).toBe("rally/selloff");
    const nodes = [...(container?.querySelectorAll(".node") ?? [])] as HTMLButtonElement[];
    expect(nodes.length).toBe(course.lessons.length);
    expect(nodes.filter((node) => !node.disabled)).toHaveLength(1);
    expect(container?.querySelector(".pill")?.getAttribute("aria-label")).toBe(
      "连续学习 0 天，已认识 0/26 组词对",
    );
  });

  it("uses English chrome on the English home", () => {
    render(
      <LearnHome
        state={emptyLearnerState()}
        course={legacyCourse}
        t={UI["en-US"]}
        level={level}
        now={new Date()}
        onStart={() => undefined}
        onReview={() => undefined}
        onLevels={() => undefined}
      />,
    );
    expect(container?.textContent).toContain("Let’s play");
    expect(container?.querySelector(".today-title")?.textContent).toBe("hedge/pledge");
  });

  it("offers a review when a pair is due", () => {
    const state = emptyLearnerState();
    state.mastery["rally::selloff"] = {
      confusionPairId: "rally::selloff",
      consecutiveCorrect: 1,
      lapses: 0,
      evidenceTypes: ["meaning"],
      unseenScenarioCorrect: false,
      dueAt: "2000-01-01T00:00:00.000Z",
      schedulerVersion: "test",
    };
    render(
      <LearnHome
        state={state}
        course={course}
        t={UI["en-US"]}
        level={level}
        now={new Date()}
        onStart={() => undefined}
        onReview={() => undefined}
        onLevels={() => undefined}
      />,
    );
    expect(container?.querySelector(".review-card")?.textContent).toContain("1 pair is ready for review");
  });
});
