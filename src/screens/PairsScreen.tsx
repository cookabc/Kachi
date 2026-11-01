import { useState } from "react";
import { prefersGeneratedArt, TermArt } from "../art";
import { speak } from "../audio";
import { Icon, PairGlyph, TopBar } from "../chrome";
import type { Course, LearnerState, MixUpType } from "../domain";
import { conceptOf } from "../flow";
import { ipaFor } from "../ipa";
import { zhTermFor } from "../localization";
import { coursePairs, duePairs, isPairMet, type Pair, pairStrength } from "../pairs";
import type { Lang, UiText } from "../ui";
import { Sheet } from "./Sheet";

/**
 * The pair album. It replaces the old glossary, knowledge map and practice
 * tab: what a learner wants to look up is "which two words do I mix up", and
 * collecting those pairs is a goal a twelve-year-old understands without a
 * legend. Unmet pairs show as silhouettes, so the album also previews the road.
 */
export function PairsScreen({
  state,
  course,
  t,
  lang,
  onShare,
  onPractice,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  lang: Lang;
  onShare: (conceptIds: string[]) => void;
  onPractice: (conceptIds: string[]) => void;
}) {
  const generated = prefersGeneratedArt(course);
  const pairs = coursePairs(course);
  const [filter, setFilter] = useState<MixUpType | "all">("all");
  const [open, setOpen] = useState<Pair | null>(null);
  const [toast, setToast] = useState(false);
  const met = pairs.filter((pair) => isPairMet(state, pair)).length;
  const dueIds = new Set(duePairs(state, course, new Date()).map((pair) => pair.id));
  const types = (Object.keys(t.mixTypes) as MixUpType[]).filter((type) =>
    pairs.some((pair) => pair.type === type),
  );

  return (
    <div className="screen pairs">
      <TopBar>
        <span className="pill">
          <PairGlyph />
          {t.pairs.count(met, pairs.length)}
        </span>
      </TopBar>
      <h1 className="page-title display">{t.pairs.title}</h1>
      <p className="page-copy">{t.pairs.copy}</p>
      <div
        className="meter"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={pairs.length}
        aria-valuenow={met}
        aria-label={t.pairs.count(met, pairs.length)}
      >
        <i style={{ width: `${Math.max(2, (met / Math.max(pairs.length, 1)) * 100)}%` }} />
      </div>
      <fieldset className="filters" aria-label={t.pairs.all}>
        <button type="button" aria-pressed={filter === "all"} onClick={() => setFilter("all")}>
          {t.pairs.all}
        </button>
        {types.map((type) => (
          <button type="button" key={type} aria-pressed={filter === type} onClick={() => setFilter(type)}>
            <i className={`dot type-${type}`} aria-hidden="true" />
            {t.mixTypes[type].name}
          </button>
        ))}
      </fieldset>
      {course.units.map((unit) => {
        const list = pairs.filter(
          (pair) => pair.unit === unit.id && (filter === "all" || pair.type === filter),
        );
        if (!list.length) return null;
        return (
          <section className="album-unit" key={unit.id}>
            <h2 className="display">
              {unit.title}
              <small>
                {list.filter((pair) => isPairMet(state, pair)).length}/{list.length}
              </small>
            </h2>
            <div className="album-grid">
              {list.map((pair) => {
                const isMet = isPairMet(state, pair);
                const a = conceptOf(course, pair.a);
                const b = conceptOf(course, pair.b);
                if (!a || !b) return null;
                const strength = pairStrength(state.mastery[pair.id]);
                return (
                  <button
                    type="button"
                    key={pair.id}
                    className={`pcard${isMet ? "" : " locked"}`}
                    aria-label={isMet ? `${a.term} / ${b.term}` : t.pairs.lockedHint}
                    onClick={() => {
                      if (isMet) setOpen(pair);
                      else {
                        setToast(true);
                        setTimeout(() => setToast(false), 2000);
                      }
                    }}
                  >
                    <span className="pcard-pics" aria-hidden="true">
                      <TermArt id={a.id} size="lg" preferGenerated={generated} />
                      <TermArt id={b.id} size="lg" preferGenerated={generated} />
                    </span>
                    <b>
                      {isMet ? a.term : t.pairs.hidden}
                      <i aria-hidden="true">/</i>
                      {isMet ? b.term : t.pairs.hidden}
                    </b>
                    <span className={`tag type-${pair.type}`}>{t.mixTypes[pair.type].name}</span>
                    {isMet && dueIds.has(pair.id) && <span className="due-badge">{t.pairs.due}</span>}
                    {isMet && (
                      <span className="stars" role="img" aria-label={t.pairs.strength[strength]}>
                        {[0, 1, 2].map((n) => (
                          <i key={n} className={n < strength ? "on" : ""} />
                        ))}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
      {toast && (
        <p className="toast" role="status">
          {t.pairs.lockedHint}
        </p>
      )}
      {open && (
        <Sheet
          label={`${conceptOf(course, open.a)?.term} / ${conceptOf(course, open.b)?.term}`}
          onClose={() => setOpen(null)}
        >
          <PairDetail
            pair={open}
            course={course}
            t={t}
            lang={lang}
            strength={pairStrength(state.mastery[open.id])}
            onShare={() => onShare([open.a])}
            onPractice={() => {
              setOpen(null);
              onPractice([open.a, open.b]);
            }}
          />
        </Sheet>
      )}
    </div>
  );
}

function PairDetail({
  pair,
  course,
  t,
  lang,
  strength,
  onShare,
  onPractice,
}: {
  pair: Pair;
  course: Course;
  t: UiText;
  lang: Lang;
  strength: 0 | 1 | 2 | 3;
  onShare: () => void;
  onPractice: () => void;
}) {
  const generated = prefersGeneratedArt(course);
  const sides = [conceptOf(course, pair.a), conceptOf(course, pair.b)];
  return (
    <div className="pair-detail">
      <div className="twins compact">
        {sides.map((concept, index) =>
          concept ? (
            <div key={concept.id} className={`twin twin-${index ? "b" : "a"}`}>
              <div className="twin-art">
                <TermArt id={concept.id} size="hero" preferGenerated={generated} />
              </div>
              <div className="twin-term">{concept.term}</div>
              <div className="twin-ipa">
                {lang === "zh-CN" && zhTermFor(concept) && (
                  <span className="twin-zh">{zhTermFor(concept)}</span>
                )}
                {ipaFor(concept.id) && <span>{ipaFor(concept.id)}</span>}
                <button
                  type="button"
                  className="speak"
                  aria-label={t.lesson.speakAria(concept.term)}
                  onClick={() => void speak(concept.term, { conceptId: concept.id })}
                >
                  <Icon name="speaker" size={16} />
                </button>
              </div>
              <p className="twin-cap">{concept.definition}</p>
            </div>
          ) : null,
        )}
        <span className="vs" aria-hidden="true">
          vs
        </span>
      </div>
      <div className="trick">
        <span className="trick-icon" aria-hidden="true">
          <Icon name="bulb" size={22} />
        </span>
        <div>
          <b className={`type-label type-${pair.type}`}>
            {t.mixTypes[pair.type].name} · {t.lesson.trick}
          </b>
          <p>{pair.why}</p>
        </div>
      </div>
      <p className="strength-line">
        <span className="stars">
          {[0, 1, 2].map((n) => (
            <i key={n} className={n < strength ? "on" : ""} />
          ))}
        </span>
        {t.pairs.strength[strength]}
      </p>
      <div className="foot-row">
        <button type="button" className="btn btn-white" onClick={onShare}>
          <Icon name="share" size={18} />
          {t.pairs.share}
        </button>
        <button type="button" className="btn btn-sun btn-grow" onClick={onPractice}>
          {t.pairs.practice}
        </button>
      </div>
    </div>
  );
}
