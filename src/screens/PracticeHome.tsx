import { Hedgehog } from "../art";
import type { Course, LearnerState } from "../domain";
import { duePairIds } from "../engine";
import { conceptOf, PRACTICE_ROUND } from "../flow";
import { localizedTerm } from "../localization";
import type { UiText } from "../ui";

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
    list.push(localizedTerm(id).termZh || concept.term);
    byUnit.set(concept.unit, list);
  }
  return [...byUnit.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([unit, terms]) => ({ unit, terms: terms.sort((a, b) => a.localeCompare(b, "zh")) }));
}

export function PracticeHome({
  state,
  course,
  t,
  missedCount,
  onStart,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  missedCount: number;
  onStart: () => void;
}) {
  const targets = practiceTargets(state, course);

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
                    {terms.slice(0, 4).join("、")}
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
