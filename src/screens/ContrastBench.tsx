import { useCallback, useEffect, useRef, useState } from "react";
import { artIdForLabel, TermArt } from "../art";
import type { Concept, Course } from "../domain";
import { conceptOf } from "../flow";
import { localizedTerm } from "../localization";
import type { Lang, UiText } from "../ui";

/**
 * The contrast bench: one term and the term it is confused with, side by
 * side, separated by a divider the reader drags.
 *
 * Kachi's entire argument is that these words are *confusable* — hedge and
 * pledge look alike in a headline and mean opposite things. A glossary entry
 * that lists both in a column never shows that difference; the reader has
 * to hold two definitions in their head and compare them.
 *
 * The bench makes the comparison physical. Both terms sit on the same
 * surface, one on either side of a cut. Sliding the cut moves the boundary
 * between them, so the reader sees how much of the page each word claims
 * and where the meaning changes over.
 *
 * It is a real control: the divider is a slider with a value, so it works
 * from the keyboard and reports its position to a screen reader.
 */
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
  const [split, setSplit] = useState(50);
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const isZh = lang === "zh-CN";
  const zh = isZh ? localizedTerm(concept.id) : null;
  const twinZh = twin && isZh ? localizedTerm(twin.id) : null;

  const setFromClientX = useCallback((clientX: number) => {
    const element = track.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const ratio = ((clientX - rect.left) / rect.width) * 100;
    setSplit(Math.max(6, Math.min(94, ratio)));
  }, []);

  const onPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      dragging.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
      setFromClientX(event.clientX);
    },
    [setFromClientX],
  );

  const onPointerMove = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragging.current) return;
      setFromClientX(event.clientX);
    },
    [setFromClientX],
  );

  const onPointerUp = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    dragging.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }, []);

  const onKeyDown = useCallback((event: React.KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 10 : 3;
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      setSplit((value) => Math.max(6, value - step));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      setSplit((value) => Math.min(94, value + step));
    } else if (event.key === "Home") {
      event.preventDefault();
      setSplit(6);
    } else if (event.key === "End") {
      event.preventDefault();
      setSplit(94);
    }
  }, []);

  // A pointer that leaves the window mid-drag would otherwise leave the
  // divider stuck under the cursor.
  useEffect(() => {
    const stop = () => {
      dragging.current = false;
    };
    window.addEventListener("pointerup", stop);
    window.addEventListener("pointercancel", stop);
    return () => {
      window.removeEventListener("pointerup", stop);
      window.removeEventListener("pointercancel", stop);
    };
  }, []);

  if (!twin) return null;

  return (
    <section className="bench" aria-label={t.bench.ariaLabel}>
      <header className="bench__head">
        <span className="bench__kicker">{t.bench.kicker}</span>
        <p className="bench__why">{concept.mixUpWhy}</p>
      </header>

      <div
        className="bench__track"
        ref={track}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        <div className="bench__side bench__side--a" style={{ width: `${split}%` }} aria-hidden={split < 22}>
          <div className="bench__term">
            <TermArt id={artIdForLabel(concept.term)} size="sm" />
            <div>
              <strong>{concept.term}</strong>
              {zh && <span className="bench__zh">{zh.termZh}</span>}
            </div>
          </div>
          <p className="bench__def">{concept.definition}</p>
          <p className="bench__ex">
            <span className="bench__ex-label">{t.glossary.forExample}</span>
            {concept.example}
          </p>
        </div>

        <div
          className="bench__side bench__side--b"
          style={{ width: `${100 - split}%` }}
          aria-hidden={split > 78}
        >
          <div className="bench__term">
            <TermArt id={artIdForLabel(twin.term)} size="sm" />
            <div>
              <strong>{twin.term}</strong>
              {twinZh && <span className="bench__zh">{twinZh.termZh}</span>}
            </div>
          </div>
          <p className="bench__def">{twin.definition}</p>
          <p className="bench__ex">
            <span className="bench__ex-label">{t.glossary.forExample}</span>
            {twin.example}
          </p>
        </div>

        {/* The divider itself is the control: a real slider, so it can be
            moved with the arrow keys and reports its position. */}
        <div
          className="bench__divider"
          role="slider"
          tabIndex={0}
          aria-label={t.bench.sliderLabel}
          aria-valuemin={6}
          aria-valuemax={94}
          aria-valuenow={Math.round(split)}
          aria-valuetext={`${concept.term} ${Math.round(split)}% / ${twin.term} ${100 - Math.round(split)}%`}
          onKeyDown={onKeyDown}
          style={{ left: `${split}%` }}
        >
          <span className="bench__grip" aria-hidden="true">
            <span>‹</span>
            <span>›</span>
          </span>
        </div>
      </div>

      <p className="bench__hint">{t.bench.hint}</p>
    </section>
  );
}
