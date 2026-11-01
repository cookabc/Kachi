import { act, useEffect, useState } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { Summary } from "./flow";
import { handleEnterShortcut, type ShortcutPhase } from "./keyboard";
import { CompleteScreen } from "./screens/CompleteScreen";
import { legacyCourse as course } from "./test-fixtures/legacy-course";
import { UI } from "./ui";

const summary: Summary = {
  gained: 50,
  xpHit: 10,
  xpDone: 20,
  xpPerfect: 20,
  correct: 1,
  total: 1,
  mix: [],
};

const t = UI["zh-CN"];

function Harness({ phase, shareOpen }: { phase: ShortcutPhase; shareOpen: boolean }) {
  const [log, setLog] = useState("");
  const record = (name: string) => setLog((prev) => (prev ? `${prev},${name}` : name));
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      handleEnterShortcut(event, {
        shareOpen,
        phase,
        inSession: true,
        onLessonEnter: () => record("lesson"),
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });
  return (
    <>
      <CompleteScreen
        summary={summary}
        bestCombo={1}
        isPractice={false}
        lessonId="u1l1"
        course={course}
        t={t}
        blocked={shareOpen}
        onStart={() => record("next")}
        onPractice={() => record("practice")}
        onPath={() => record("path")}
        onShare={() => record("share")}
      />
      {shareOpen && (
        <div role="dialog" aria-modal="true">
          <button type="button" onClick={() => record("save")}>
            {t.share.saveImage}
          </button>
        </div>
      )}
      <output>{log}</output>
    </>
  );
}

let root: Root | null = null;
let container: HTMLDivElement | null = null;

async function renderHarness(props: { phase: ShortcutPhase; shareOpen: boolean }) {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
  await act(async () => {
    root?.render(<Harness {...props} />);
  });
}

function buttonNamed(name: string): HTMLButtonElement {
  const found = [...document.querySelectorAll("button")].find((button) => button.textContent?.includes(name));
  if (!(found instanceof HTMLButtonElement)) throw new Error(`missing button ${name}`);
  return found;
}

async function pressEnter(target: EventTarget) {
  const event = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true });
  await act(async () => {
    target.dispatchEvent(event);
  });
  return event;
}

function logText(): string {
  return document.querySelector("output")?.textContent ?? "";
}

afterEach(async () => {
  await act(async () => {
    root?.unmount();
  });
  root = null;
  container?.remove();
  container = null;
});

describe("completion Enter handling", () => {
  it("does not click the first hero button when Enter is pressed on another control", async () => {
    await renderHarness({ phase: "complete", shareOpen: false });
    const back = buttonNamed("做成卡片");
    const event = await pressEnter(back);
    expect(event.defaultPrevented).toBe(false);
    expect(logText()).toBe("");
  });

  it("activates the primary hero button when Enter is pressed outside a control", async () => {
    await renderHarness({ phase: "complete", shareOpen: false });
    const event = await pressEnter(document.body);
    expect(event.defaultPrevented).toBe(true);
    expect(logText()).toBe("next");
  });

  it("leaves the hero buttons alone while the share dialog is open", async () => {
    await renderHarness({ phase: "complete", shareOpen: true });
    expect(document.querySelector("main.done-screen")?.hasAttribute("inert")).toBe(true);
    const save = buttonNamed("保存图片");
    const onSave = await pressEnter(save);
    expect(onSave.defaultPrevented).toBe(false);
    expect(logText()).toBe("");
    const onBody = await pressEnter(document.body);
    expect(onBody.defaultPrevented).toBe(false);
    expect(logText()).toBe("");
  });
});
