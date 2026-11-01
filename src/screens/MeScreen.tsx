import type { ChangeEvent } from "react";
import { version } from "../../package.json";
import { prefersGeneratedArt, TermArt } from "../art";
import { FlameGlyph, Mascot, PairGlyph, TopBar } from "../chrome";
import type { Course, LearnerState } from "../domain";
import { isLessonDone, missHistory } from "../engine";
import { conceptOf } from "../flow";
import { coursePairs, isPairMet } from "../pairs";
import type { Lang, UiText } from "../ui";

/**
 * Me: progress, the words that trip you most, and the few settings that
 * matter (language, motion, your data). Settings used to be a whole tab; it is
 * three rows here because learners touch it a handful of times, ever.
 */
export function MeScreen({
  state,
  course,
  t,
  lang,
  motion,
  onLang,
  onMotion,
  onPractice,
  onExport,
  onImport,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  lang: Lang;
  motion: number;
  onLang: (lang: Lang) => void;
  onMotion: (level: number) => void;
  onPractice: (conceptIds: string[]) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  const generated = prefersGeneratedArt(course);
  const pairs = coursePairs(course);
  const met = pairs.filter((pair) => isPairMet(state, pair)).length;
  const lessons = course.lessons.filter((lesson) => isLessonDone(state, course, lesson.id)).length;
  // One row per pair: "rally / selloff" and "selloff / rally" are one slip.
  const seenPairs = new Set<string>();
  const weak = missHistory(state)
    .filter((record) => {
      const concept = conceptOf(course, record.conceptId);
      if (!concept) return false;
      const key = [concept.id, concept.mixUp].sort().join("|");
      if (seenPairs.has(key)) return false;
      seenPairs.add(key);
      return true;
    })
    .slice(0, 5);
  return (
    <div className="screen me">
      <TopBar />
      <div className="me-hero">
        <Mascot mood="happy" size={104} />
        <h1 className="page-title display">{t.me.title}</h1>
      </div>
      <div className="stat-grid">
        <div className="stat s-sun">
          <FlameGlyph />
          <b>{state.streak}</b>
          <small>{t.me.streak}</small>
        </div>
        <div className="stat s-mint">
          <PairGlyph />
          <b>
            {met}
            <span>/{pairs.length}</span>
          </b>
          <small>{t.me.pairs}</small>
        </div>
        <div className="stat s-lilac">
          <b>{state.xp}</b>
          <small>{t.me.xp}</small>
        </div>
        <div className="stat s-sky">
          <b>
            {lessons}
            <span>/{course.lessons.length}</span>
          </b>
          <small>{t.me.lessons}</small>
        </div>
      </div>

      <section className="panel">
        <h2 className="display">{t.me.weak}</h2>
        {weak.length ? (
          <>
            <ul className="weak-list">
              {weak.map((record) => {
                const concept = conceptOf(course, record.conceptId);
                const twin = concept ? conceptOf(course, concept.mixUp) : undefined;
                if (!concept) return null;
                return (
                  <li key={record.conceptId}>
                    <TermArt id={concept.id} size="sm" preferGenerated={generated} />
                    <span className="grow">
                      {concept.term}
                      {twin && (
                        <>
                          <i aria-hidden="true">/</i>
                          {twin.term}
                        </>
                      )}
                    </span>
                    <span className="miss-count">×{record.misses}</span>
                  </li>
                );
              })}
            </ul>
            <button
              type="button"
              className="btn btn-sun btn-block"
              onClick={() => onPractice(weak.map((record) => record.conceptId))}
            >
              {t.me.practiceWeak}
            </button>
          </>
        ) : (
          <p className="muted">{t.me.weakEmpty}</p>
        )}
      </section>

      <section className="panel">
        <h2 className="display">{t.me.lang}</h2>
        <fieldset className="segmented" aria-label={t.me.lang}>
          {(Object.entries(t.me.langNames) as Array<[Lang, string]>).map(([value, name]) => (
            <button type="button" key={value} aria-pressed={lang === value} onClick={() => onLang(value)}>
              {name}
            </button>
          ))}
        </fieldset>
        <label className="range-row" htmlFor="motion-range">
          <span>{t.me.motion}</span>
          <input
            id="motion-range"
            type="range"
            min={0}
            max={100}
            step={5}
            value={motion}
            onChange={(event) => onMotion(Number(event.target.value))}
            aria-valuetext={t.me.motionHint(motion)}
          />
        </label>
        <p className="muted small">{t.me.motionHint(motion)}</p>
      </section>

      <section className="panel">
        <h2 className="display">{t.me.data}</h2>
        <p className="muted">{t.me.dataCopy}</p>
        <div className="foot-row">
          <button type="button" className="btn btn-white btn-grow" onClick={onExport}>
            {t.me.exportBtn}
          </button>
          <label className="btn btn-white btn-grow file-btn">
            {t.me.importBtn}
            <input type="file" accept="application/json" onChange={onImport} />
          </label>
        </div>
      </section>

      <section className="panel about">
        <h2 className="display">{t.me.about}</h2>
        <p className="muted">{t.me.aboutCopy}</p>
        <dl>
          <div>
            <dt>{t.me.version}</dt>
            <dd>{version}</dd>
          </div>
          <div>
            <dt>{t.me.license}</dt>
            <dd>AGPL-3.0 · CC BY-SA 4.0</dd>
          </div>
          <div>
            <dt>{t.me.source}</dt>
            <dd>
              <a href="https://github.com/cookabc/Kachi" target="_blank" rel="noreferrer">
                github.com/cookabc/Kachi
              </a>
            </dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
