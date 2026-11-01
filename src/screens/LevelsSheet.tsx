import { Icon } from "../chrome";
import type { UiText } from "../ui";
import { Sheet } from "./Sheet";

export interface LevelChoice {
  id: string;
  level: number;
  title: string;
  goal: string;
  conceptCount: number;
  /** Words of this level the learner has already met in another level. */
  known: number;
}

/**
 * The six levels. Every level is open — they are ordered by what you read,
 * not gated, so an adult who already follows the front page can go straight to
 * bonds. The current one is marked; the counts say how much is new.
 */
export function LevelsSheet({
  levels,
  current,
  loadingId,
  failedId,
  t,
  onPick,
  onRetry,
  onClose,
}: {
  levels: LevelChoice[];
  current: string;
  loadingId: string | null;
  /** The level that just failed to load, if any: shown here, inside the modal. */
  failedId: string | null;
  t: UiText;
  onPick: (id: string) => void;
  onRetry: () => void;
  onClose: () => void;
}) {
  return (
    <Sheet label={t.levels.title} onClose={onClose}>
      <h2 className="sheet-title display">{t.levels.title}</h2>
      <p className="sheet-copy">{t.levels.copy}</p>
      {failedId && (
        <div className="banner alert in-sheet" role="alert">
          <p>{t.courseLoadFailed}</p>
          <button type="button" className="btn btn-white btn-sm" onClick={onRetry}>
            {t.retryLoad}
          </button>
        </div>
      )}
      <ul className="level-list">
        {levels.map((level) => (
          <li key={level.id}>
            <button
              type="button"
              className={`level-item${level.id === current ? " on" : ""}`}
              aria-pressed={level.id === current}
              onClick={() => onPick(level.id)}
            >
              <span className={`level-badge l${level.level}`}>{level.level}</span>
              <span className="grow">
                <b>{level.title}</b>
                <small>{level.goal}</small>
                <small className="level-meta">
                  {t.levels.words(level.conceptCount)}
                  {level.known > 0 && ` · ${t.levels.known(level.known)}`}
                </small>
              </span>
              {loadingId === level.id ? (
                <span className="level-state">{t.levels.loading}</span>
              ) : level.id === current ? (
                <span className="level-state on">{t.levels.current}</span>
              ) : (
                <Icon name="arrow" size={20} />
              )}
            </button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}
