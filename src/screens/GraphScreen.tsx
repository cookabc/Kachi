import { useMemo, useState } from "react";
import type { Course, LearnerState } from "../domain";
import { recentMissTermIds } from "../engine";
import { conceptOf } from "../flow";
import { arcPath, edgePath, graphEdges, graphLayout, labelPlacements } from "../graph";
import { localizedTerm } from "../localization";
import type { UiText } from "../ui";

const VIEW = 480;
const PAD = 131;
// Truncation keeps every label inside the viewBox: at 12px monospace the
// advance is 0.6em, so fourteen characters ≈ 101px and the outermost lane
// (radius + 12 + 3×16) still clears the three-o'clock edge. Lanes are packed
// by exact box collision in labelPlacements().
const LABEL_CHARS = 14;
const CHAR_WIDTH = 7.2;

function labelText(term: string): string {
  return term.length > LABEL_CHARS ? `${term.slice(0, LABEL_CHARS - 1)}…` : term;
}

export function GraphScreen({
  state,
  course,
  t,
  onOpenGlossary,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  onOpenGlossary: (term: string) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);

  const edges = useMemo(() => graphEdges(course), [course]);
  const layout = useMemo(() => graphLayout(course, VIEW, PAD), [course]);
  const labels = useMemo(
    () =>
      labelPlacements(layout, (id) => {
        const concept = conceptOf(course, id);
        return concept ? labelText(concept.term).length * CHAR_WIDTH : 40;
      }),
    [layout, course],
  );
  const seen = useMemo(() => new Set(state.seenConceptIds), [state.seenConceptIds]);
  const missed = useMemo(() => new Set(recentMissTermIds(state)), [state]);

  const selectedConcept = selected ? conceptOf(course, selected) : undefined;
  const unit = selectedConcept ? course.units.find((item) => item.id === selectedConcept.unit) : undefined;

  return (
    <>
      <header className="top">
        <div className="brand">{t.graph.brand}</div>
      </header>

      <div className="scroll g-scroll">
        <p className="g-hint">{t.graph.hint}</p>
        <p className="g-stats">{t.graph.stats(course.concepts.length, edges.length)}</p>

        <div className="g-legend" aria-hidden="true">
          <span className="g-leg">
            <i className="dot seen" /> {t.graph.legendSeen}
          </span>
          <span className="g-leg">
            <i className="dot" /> {t.graph.legendUnseen}
          </span>
          <span className="g-leg">
            <i className="ln e-confusable" /> {t.graph.legendMix}
          </span>
          <span className="g-leg">
            <i className="ln e-prereq" /> {t.graph.legendPrereq}
          </span>
          <span className="g-leg">
            <i className="ln e-sibling" /> {t.graph.legendSibling}
          </span>
        </div>

        {/* The SVG draws the picture; native buttons positioned over the nodes
            carry the interaction so a11y comes from real semantics, not ARIA
            bolted onto SVG elements. */}
        <div className="g-mapwrap">
          <svg
            className={`g-map${selected ? " has-sel" : ""}`}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            aria-hidden="true"
          >
            {/* unit grouping arcs, drawn inside the ring */}
            {layout.unitSpans.map((span) => (
              <g key={span.unit}>
                <path
                  className="g-arc"
                  d={arcPath(layout.center, layout.radius - 12, span.start + 0.02, span.end - 0.02)}
                />
                <text
                  className="g-unit-label"
                  x={layout.center + (layout.radius - 26) * Math.cos(span.mid)}
                  y={layout.center + (layout.radius - 26) * Math.sin(span.mid)}
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  {String(span.unit).padStart(2, "0")}
                </text>
              </g>
            ))}

            {/* edges: quadratic curves bowed through the center */}
            {edges.map((edge) => {
              const d = edgePath(layout, edge);
              if (!d) return null;
              const lit = selected !== null && (edge.a === selected || edge.b === selected);
              return (
                <path
                  key={`${edge.a}::${edge.b}::${edge.type}`}
                  className={`g-edge e-${edge.type}${lit ? " lit" : ""}`}
                  d={d}
                />
              );
            })}

            {/* dots + horizontal lane labels (presentation only) */}
            {layout.nodes.map((node) => {
              const concept = conceptOf(course, node.id);
              if (!concept) return null;
              const label = labels.get(node.id);
              if (!label) return null;
              const status = missed.has(node.id) ? "missed" : seen.has(node.id) ? "seen" : "unseen";
              return (
                <g key={node.id}>
                  <circle className={`g-dot d-${status}`} cx={node.x} cy={node.y} r={6} />
                  <text
                    className={`g-label${node.id === selected ? " sel" : ""}`}
                    x={label.x}
                    y={label.y}
                    textAnchor={label.anchor}
                    dominantBaseline="central"
                  >
                    {labelText(concept.term)}
                  </text>
                </g>
              );
            })}
          </svg>

          {layout.nodes.map((node) => {
            const concept = conceptOf(course, node.id);
            if (!concept) return null;
            const isSelected = node.id === selected;
            return (
              <button
                type="button"
                key={node.id}
                className={`g-hit${isSelected ? " sel" : ""}`}
                style={{ left: `${(node.x / VIEW) * 100}%`, top: `${(node.y / VIEW) * 100}%` }}
                aria-label={concept.term}
                aria-pressed={isSelected}
                onClick={() => setSelected(isSelected ? null : node.id)}
              />
            );
          })}
        </div>

        {selectedConcept && (
          <article className="g-card" aria-live="polite">
            <h3>
              {selectedConcept.term}
              <span className="zh">{localizedTerm(selectedConcept.id).termZh}</span>
            </h3>
            {unit && (
              <p className="g-kicker">
                {t.home.unit(selectedConcept.unit)} · {unit.title}
              </p>
            )}
            <p className="def">{selectedConcept.definition}</p>
            <p className="mu">
              {t.glossary.mix}
              <strong>{conceptOf(course, selectedConcept.mixUp)?.term ?? selectedConcept.mixUp}</strong> —{" "}
              {selectedConcept.mixUpWhy}
            </p>
            {selectedConcept.relations && selectedConcept.relations.length > 0 && (
              <ul className="g-rels">
                {selectedConcept.relations.map((relation) => {
                  const partner = conceptOf(course, relation.with);
                  if (!partner) return null;
                  return (
                    <li key={`${relation.type}::${relation.with}`}>
                      <span className={`g-rel-tag r-${relation.type}`}>
                        {t.graph.relLabels[relation.type]}
                      </span>
                      {partner.term}
                    </li>
                  );
                })}
              </ul>
            )}
            <button type="button" className="g-open" onClick={() => onOpenGlossary(selectedConcept.term)}>
              {t.graph.openGlossary}
              <span aria-hidden="true">↗</span>
            </button>
          </article>
        )}

        <p className="fine">{t.glossary.footer}</p>
      </div>
    </>
  );
}
