import type { Concept, Course } from "../domain";
import { conceptOf } from "../flow";
import { localizedTerm } from "../localization";
import type { Lang, UiText } from "../ui";

export function ContrastBench({
  concept,
  course,
  lang,
  t,
}: {
  concept: Concept;
  course: Course;
  lang: Lang;
  t: UiText;
}) {
  const twin = conceptOf(course, concept.mixUp);
  if (!twin) return null;
  return (
    <section className="concept-comparison" aria-label={t.bench.ariaLabel}>
      <div className="concept-comparison-pair">
        {[concept, twin].map((term) => {
          const translated = lang === "zh-CN" ? localizedTerm(term.id) : null;
          return (
            <div key={term.id}>
              <h3>{term.term}</h3>
              {translated && <span>{translated.termZh}</span>}
              <p>{term.definition}</p>
              <details>
                <summary>{t.glossary.forExample}</summary>
                <p>{term.example}</p>
              </details>
            </div>
          );
        })}
      </div>
      <p className="concept-comparison-difference">{concept.mixUpWhy}</p>
    </section>
  );
}
