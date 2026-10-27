import { type CSSProperties, useEffect, useState } from "react";
import { NAV_ICONS } from "./art";
import type { LearnerState } from "./domain";
import { confettiBits } from "./motion";
import type { UiText } from "./ui";

export const MAX_HEARTS = 5;

export type Tab = "learn" | "practice" | "glossary" | "graph" | "settings";

export function StatsBar({ state, t }: { state: LearnerState; t: UiText }) {
  return (
    <div className="stats" role="img" aria-label={t.statsAria(state.xp, state.streak)}>
      <div className="stat xp">
        <span className="ic">◆</span>
        {state.xp}
      </div>
      <div className="stat streak">
        <span className="ic">🔥</span>
        {state.streak}
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

export function Confetti({ level = 100 }: { level?: number }) {
  const [bits, setBits] = useState<CSSProperties[]>([]);
  useEffect(() => {
    const count = confettiBits(level);
    // 0% motion: no burst at all — the slider owns the paper rain
    if (!count) return;
    const colors = ["#86ead4", "#ffc53d", "#7ce2fe", "#e54666", "#bdee63", "#dd93c2"];
    setBits(
      Array.from(
        { length: count },
        (_, i) =>
          ({
            background: colors[i % colors.length],
            width: `${8 + Math.random() * 10}px`,
            height: `${10 + Math.random() * 14}px`,
            left: `${36 + Math.random() * 28}%`,
            top: "26%",
            "--x": `${Math.random() * 260 - 130}px`,
            "--r": `${Math.random() * 420}deg`,
          }) as CSSProperties,
      ),
    );
    const timer = setTimeout(() => setBits([]), 1200);
    return () => clearTimeout(timer);
  }, [level]);
  return (
    <div className="confetti-layer">
      {/* one-shot random burst: the bits have no stable identity beyond position */}
      {bits.map((style, i) => (
        <i key={i} className="bit" style={style} />
      ))}
    </div>
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
