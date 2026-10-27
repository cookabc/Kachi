import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { course } from "./course";
import { emptyLearnerState } from "./engine";
import { GraphScreen } from "./screens/GraphScreen";
import { LearnHome } from "./screens/LearnHome";
import { UI } from "./ui";

function staticStrings(value: unknown): string[] {
  if (typeof value === "string") return [value];
  if (!value || typeof value !== "object") return [];
  return Object.values(value).flatMap((item) => staticStrings(item));
}

describe("interface copy", () => {
  it("names the units that are actually open", () => {
    expect(UI["zh-CN"].home.unitNote([1], 7)).toBe("单元 1 已解锁，其余单元完成前面的课程后开放。");
    expect(UI["zh-CN"].home.unitNote([1, 2], 7)).toBe("单元 1 和 2 已解锁，其余单元完成前面的课程后开放。");
    expect(UI["zh-CN"].home.unitNote([1, 2, 3], 7)).toBe(
      "单元 1、2 和 3 已解锁，其余单元完成前面的课程后开放。",
    );
    expect(UI["zh-CN"].home.unitNote([1, 2, 3], 3)).toBe("单元 1、2 和 3 已全部解锁。");
    expect(UI["en-US"].home.unitNote([1], 7)).toBe(
      "Unit 1 is open. The rest unlock as you finish the ones before them.",
    );
    expect(UI["en-US"].home.unitNote([1, 2], 7)).toBe(
      "Units 1 and 2 are open. The rest unlock as you finish the ones before them.",
    );
    expect(UI["en-US"].home.unitNote([1, 2, 3], 3)).toBe("Every unit is open.");
  });

  it("keeps Han out of the English chrome, aside from the language name", () => {
    const en = {
      ...UI["en-US"],
      settings: { ...UI["en-US"].settings, langNames: { "zh-CN": "", "en-US": "English" } },
    };
    expect(staticStrings(en).join("\n")).not.toMatch(/\p{Script=Han}/u);
    expect(UI["en-US"].statsAria(12, 3)).toBe("XP 12, streak 3");
    expect(UI["zh-CN"].statsAria(12, 3)).toBe("经验值 12，连续学习 3 天");
    expect(UI["en-US"].graph.weakItemAria("hedge", 2)).toBe("hedge, unlocks 2 terms");
    expect(UI["zh-CN"].graph.weakItemAria("hedge", 2)).toBe("hedge，会解锁 2 个词");
    expect(UI["en-US"].lesson.mixCue("Opposites")).toBe("Don't mix up · Opposites");
    expect(UI["zh-CN"].lesson.mixCue("义反")).toBe("别混淆 · 义反");
  });
});

describe("rendered chrome", () => {
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

  it("tells a new learner that only unit 1 is open", () => {
    render(
      <LearnHome
        state={emptyLearnerState()}
        course={course}
        t={UI["zh-CN"]}
        missedCount={0}
        onStart={() => undefined}
      />,
    );
    expect(container?.textContent).toContain("单元 1 已解锁，其余单元完成前面的课程后开放。");
    expect(container?.textContent).not.toContain("单元 1 和 2 已解锁");
    expect(container?.querySelector(".stats")?.getAttribute("aria-label")).toBe("经验值 0，连续学习 0 天");
    expect(container?.textContent).toContain("对冲还是质押");
  });

  it("uses English chrome, including the stats name, on the English home", () => {
    render(
      <LearnHome
        state={emptyLearnerState()}
        course={course}
        t={UI["en-US"]}
        missedCount={0}
        onStart={() => undefined}
      />,
    );
    expect(container?.textContent).toContain(
      "Unit 1 is open. The rest unlock as you finish the ones before them.",
    );
    expect(container?.querySelector(".stats")?.getAttribute("aria-label")).toBe("XP 0, streak 0");
    expect(container?.querySelector("[role='progressbar']")?.getAttribute("aria-label")).toBe(
      "Course progress",
    );
  });

  it("localizes the weak-link name instead of hardcoding English", () => {
    render(
      <GraphScreen
        state={emptyLearnerState()}
        course={course}
        t={UI["zh-CN"]}
        lang="zh-CN"
        onOpenGlossary={() => undefined}
      />,
    );
    const labels = [...(container?.querySelectorAll(".g-weak-item") ?? [])].map(
      (node) => node.getAttribute("aria-label") ?? "",
    );
    expect(labels.length).toBeGreaterThan(0);
    expect(labels.join("\n")).not.toMatch(/unlocks/i);
    expect(labels.some((label) => label.includes("会解锁"))).toBe(true);
  });
});
