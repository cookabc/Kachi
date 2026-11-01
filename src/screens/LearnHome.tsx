import { useState } from "react";
import { prefersGeneratedArt, TermArt } from "../art";
import { FlameGlyph, Icon, Mascot, PairGlyph, TopBar } from "../chrome";
import type { Course, LearnerState } from "../domain";
import { isLessonDone, isLessonUnlocked } from "../engine";
import { conceptOf } from "../flow";
import { coursePairs, duePairs, isPairMet, lessonPairs, nextLessonIndex } from "../pairs";
import type { UiText } from "../ui";

export interface LevelInfo {
  level: number;
  title: string;
  goal: string;
}

const WELCOME_KEY = "kachi-welcomed";

/** Zig-zag offsets for the trail, in px. Fixed so the path reads as a road. */
const TRAIL = [0, -64, -28, 36, 64, 28];

export function LearnHome({
  state,
  course,
  t,
  level,
  nextLevel,
  now,
  onStart,
  onReview,
  onLevels,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  level: LevelInfo;
  nextLevel?: LevelInfo;
  now: Date;
  onStart: (lessonId: string) => void;
  onReview: () => void;
  onLevels: () => void;
}) {
  const generated = prefersGeneratedArt(course);
  const pairs = coursePairs(course);
  const met = pairs.filter((pair) => isPairMet(state, pair)).length;
  const due = duePairs(state, course, now).length;
  const nextIndex = nextLessonIndex(state, course);
  const finished = nextIndex < 0;
  const featured = course.lessons[finished ? 0 : nextIndex];
  const featuredPair =
    lessonPairs(course, featured.id).find((pair) => !isPairMet(state, pair)) ??
    lessonPairs(course, featured.id)[0] ??
    pairs[0];
  // First visit only: one sentence on why words come in pairs. Shown until
  // dismissed or until the first lesson is finished.
  const [welcome, setWelcome] = useState(() => {
    try {
      return state.completedLessonIds.length === 0 && localStorage.getItem(WELCOME_KEY) !== "1";
    } catch {
      return false;
    }
  });
  const dismissWelcome = () => {
    setWelcome(false);
    try {
      localStorage.setItem(WELCOME_KEY, "1");
    } catch {
      /* private mode: the card returns next visit, nothing else breaks */
    }
  };
  const a = featuredPair ? conceptOf(course, featuredPair.a) : undefined;
  const b = featuredPair ? conceptOf(course, featuredPair.b) : undefined;

  return (
    <div className="screen home">
      <TopBar>
        <span className="pill" role="img" aria-label={t.statsAria(state.streak, met, pairs.length)}>
          <FlameGlyph />
          {state.streak}
        </span>
        <span className="pill" aria-hidden="true">
          <PairGlyph />
          {met}/{pairs.length}
        </span>
      </TopBar>

      <button type="button" className="level-btn" onClick={onLevels} aria-haspopup="dialog">
        <span className={`level-badge l${level.level}`}>{level.level}</span>
        <span className="grow">
          <b>{level.title}</b>
          <small>{level.goal}</small>
        </span>
        <Icon name="chevron" size={20} />
      </button>

      {welcome && (
        <section className="welcome" aria-labelledby="welcome-title">
          <Mascot mood="happy" size={60} />
          <div className="grow">
            <h2 id="welcome-title" className="display">
              {t.home.welcomeTitle}
            </h2>
            <p>{t.home.welcomeCopy}</p>
            <button type="button" className="btn btn-white btn-sm" onClick={dismissWelcome}>
              {t.home.welcomeOk}
            </button>
          </div>
        </section>
      )}

      {due > 0 && (
        <section className="review-card">
          <Mascot mood="think" size={64} />
          <div className="grow">
            <b>{t.home.review(due)}</b>
            <small>{t.home.reviewCopy}</small>
          </div>
          <button type="button" className="btn btn-white btn-sm" onClick={onReview}>
            <Icon name="refresh" size={18} />
            {t.home.reviewGo}
          </button>
        </section>
      )}

      {finished && (
        <section className="cleared">
          <Mascot mood="cheer" size={88} />
          <p>{nextLevel ? t.home.nextLevel(nextLevel.title) : t.home.allDone}</p>
          {nextLevel && (
            <button type="button" className="btn btn-ink" onClick={onLevels}>
              {nextLevel.title}
              <Icon name="arrow" size={18} />
            </button>
          )}
        </section>
      )}

      {a && b && !finished && (
        <section className="today" aria-labelledby="today-title">
          <div className="today-meta">
            <span>{t.home.upNext}</span>
            <span>{featured.review ? t.home.bossRound : featured.title}</span>
          </div>
          <div className="duo" aria-hidden="true">
            <span className="duo-card l">
              <TermArt id={a.id} size="hero" preferGenerated={generated} />
            </span>
            <span className="vs">vs</span>
            <span className="duo-card r">
              <TermArt id={b.id} size="hero" preferGenerated={generated} />
            </span>
          </div>
          <h2 id="today-title" className="today-title display">
            {a.term}
            <span className="slash" aria-hidden="true">
              /
            </span>
            {b.term}
          </h2>
          <p className="today-copy">
            {t.mixTypes[featuredPair.type].tip} {t.home.canYou}
          </p>
          <button type="button" className="btn btn-ink btn-block" onClick={() => onStart(featured.id)}>
            <Icon name="play" size={18} fill />
            {t.home.play}
          </button>
        </section>
      )}

      {course.units.map((unit) => {
        const lessons = course.lessons
          .map((lesson, index) => ({ lesson, index }))
          .filter(({ lesson }) => lesson.unit === unit.id);
        const unitPairs = pairs.filter((pair) => pair.unit === unit.id);
        const done = lessons.filter(({ lesson }) => isLessonDone(state, course, lesson.id)).length;
        return (
          <section className="unit" key={unit.id} aria-labelledby={`unit-${unit.id}`}>
            <header className={`unit-head${done === lessons.length ? " complete" : ""}`}>
              <span className="unit-no">{unit.id}</span>
              <div className="grow">
                <h3 id={`unit-${unit.id}`} className="display">
                  {unit.title}
                </h3>
                <p>{unit.blurb}</p>
                <ul className="pair-chips">
                  {unitPairs.map((pair) => {
                    const left = conceptOf(course, pair.a);
                    const right = conceptOf(course, pair.b);
                    if (!left || !right) return null;
                    return (
                      <li key={pair.id} className={isPairMet(state, pair) ? "met" : ""}>
                        <TermArt id={left.id} size="xs" preferGenerated={generated} />
                        {left.term}
                        <i aria-hidden="true">/</i>
                        {right.term}
                      </li>
                    );
                  })}
                </ul>
              </div>
              <span className="unit-count">{t.home.unitProgress(done, lessons.length)}</span>
            </header>
            <ol className="trail">
              {lessons.map(({ lesson, index }) => {
                const isDone = isLessonDone(state, course, lesson.id);
                const unlocked = isLessonUnlocked(state, course, lesson.id);
                const current = index === nextIndex;
                const label = lesson.review
                  ? t.home.bossRound
                  : lessonPairs(course, lesson.id)
                      .slice(0, 2)
                      .map((pair) => conceptOf(course, pair.a)?.term)
                      .join(" · ");
                const name = !unlocked
                  ? t.home.locked(lesson.title)
                  : isDone
                    ? t.home.done(lesson.title)
                    : lesson.title;
                return (
                  <li key={lesson.id} style={{ transform: `translateX(${TRAIL[index % TRAIL.length]}px)` }}>
                    <button
                      type="button"
                      className={`node${isDone ? " done" : ""}${current ? " current" : ""}${unlocked ? "" : " locked"}${lesson.review ? " boss" : ""}`}
                      aria-label={name}
                      aria-current={current ? "step" : undefined}
                      disabled={!unlocked}
                      onClick={() => onStart(lesson.id)}
                    >
                      <Icon
                        name={!unlocked ? "lock" : lesson.review ? "trophy" : isDone ? "check" : "star"}
                        size={32}
                        fill={unlocked && !lesson.review && !isDone}
                      />
                      {current && <span className="node-tip">{t.home.start}</span>}
                    </button>
                    <span className="node-label" aria-hidden="true">
                      {label}
                    </span>
                  </li>
                );
              })}
            </ol>
          </section>
        );
      })}
      <p className="fineprint">{t.home.disclaimer}</p>
    </div>
  );
}
