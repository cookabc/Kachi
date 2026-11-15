import type { Concept, SourceReference } from "../domain";
import type { Lang } from "../ui";

export function TermAliases({ concept, lang }: { concept: Concept; lang: Lang }) {
  if (!concept.aliases?.length) return null;
  return (
    <p className="term-aliases">
      {lang === "zh-CN" ? "也称：" : "Also: "}
      {concept.aliases.join(" / ")}
    </p>
  );
}

/** Optional full-width reading below the compact twin cards. */
export function ConceptInfo({
  concept,
  lang,
  sources = [],
}: {
  concept: Concept;
  lang: Lang;
  sources?: SourceReference[];
}) {
  const zh = lang === "zh-CN";
  const learning = concept.learning;
  const references = sources.filter((source) => concept.sourceIds.includes(source.id) && source.url);
  if (!learning) return null;
  return (
    <details className="concept-info">
      <summary>
        {concept.term} · {zh ? "例子与用法" : "Example & use"}
      </summary>
      <dl>
        <dt>{zh ? "算一遍／看个例子" : "An example"}</dt>
        <dd>{learning.workedExample}</dd>
        <dt>{zh ? "用在哪里" : "Where it helps"}</dt>
        <dd>{learning.application}</dd>
        <dt>{zh ? "容易误解" : "Common trap"}</dt>
        <dd>{learning.misconception}</dd>
      </dl>
      {concept.jurisdiction && (
        <p>
          {zh ? "适用语境：" : "Context: "}
          {concept.jurisdiction === "US" ? (zh ? "美国" : "United States") : concept.jurisdiction}
          {concept.asOf && ` · ${concept.asOf}`}
        </p>
      )}
      {references.length > 0 && (
        <ul aria-label={zh ? "参考来源" : "References"}>
          {references.map((source) => (
            <li key={source.id}>
              <a href={source.url} target="_blank" rel="noreferrer">
                {source.title}
              </a>
            </li>
          ))}
        </ul>
      )}
    </details>
  );
}
