import { NAV_ICONS } from "./art";
import type { LearnerState } from "./domain";
import type { UiText } from "./ui";

export const MAX_HEARTS = 5;

export type Tab = "learn" | "practice" | "glossary" | "graph" | "settings";

export function StatsBar({ state }: { state: LearnerState }) {
  return (
    <div className="stats" role="img" aria-label={`XP ${state.xp}, ${state.streak}`}>
      <div className="stat xp">{state.xp} XP</div>
      <div className="stat streak">
        {state.streak}{" "}
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          aria-hidden="true"
        >
          <path d="M12 3c2 5-1 6-1 9 2-1 3-3 3-5 4 4 5 6 5 9a7 7 0 0 1-14 0c0-4 4-7 7-13Z" />
        </svg>
      </div>
    </div>
  );
}

export function HeartRow({ n, popped, t }: { n: number; popped: boolean; t: UiText }) {
  return (
    <div className="hearts" role="img" aria-label={t.lesson.heartsAria(n, MAX_HEARTS)}>
      {/* fixed-length indicator: the hearts never reorder, so the index is the identity */}
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <span key={i} className={`ht ${i < n ? "full" : popped && i === n ? "empty pop" : "empty"}`}>
          ♥
        </span>
      ))}
    </div>
  );
}

export function Nav({ tab, onTab, t }: { tab: Tab; onTab: (tab: Tab) => void; t: UiText }) {
  const items: Array<{ id: Tab; text: UiText["nav"]["learn"] }> = [
    { id: "learn", text: t.nav.learn },
    { id: "practice", text: t.nav.practice },
    { id: "glossary", text: t.nav.glossary },
    { id: "graph", text: t.nav.graph },
    { id: "settings", text: t.nav.settings },
  ];
  return (
    <nav className="nav" aria-label={t.navAria}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={tab === item.id ? "on" : ""}
          aria-label={item.text.aria}
          onClick={() => onTab(item.id)}
        >
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, code-owned SVG icon markup from art.tsx */}
          <span dangerouslySetInnerHTML={{ __html: NAV_ICONS[item.id] }} />
          {item.text.label}
        </button>
      ))}
    </nav>
  );
}

export function ShareIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 15V4m0 0L8 8m4-4 4 4" />
      <path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" />
    </svg>
  );
}
