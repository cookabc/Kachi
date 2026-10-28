import { useState } from "react";
import { ShareIcon } from "../chrome";
import type { Concept, Course, LearnerState } from "../domain";
import { localizedTerm } from "../localization";
import type { Lang, UiText } from "../ui";
import { ContrastBench } from "./ContrastBench";

/**
 * Whether a glossary card shows its contrast bench: open by explicit toggle,
 * or always while a search is active (searching and deep links from the map
 * are both "I want to read this one now").
 */
export function isCardOpen(id: string, query: string, expanded: ReadonlySet<string>): boolean {
  return query.trim().length > 0 || expanded.has(id);
}

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
  // Cards collapse to one line by default: 40 expanded benches were 21.6
  // screens of scroll, which turns a reference into a hike. Expanding is a
  // per-card toggle; an active search expands everything, because searching
  // and deep links from the map are both "I want to read this one now".
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const isOpen = (id: string) => isCardOpen(id, q, expanded);
  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };
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
                const twin = course.concepts.find((item) => item.id === concept.mixUp);
                const open = isOpen(concept.id);
                return (
                  <article className={`g-card${open ? " open" : ""}`} key={concept.id}>
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
                    <button
                      type="button"
                      className="g-row"
                      aria-expanded={open}
                      onClick={() => toggle(concept.id)}
                    >
                      <h3>
                        {concept.term}
                        {lang === "zh-CN" && <span className="zh">{localizedTerm(concept.id).termZh}</span>}
                        {seen && (
                          <span className="seen" title={t.glossary.seenTitle}>
                            ✓
                          </span>
                        )}
                      </h3>
                      <span className="g-row-twin">↔ {twin?.term ?? concept.mixUp}</span>
                      <span className="g-row-chevron" aria-hidden="true">
                        {open ? "▾" : "▸"}
                      </span>
                    </button>
                    {/* The contrast bench replaces the flat mix-up line: the
                        two words sit either side of a divider the reader
                        drags, so the difference is something they move
                        through rather than something they read twice. */}
                    {open && <ContrastBench concept={concept} course={course} lang={lang} t={t} />}
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
