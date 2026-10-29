import { Hedgehog } from "../art";
import type { Course, LearnerState } from "../domain";
import { duePairIds, missHistory } from "../engine";
import { conceptOf, PRACTICE_ROUND } from "../flow";
import { zhTermFor } from "../localization";
import type { Lang, UiText } from "../ui";

/** The terms due for practice, grouped by the unit they live in.
 *
 *  The same derivation the round itself uses (duePairIds feeds
 *  practicePool), so the list never promises a term the round will not
 *  drill. Pair ids are "a::b" concept keys; a due mispair may name a term
 *  that is not a published concept's canonical partner, so both halves are
 *  collected and the unknown ones dropped. */
export function practiceTargets(
  state: LearnerState,
  course: Course,
  lang: Lang,
): Array<{ unit: number; terms: string[] }> {
  const focus = new Set<string>();
  for (const pairId of duePairIds(state, new Date())) {
    for (const id of pairId.split("::")) {
      if (conceptOf(course, id)) focus.add(id);
    }
  }
  const byUnit = new Map<number, string[]>();
  for (const id of focus) {
    const concept = conceptOf(course, id)!;
    const list = byUnit.get(concept.unit) ?? [];
    const label = lang === "zh-CN" ? (zhTermFor(concept) ?? concept.term) : concept.term;
    list.push(label);
    byUnit.set(concept.unit, list);
  }
  const sortLocale = lang === "zh-CN" ? "zh" : "en";
  return [...byUnit.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([unit, terms]) => ({ unit, terms: terms.sort((a, b) => a.localeCompare(b, sortLocale)) }));
}

export function PracticeHome({
  state,
  course,
  t,
  lang,
  missedCount,
  onStart,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  lang: Lang;
  missedCount: number;
  onStart: () => void;
}) {
  const targets = practiceTargets(state, course, lang);

  // The mistake book: failed attempts aggregated per concept, worst first, so
  // the tab answers "what have I been getting wrong" and not just "what is due
  // today". The why-line is the pair explanation — the same sentence the teach
  // card and the feedback sheet use, so the fix reads the same everywhere.
  const misses = missHistory(state)
    .map((record) => {
      const concept = conceptOf(course, record.conceptId);
      if (!concept) return null;
      return {
        conceptId: record.conceptId,
        term: concept.term,
        misses: record.misses,
        why: concept.mixUpWhy,
      };
    })
    .filter((entry): entry is NonNullable<typeof entry> => entry !== null);

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
        {misses.length > 0 && (
          <section className="prac-misses" aria-labelledby="pracMissesTitle">
            <h2 id="pracMissesTitle" className="g-kicker">
              {t.practice.missBookTitle}
            </h2>
            <ul>
              {misses.slice(0, 5).map(({ conceptId, term, misses: count, why }) => (
                <li key={conceptId}>
                  <span className="prac-miss-term">{term}</span>
                  <span className="prac-miss-count">{t.practice.missCountCopy(count)}</span>
                  {why && <span className="prac-miss-why">{why}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}
        {targets.length > 0 && (
          <section className="prac-targets" aria-labelledby="pracTargetsTitle">
            <h2 id="pracTargetsTitle" className="g-kicker">
              {t.practice.targetsTitle}
            </h2>
            <ul>
              {targets.slice(0, 4).map(({ unit, terms }) => (
                <li key={unit}>
                  <span className="prac-target-unit">{t.practice.unitLabel(unit)}</span>
                  <span className="prac-target-terms">
                    {terms.slice(0, 4).join(t.practice.listSep)}
                    {terms.length > 4 ? <em>　{t.practice.moreCount(terms.length - 4)}</em> : null}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
