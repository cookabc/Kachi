import { useMemo, useState } from "react";
import type { Course, LearnerState } from "../domain";
import { isVerifiedMastery, pairIdForConcept, recentMissTermIds } from "../engine";
import { conceptOf } from "../flow";
import { arcPath, edgePath, graphEdges, graphLayout, labelPlacements } from "../graph";
import { weakLinks } from "../graph/weak-link";
import { localizedTerm } from "../localization";
import type { UiText } from "../ui";

type GraphStatus = "unseen" | "seen" | "learning" | "mastered" | "missed";

const VIEW = 480;
const PAD = 131;
// Truncation keeps every label inside the viewBox: at 12px monospace the
// advance is 0.6em, so fourteen characters ≈ 101px and the outermost lane
// still clears the three-o'clock edge. Lanes are packed by exact box
// collision in labelPlacements(); a label that cannot fit any lane is
// dropped there and the dot stays on the ring.
const LABEL_CHARS = 14;
const CHAR_WIDTH = 7.2;

function labelText(term: string): string {
  if (term.length <= LABEL_CHARS) return term;
  // Cut at a separator when one is nearby: "securities-ba…" reads like a
  // bug, "securities-…" reads like an abbreviation.
  const slice = term.slice(0, LABEL_CHARS - 1);
  const cut = Math.max(slice.lastIndexOf("-"), slice.lastIndexOf(" "));
  return `${term.slice(0, cut > LABEL_CHARS / 2 ? cut : LABEL_CHARS - 1)}…`;
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
  const seen = useMemo(() => new Set(state.seenConceptIds), [state.seenConceptIds]);
  const missed = useMemo(() => new Set(recentMissTermIds(state)), [state]);

  // Four learning states, derived from data the engine already records. The map
  // used to show only seen/unseen, so a learner at "two correct in a row" looked
  // identical to one who had merely opened the word.
  const progress = useMemo(() => {
    const map = new Map<string, { status: GraphStatus; streak: number }>();
    for (const concept of course.concepts) {
      const pairId = pairIdForConcept(concept);
      const entry = pairId ? state.mastery[pairId] : undefined;
      const streak = entry?.consecutiveCorrect ?? 0;
      let status: GraphStatus;
      if (isVerifiedMastery(entry)) status = "mastered";
      else if (streak > 0) status = "learning";
      else if (missed.has(concept.id)) status = "missed";
      else if (seen.has(concept.id)) status = "seen";
      else status = "unseen";
      map.set(concept.id, { status, streak });
    }
    return map;
  }, [course, state, seen, missed]);
  const labels = useMemo(
    () =>
      labelPlacements(
        layout,
        (id) => {
          const concept = conceptOf(course, id);
          return concept ? labelText(concept.term).length * CHAR_WIDTH : 40;
        },
        {
          // 放不下的标签会被丢弃，所以先让最要紧的词占位：
          // 错过的词是复习的线索，学过的词是你的领地。
          priority: (id) => (missed.has(id) ? 2 : seen.has(id) ? 1 : 0),
        },
      ),
    [layout, course, missed, seen],
  );
  // The learner's weak links: the unseen terms closest to what they know.
  const weak = useMemo(() => weakLinks(course, state.seenConceptIds, 3), [course, state.seenConceptIds]);

  const selectedConcept = selected ? conceptOf(course, selected) : undefined;
  const selectedProgress = selected ? progress.get(selected) : undefined;
  const unit = selectedConcept ? course.units.find((item) => item.id === selectedConcept.unit) : undefined;

  return (
    <>
      <header className="top">
        <div className="brand">{t.graph.brand}</div>
      </header>

      <div className="scroll g-scroll">
        <p className="g-hint">{t.graph.hint}</p>
        <p className="g-stats">{t.graph.stats(course.concepts.length, edges.length)}</p>

        {/* Why the learner is stuck. The map is a picture of every relation;
            this answers the question the picture raises — which unseen term
            is holding the rest back, and what it would unlock. */}
        {weak.length > 0 && (
          <section className="g-weak" aria-labelledby="gWeakTitle">
            <h3 id="gWeakTitle" className="g-kicker">
              {t.graph.weakTitle}
            </h3>
            <ul className="g-weak-list">
              {weak.map((link) => (
                <li key={link.id}>
                  <button
                    type="button"
                    className="g-weak-item"
                    onClick={() => setSelected(link.id)}
                    aria-label={`${link.term}${link.unlocks ? ` — unlocks ${link.unlocks}` : ""}`}
                  >
                    <span className="g-weak-term">{link.term}</span>
                    {link.chain.length > 0 ? (
                      <span className="g-weak-chain">
                        {link.chain.map((id) => {
                          const concept = conceptOf(course, id);
                          return concept ? (
                            <span key={id} className="g-weak-step">
                              {concept.term}
                            </span>
                          ) : null;
                        })}
                      </span>
                    ) : (
                      <span className="g-weak-chain g-weak-chain--none">{t.graph.weakExplore}</span>
                    )}
                    {link.unlocks > 0 && (
                      <span className="g-weak-unlocks">{t.graph.weakUnlocks(link.unlocks)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="g-legend" aria-hidden="true">
          <span className="g-leg">
            <i className="dot seen" /> {t.graph.legendSeen}
          </span>
          <span className="g-leg">
            <i className="dot learning" /> {t.graph.legendLearning}
          </span>
          <span className="g-leg">
            <i className="dot mastered" /> {t.graph.legendMastered}
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

            {/* dots always; a label only when a lane fit (see labelPlacements) */}
            {layout.nodes.map((node) => {
              const concept = conceptOf(course, node.id);
              if (!concept) return null;
              const label = labels.get(node.id);
              const status = progress.get(node.id)?.status ?? "unseen";
              return (
                <g key={node.id}>
                  {status === "mastered" && <circle className="g-dot-halo" cx={node.x} cy={node.y} r={6} />}
                  <circle className={`g-dot d-${status}`} cx={node.x} cy={node.y} r={6} />
                  {label && (
                    <text
                      className={`g-label${node.id === selected ? " sel" : ""}`}
                      x={label.x}
                      y={label.y}
                      textAnchor={label.anchor}
                      dominantBaseline="central"
                    >
                      {labelText(concept.term)}
                    </text>
                  )}
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
                {t.home.unit(selectedConcept.unit)}，{unit.title}
              </p>
            )}
            <p className="def">{selectedConcept.definition}</p>
            {selectedProgress && selectedProgress.streak > 0 && (
              <p className={`g-mastery${selectedProgress.status === "mastered" ? " done" : ""}`}>
                {selectedProgress.status === "mastered"
                  ? t.graph.legendMastered
                  : t.graph.masteryTitle(selectedProgress.streak)}
              </p>
            )}
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
