import { type CSSProperties, type ReactNode, useEffect, useState } from "react";
import { confettiBits } from "./motion";
import type { UiText } from "./ui";

export type Tab = "learn" | "pairs" | "me";

export type MascotMood = "happy" | "cheer" | "oops" | "think";

/**
 * Kachi the hedgehog. A hedge is the first word the app was built around, and
 * a hedgehog is the friendliest thing that word can turn into. The mascot is
 * the feedback channel kids read first: cheering, dizzy, or thinking.
 */
export function Mascot({ mood = "happy", size = 96 }: { mood?: MascotMood; size?: number }) {
  const ink = "#211C3B";
  const eyes =
    mood === "oops" ? (
      <path
        d="M51 46l7 6M58 46l-7 6M70 46l7 6M77 46l-7 6"
        stroke={ink}
        strokeWidth="3.2"
        strokeLinecap="round"
      />
    ) : mood === "cheer" ? (
      <path
        d="M50 51q4.5-7 9 0M69 51q4.5-7 9 0"
        stroke={ink}
        strokeWidth="3.6"
        fill="none"
        strokeLinecap="round"
      />
    ) : (
      <>
        <circle cx="55" cy="49" r="4.6" fill={ink} />
        <circle cx="73" cy="49" r="4.6" fill={ink} />
        <circle cx="56.7" cy="47.3" r="1.5" fill="#fff" />
        <circle cx="74.7" cy="47.3" r="1.5" fill="#fff" />
      </>
    );
  const mouth =
    mood === "oops" ? (
      <path d="M57 67q7-6 14 0" stroke={ink} strokeWidth="3.2" fill="none" strokeLinecap="round" />
    ) : mood === "think" ? (
      <path d="M58 65h12" stroke={ink} strokeWidth="3.2" strokeLinecap="round" />
    ) : (
      <path d="M55 61q9 10 18 0z" stroke={ink} strokeWidth="3" fill="#FF6A4D" strokeLinejoin="round" />
    );
  return (
    <svg
      className={`mascot mascot-${mood}`}
      viewBox="0 0 128 128"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {mood === "cheer" && (
        <path d="M28 74 14 54M100 74l14-20" stroke={ink} strokeWidth="6" strokeLinecap="round" />
      )}
      <path
        d="M18 80 6 64l15 1-7-19 17 8-2-21 15 13 4-21 12 17 9-19 6 21 15-13-2 21 17-8-7 19 15-1-12 16z"
        fill={ink}
      />
      <ellipse cx="64" cy="78" rx="45" ry="38" fill={ink} />
      <ellipse cx="64" cy="62" rx="31" ry="27" fill="#FFD9A8" stroke={ink} strokeWidth="3" />
      <ellipse cx="45" cy="60" rx="5.5" ry="3.2" fill="#FF8FC7" opacity=".85" />
      <ellipse cx="83" cy="60" rx="5.5" ry="3.2" fill="#FF8FC7" opacity=".85" />
      {eyes}
      <ellipse cx="64" cy="56" rx="4.2" ry="3.2" fill={ink} />
      {mouth}
      {mood === "think" && <circle cx="98" cy="30" r="9" fill="#FFC93C" stroke={ink} strokeWidth="3" />}
      <ellipse cx="46" cy="112" rx="12" ry="6" fill="#FFD9A8" stroke={ink} strokeWidth="3" />
      <ellipse cx="82" cy="112" rx="12" ry="6" fill="#FFD9A8" stroke={ink} strokeWidth="3" />
    </svg>
  );
}

/** Small stroked icons for chrome. One drawing language: 24-grid, round caps. */
const PATHS = {
  learn: "M6 20c0-4.5 12-3.5 12-8S6 7.5 6 4",
  pairs: "M3 5.5h7.5v13H3zM13.5 5.5H21v13h-7.5zM12 3v18",
  me: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20.5c1.2-3.6 4-5.5 7.5-5.5s6.3 1.9 7.5 5.5",
  close: "M6 6l12 12M18 6 6 18",
  check: "m5 12.5 4.5 4.5L19 7.5",
  cross: "M6 6l12 12M18 6 6 18",
  lock: "M7 11V8a5 5 0 0 1 10 0v3M5.5 11h13v9.5h-13z",
  star: "m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
  trophy: "M7 4h10v5a5 5 0 0 1-10 0zM7 6H4a3 3 0 0 0 3 4M17 6h3a3 3 0 0 1-3 4M12 14v4M8 21h8",
  speaker: "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11",
  chevron: "m6 9 6 6 6-6",
  arrow: "M5 12h14M13 6l6 6-6 6",
  bulb: "M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z",
  share: "M12 15V4m0 0L8 8m4-4 4 4M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6",
  refresh: "M20 11a8 8 0 1 0-2.3 5.7M20 5v6h-6",
  play: "M8 5.5v13l10.5-6.5z",
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, fill = false }: { name: IconName; size?: number; fill?: boolean }) {
  return (
    <svg
      className="icon"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill={fill ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={PATHS[name]} />
    </svg>
  );
}

/** Flame and twin-card glyphs carry colour, so they are drawn, not stroked. */
export function FlameGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M12 2.5c1 4 5 5.5 5 11a5 5 0 0 1-10 0c0-2.4 1.2-3.6 2.4-4.6.2 1.6 1 2.6 2 2.9-.7-3.4 0-6.4.6-9.3z"
        fill="#FF6A4D"
        stroke="#211C3B"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function PairGlyph() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect x="2.5" y="5" width="9" height="14" rx="3" fill="#5AB4FF" stroke="#211C3B" strokeWidth="1.6" />
      <rect x="12.5" y="5" width="9" height="14" rx="3" fill="#FF6A4D" stroke="#211C3B" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark() {
  return (
    <span className="wordmark">
      Kachi
      <span className="wordmark-slash" aria-hidden="true" />
    </span>
  );
}

export function TopBar({ children }: { children?: ReactNode }) {
  return (
    <header className="topbar">
      <Wordmark />
      <span className="grow" />
      {children}
    </header>
  );
}

export function Nav({
  tab,
  onTab,
  t,
  pairCount,
}: {
  tab: Tab;
  onTab: (tab: Tab) => void;
  t: UiText;
  pairCount: number;
}) {
  const items: Array<{ id: Tab; icon: IconName }> = [
    { id: "learn", icon: "learn" },
    { id: "pairs", icon: "pairs" },
    { id: "me", icon: "me" },
  ];
  return (
    <nav className="tabbar" aria-label={t.navAria}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          aria-current={tab === item.id ? "page" : undefined}
          onClick={() => onTab(item.id)}
        >
          <Icon name={item.icon} size={24} />
          <span>{t.nav[item.id]}</span>
          {item.id === "pairs" && pairCount > 0 && (
            <span className="tab-badge" aria-hidden="true">
              {pairCount}
            </span>
          )}
        </button>
      ))}
    </nav>
  );
}

export function Confetti({ level = 100 }: { level?: number }) {
  const [bits, setBits] = useState<CSSProperties[]>([]);
  useEffect(() => {
    const count = confettiBits(level, 70);
    if (!count) return;
    const colors = ["#FFC93C", "#5AB4FF", "#FF6A4D", "#2FCB97", "#A98BFF", "#FF8FC7"];
    setBits(
      Array.from(
        { length: count },
        (_, i) =>
          ({
            background: colors[i % colors.length],
            left: `${Math.random() * 100}%`,
            "--dx": `${Math.random() * 200 - 100}px`,
            "--r": `${Math.random() * 900 - 450}deg`,
            animationDuration: `${1.6 + Math.random() * 1.6}s`,
            animationDelay: `${Math.random() * 0.4}s`,
          }) as CSSProperties,
      ),
    );
    const timer = setTimeout(() => setBits([]), 3800);
    return () => clearTimeout(timer);
  }, [level]);
  if (!bits.length) return null;
  return (
    <div className="confetti" aria-hidden="true">
      {/* one-shot random burst: the bits have no identity beyond position */}
      {bits.map((style, i) => (
        <i key={i} style={style} />
      ))}
    </div>
  );
}
