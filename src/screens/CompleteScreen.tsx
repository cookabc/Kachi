import { Hedgehog } from "../art";
import type { Course } from "../domain";
import { conceptOf, lessonPair, type Summary } from "../flow";
import type { UiText } from "../ui";

export function CompleteScreen(props: {
  summary: Summary;
  isPractice: boolean;
  lessonId: string;
  course: Course;
  t: UiText;
  motion?: number;
  onStart: (id: string) => void;
  onPractice: (focus?: string[]) => void;
  onPath: () => void;
  onShare: () => void;
}) {
  const { summary, t } = props;
  const acc = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
  const lessonIndex = props.course.lessons.findIndex((lesson) => lesson.id === props.lessonId);
  const next = props.isPractice ? undefined : props.course.lessons[lessonIndex + 1];
  const pair = props.isPractice ? null : lessonPair(props.course, props.lessonId);
  const flawless = summary.xpPerfect > 0;
  return (
    <main className="hero">
      {props.isPractice ? (
        <div className="mascot">
          <Hedgehog />
        </div>
      ) : (
        <div className={`hero-stage${flawless ? " flawless" : ""}`}>
          <div className="mascot">
            <Hedgehog />
          </div>
          {pair && (
            <div className="pair-hero">
              <div className="ph-term">{pair.a}</div>
              <div className="stamp" aria-hidden="true">
                ≠
              </div>
              <div className="ph-term">{pair.b}</div>
            </div>
          )}
        </div>
      )}
      <h1>
        {summary.xpPerfect
          ? t.complete.flawless
          : props.isPractice
            ? t.complete.practiceDone
            : t.complete.done}
      </h1>
      <p className="sub">{t.complete.accuracy(acc, summary.correct, summary.total)}</p>
      <div className="xp-card">
        {props.isPractice ? (
          <div className="xp-row">
            <span>{t.complete.xpCorrect}</span>
            <span>+{summary.xpHit} XP</span>
          </div>
        ) : (
          <>
            <div className="xp-row">
              <span>{t.complete.xpCorrect}</span>
              <span>+{summary.xpHit} XP</span>
            </div>
            <div className="xp-row">
              <span>{t.complete.xpLesson}</span>
              <span>+{summary.xpDone} XP</span>
            </div>
            {summary.xpPerfect > 0 && (
              <div className="xp-row">
                <span>{t.complete.xpPerfect}</span>
                <span>+{summary.xpPerfect} XP</span>
              </div>
            )}
          </>
        )}
        <div className="xp-row total">
          <span>{t.complete.xpTotal}</span>
          <span>+{summary.gained} XP</span>
        </div>
      </div>
      {summary.mix.length > 0 && (
        <>
          <p className="sub" style={{ marginBottom: 8 }}>
            {t.complete.mixTitle}
          </p>
          <div className="chips">
            {summary.mix.map((id) => {
              const concept = conceptOf(props.course, id);
              if (!concept) return null;
              return (
                <span className="chip" key={id}>
                  {concept.term} vs {concept.mixUp}
                </span>
              );
            })}
          </div>
        </>
      )}
      {props.isPractice ? (
        <>
          <button type="button" className="btn btn-gold" onClick={() => props.onPractice()}>
            {t.complete.practiceAgain}
          </button>
          <button type="button" className="btn btn-ghost" onClick={props.onPath}>
            {t.complete.backToPath}
          </button>
        </>
      ) : next ? (
        <>
          <button type="button" className="btn btn-gold" onClick={() => props.onStart(next.id)}>
            {t.complete.nextLesson(next.title)}
          </button>
          {summary.mix.length > 0 && (
            <button type="button" className="btn btn-green" onClick={() => props.onPractice(summary.mix)}>
              {t.complete.practiceThose}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={props.onPath}>
            {t.complete.backToPath}
          </button>
        </>
      ) : (
        <>
          {summary.mix.length > 0 && (
            <button type="button" className="btn btn-green" onClick={() => props.onPractice(summary.mix)}>
              {t.complete.practiceThose}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={props.onPath}>
            {t.complete.backToPath}
          </button>
        </>
      )}
      <button type="button" className="btn btn-ghost share-open" onClick={props.onShare}>
        {t.share.open}
      </button>
    </main>
  );
}
