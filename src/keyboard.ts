export type ShortcutPhase = "teach" | "question" | "feedback" | "complete" | "fail";

const FOCUSED_CONTROL = "button, a, input, textarea, select, [role='dialog']";

export function handleEnterShortcut(
  event: KeyboardEvent,
  options: {
    shareOpen: boolean;
    phase: ShortcutPhase;
    inSession: boolean;
    onLessonEnter: () => void;
  },
): void {
  if (event.key !== "Enter") return;
  const inLesson = options.phase === "teach" || options.phase === "question" || options.phase === "feedback";
  if (options.inSession && inLesson) {
    event.preventDefault();
    options.onLessonEnter();
    return;
  }
  if (options.phase !== "complete" && options.phase !== "fail") return;
  // A focused button, link, or the share dialog already has a job for Enter.
  // Clicking the first .hero .btn here starts the next lesson under the dialog
  // and under whichever control the learner actually focused.
  if (options.shareOpen) return;
  const target = event.target;
  if (target instanceof Element && target.closest(FOCUSED_CONTROL)) return;
  event.preventDefault();
  document.querySelector<HTMLElement>(".hero .btn")?.click();
}
