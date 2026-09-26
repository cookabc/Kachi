import { Hedgehog } from "../art";
import { PRACTICE_ROUND } from "../flow";
import type { UiText } from "../ui";

export function PracticeHome({
  t,
  missedCount,
  onStart,
}: {
  t: UiText;
  missedCount: number;
  onStart: () => void;
}) {
  return (
    <>
      <header className="top">
        <div className="brand">{t.practice.brand}</div>
      </header>
      <div className="prac-hero">
        <Hedgehog />
        <h1>{t.practice.title}</h1>
        {missedCount > 0 ? (
          <p className="sub">{t.practice.missCopy(missedCount)}</p>
        ) : (
          <p className="sub">{t.practice.noMissCopy}</p>
        )}
        <button type="button" className="btn btn-gold" onClick={onStart}>
          {t.practice.start(PRACTICE_ROUND)}
        </button>
      </div>
    </>
  );
}
