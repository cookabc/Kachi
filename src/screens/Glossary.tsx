import { ShareIcon } from "../chrome";
import type { Concept, Course, LearnerState } from "../domain";
import { localizedTerm } from "../localization";
import type { Lang, UiText } from "../ui";

export function Glossary({
  state,
  course,
  t,
  lang,
  query,
  onQuery,
  onShare,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  lang: Lang;
  query: string;
  onQuery: (value: string) => void;
  onShare: (conceptIds: string[]) => void;
}) {
  const q = query.trim().toLowerCase();
  const matches = (concept: Concept) =>
    !q ||
    `${concept.term} ${concept.definition} ${concept.mixUp} ${localizedTerm(concept.id).termZh}`
      .toLowerCase()
      .includes(q);
  let total = 0;
  return (
    <>
      <header className="top">
        <div className="brand">{t.glossary.brand}</div>
      </header>
      <div className="g-search">
        <input
          type="search"
          placeholder={t.glossary.placeholder}
          value={query}
          onChange={(event) => onQuery(event.target.value)}
          autoComplete="off"
          aria-label={t.glossary.searchAria}
        />
      </div>
      <div className="g-list">
        {course.units.map((unit) => {
          const terms = course.concepts.filter((concept) => concept.unit === unit.id && matches(concept));
          if (!terms.length) return null;
          total += terms.length;
          return (
            <section key={unit.id}>
              <div className={`unit-banner mini u${unit.id}`}>
                <div className="kicker">{t.home.unit(unit.id)}</div>
                <h2>{unit.title}</h2>
              </div>
              {terms.map((concept) => {
                const seen = state.seenConceptIds.includes(concept.id);
                return (
                  <article className="g-card" key={concept.id}>
                    <h3>
                      {concept.term}
                      {lang === "zh-CN" && <span className="zh">{localizedTerm(concept.id).termZh}</span>}
                      {seen && (
                        <span className="seen" title={t.glossary.seenTitle}>
                          ✓
                        </span>
                      )}
                      {seen && (
                        <button
                          type="button"
                          className="g-share"
                          aria-label={t.share.open}
                          title={t.share.open}
                          onClick={() => onShare([concept.id])}
                        >
                          <ShareIcon />
                        </button>
                      )}
                    </h3>
                    <p className="def">{concept.definition}</p>
                    <p className="ex">
                      {t.glossary.forExample}
                      {concept.example}
                    </p>
                    <p className="mu">
                      {t.glossary.mix}
                      <strong>{concept.mixUp}</strong> — {concept.mixUpWhy}
                    </p>
                  </article>
                );
              })}
            </section>
          );
        })}
        {total === 0 && (
          <div className="g-empty">
            {t.glossary.empty(query.trim())}
            <br />
            {t.glossary.emptyHint}
          </div>
        )}
      </div>
      <p className="fine">{t.glossary.footer}</p>
    </>
  );
}
