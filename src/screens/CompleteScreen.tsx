import { prefersGeneratedArt, TermArt } from "../art";
import { Confetti, Icon, Mascot } from "../chrome";
import type { Course } from "../domain";
import { conceptOf, type Summary } from "../flow";
import { lessonPairs } from "../pairs";
import type { UiText } from "../ui";

/** Missed concepts, one per pair: "rally / selloff" and "selloff / rally" are one thing to watch. */
function watchList(course: Course, ids: string[]): string[] {
  const seen = new Set<string>();
  return ids.filter((id) => {
    const concept = conceptOf(course, id);
    const key = [id, concept?.mixUp ?? id].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function CompleteScreen(props: {
  summary: Summary;
  bestCombo: number;
  isPractice: boolean;
  lessonId: string;
  course: Course;
  t: UiText;
  motion?: number;
  onStart: (id: string) => void;
  onPractice: (focus?: string[]) => void;
  onPath: () => void;
  onShare: () => void;
  /** Share sheet is open: keep this screen out of tab order and activation. */
  blocked?: boolean;
}) {
  const { summary, t, course } = props;
  const generated = prefersGeneratedArt(course);
  const acc = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
  const lessonIndex = course.lessons.findIndex((lesson) => lesson.id === props.lessonId);
  const next = props.isPractice ? undefined : course.lessons[lessonIndex + 1];
  // A pair goes under "you can tell apart" only if neither word was missed in
  // this run; the missed ones are listed under "keep an eye on" instead.
  const missed = new Set(summary.mix);
  const pairs = (props.isPractice ? [] : lessonPairs(course, props.lessonId)).filter(
    (pair) => !missed.has(pair.a) && !missed.has(pair.b),
  );
  const title = props.isPractice
    ? t.complete.practiceDone
    : summary.xpPerfect > 0
      ? t.complete.flawless
      : acc >= 80
        ? t.complete.great
        : t.complete.done;
  return (
    <main className="done-screen" inert={props.blocked ? true : undefined}>
      <Confetti level={props.motion} />
      <div className="hero-mascot">
        <Mascot mood="cheer" size={148} />
      </div>
      <h1 className="display">{title}</h1>
      <div className="stat-row">
        <div className="stat s-sun">
          <b>{acc}%</b>
          <small>{t.complete.firstTry}</small>
        </div>
        <div className="stat s-mint">
          <b>{props.bestCombo}</b>
          <small>{t.complete.combo}</small>
        </div>
        <div className="stat s-lilac">
          <b>+{summary.gained}</b>
          <small>{t.complete.xp}</small>
        </div>
      </div>
      {pairs.length > 0 && (
        <section className="got">
          <h2>{t.complete.pairsTitle}</h2>
          <ul className="pair-chips big">
            {pairs.map((pair) => {
              const a = conceptOf(course, pair.a);
              const b = conceptOf(course, pair.b);
              if (!a || !b) return null;
              return (
                <li key={pair.id} className="met">
                  <TermArt id={a.id} size="xs" preferGenerated={generated} />
                  {a.term}
                  <i aria-hidden="true">/</i>
                  {b.term}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {summary.mix.length > 0 && (
        <section className="got watch">
          <h2>{t.complete.watch}</h2>
          <ul className="pair-chips">
            {watchList(course, summary.mix).map((id) => {
              const concept = conceptOf(course, id);
              if (!concept) return null;
              const twin = conceptOf(course, concept.mixUp);
              return (
                <li key={id}>
                  {concept.term}
                  {twin && (
                    <>
                      <i aria-hidden="true">/</i>
                      {twin.term}
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <div className="hero-actions">
        {props.isPractice ? (
          <button type="button" className="btn btn-sun btn-block" onClick={() => props.onPractice()}>
            {t.complete.again}
          </button>
        ) : next ? (
          <button type="button" className="btn btn-sun btn-block" onClick={() => props.onStart(next.id)}>
            {t.complete.next}
            <Icon name="arrow" size={18} />
          </button>
        ) : (
          <button type="button" className="btn btn-sun btn-block" onClick={props.onPath}>
            {t.complete.home}
          </button>
        )}
        <div className="foot-row">
          {summary.mix.length > 0 ? (
            <button
              type="button"
              className="btn btn-white btn-grow"
              onClick={() => props.onPractice(summary.mix)}
            >
              {t.complete.practiceThose}
            </button>
          ) : (
            !props.isPractice && (
              <button type="button" className="btn btn-white btn-grow" onClick={props.onShare}>
                <Icon name="share" size={18} />
                {t.complete.share}
              </button>
            )
          )}
          {(next || props.isPractice) && (
            <button type="button" className="btn btn-white btn-grow" onClick={props.onPath}>
              {t.complete.home}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
