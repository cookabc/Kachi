// Motion intensity: one user-facing 0–100 slider (borrowed from Dopa Drill's
// continuous knob) that scales the confetti density and, at 0, switches every
// animation off. Null (never touched) defers to the OS reduced-motion pref,
// exactly like today's CSS-only behavior; touching the slider pins the choice
// and overrides the OS preference in either direction.

export type MotionBucket = "off" | "scaled" | "full";

const MOTION_KEY = "kachi-motion";

export function clampLevel(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, Math.round(value)));
}

/** Stored level, or null while the learner has never touched the slider. */
export function loadMotionLevel(): number | null {
  try {
    const raw = localStorage.getItem(MOTION_KEY);
    if (raw === null) return null;
    return clampLevel(Number(raw));
  } catch {
    return null;
  }
}

export function saveMotionLevel(level: number): void {
  try {
    localStorage.setItem(MOTION_KEY, String(clampLevel(level)));
  } catch {
    /* private mode: the slider resets next visit, nothing else breaks */
  }
}

/** OS-level prefers-reduced-motion, guarded for non-DOM test environments. */
export function systemPrefersReduced(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

/** What the app should actually run with, before the learner pins a choice. */
export function effectiveLevel(stored: number | null): number {
  if (stored !== null) return clampLevel(stored);
  return systemPrefersReduced() ? 0 : 100;
}

export function bucketFor(level: number): MotionBucket {
  const clamped = clampLevel(level);
  if (clamped === 0) return "off";
  return clamped >= 100 ? "full" : "scaled";
}

/** Mirror the bucket onto <html data-motion> so CSS can react. */
export function applyMotion(level: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.motion = bucketFor(level);
}

/** Confetti bit count for a level: 0 at 0%, the full burst at 100%. */
export function confettiBits(level: number, full = 40): number {
  return Math.round((clampLevel(level) / 100) * full);
}
