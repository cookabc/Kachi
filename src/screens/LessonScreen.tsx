import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { artIdForLabel, prefersGeneratedArt, TermArt } from "../art";
import { speak } from "../audio";
import { Icon, Mascot } from "../chrome";
import type { Concept, Course } from "../domain";
import { fillPattern } from "../fill";
import { conceptOf, type PresentedExercise, type TeachMode, twinOf } from "../flow";
import type { Phase } from "../flow-machine";
import { ipaFor } from "../ipa";
import { zhTermFor } from "../localization";
import type { Lang, UiText } from "../ui";

function pick<T>(items: T[], seed: number): T {
  return items[Math.abs(seed) % items.length];
}

function hash(text: string): number {
  let value = 0;
  for (let i = 0; i < text.length; i += 1) value = (value * 31 + text.charCodeAt(i)) | 0;
  return value;
}

export interface LessonScreenProps {
  title: string;
  phase: Phase;
  t: UiText;
  lang: Lang;
  course: Course;
  teachMode: TeachMode;
  teachTerms: string[];
  teachIndex: number;
  presented: PresentedExercise | null;
  selection: string | boolean | null;
  lastCorrect: boolean;
  combo: number;
  answered: number;
  total: number;
  selL: string | null;
  selR: string | null;
  locked: string[];
  hintShown: boolean;
  onPick: (value: string | boolean) => void;
  onSubmit: () => void;
  onMatch: (side: "left" | "right", id: string) => void;
  onHint: () => void;
  onTeachContinue: () => void;
  onContinue: () => void;
  onClose: () => void;
}

/* 退出前的应用内确认。原生 window.confirm 与整屏手绘卡片风格割裂，也
   读不到主题；这里走 ShareSheet 同一条 <dialog> 焦点契约。 */
function QuitDialog({ t, onStay, onQuit }: { t: UiText; onStay: () => void; onQuit: () => void }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    // Move focus into the dialog while it is open and hand it back on close.
    const opener = document.activeElement as HTMLElement | null;
    dialogRef.current?.showModal();
    sheetRef.current?.focus();
    return () => opener?.focus();
  }, []);

  const cycleFocus = (event: KeyboardEvent<HTMLDialogElement>) => {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not([disabled]), a[href], input:not([disabled]), [tabindex="0"]',
      ),
    ).filter((element) => element.getClientRects().length > 0);
    const first = controls[0],
      last = controls.at(-1);
    if (!first || !last) return;
    if (event.shiftKey && (document.activeElement === first || document.activeElement === sheetRef.current)) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <dialog
      className="quit-backdrop"
      ref={dialogRef}
      onKeyDown={cycleFocus}
      aria-label={t.lesson.close}
      onCancel={(event) => {
        event.preventDefault();
        onStay();
      }}
    >
      <div className="quit-sheet" ref={sheetRef} tabIndex={-1}>
        <div className="sheet-grab" aria-hidden="true" />
        <p className="quit-text">{t.lesson.closeConfirm}</p>
        <button type="button" className="btn btn-sun btn-block" onClick={onStay}>
          {t.lesson.stay}
        </button>
        <button type="button" className="btn btn-white btn-block" onClick={onQuit}>
          {t.lesson.close}
        </button>
      </div>
    </dialog>
  );
}

export function LessonScreen(props: LessonScreenProps) {
  const { phase, presented, t } = props;
  const pct = props.total ? Math.min(100, (props.answered / props.total) * 100) : 0;
  const footRef = useRef<HTMLDivElement>(null);
  // Teach 卡没有可丢的进度，直接退；进了题目才需要确认。
  const [confirming, setConfirming] = useState(false);

  // Move focus to the primary control whenever the step changes, so keyboard
  // and screen-reader users land on what to do next. The step key is the
  // trigger; the effect body only reads the ref.
  const stepKey = `${phase}:${props.teachIndex}:${presented?.id ?? ""}`;
  // biome-ignore lint/correctness/useExhaustiveDependencies: stepKey is the intended trigger
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      footRef.current
        ?.querySelector<HTMLButtonElement>("button:not([disabled])")
        ?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [stepKey]);

  return (
    <main className="lesson" aria-label={props.title}>
      <div className="lesson-top">
        <button
          type="button"
          className="icon-btn"
          aria-label={t.lesson.close}
          onClick={() => {
            if (phase === "teach") props.onClose();
            else setConfirming(true);
          }}
        >
          <Icon name="close" />
        </button>
        <div
          className="lesson-bar"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={props.total}
          aria-valuenow={props.answered}
          aria-label={t.lesson.progressAria(props.answered, props.total)}
        >
          <i style={{ width: `${pct}%` }} />
        </div>
        <span className={`combo${props.combo >= 3 ? " on" : ""}`} key={props.combo} aria-live="polite">
          {props.combo >= 3 ? t.lesson.combo(props.combo) : ""}
        </span>
      </div>

      <div className="lesson-body">
        {phase === "teach" ? (
          props.teachMode === "recap" ? (
            <Recap terms={props.teachTerms} course={props.course} t={t} />
          ) : (
            <TwinCard
              key={props.teachTerms[props.teachIndex]}
              lead={props.teachTerms[props.teachIndex]}
              course={props.course}
              t={t}
              lang={props.lang}
            />
          )
        ) : (
          presented && (
            <Question
              presented={presented}
              course={props.course}
              t={t}
              selection={props.selection}
              locked={phase === "feedback"}
              lastCorrect={props.lastCorrect}
              selL={props.selL}
              selR={props.selR}
              lockedIds={props.locked}
              hintShown={props.hintShown}
              onPick={props.onPick}
              onMatch={props.onMatch}
            />
          )
        )}
      </div>

      <div className="lesson-foot" ref={footRef}>
        {phase === "teach" && (
          <button type="button" className="btn btn-sun btn-block" onClick={props.onTeachContinue}>
            {props.teachMode === "recap" ? t.lesson.letsGo : t.lesson.gotIt}
          </button>
        )}
        {phase === "question" && presented && presented.type !== "match" && (
          <div className="foot-row">
            {!props.hintShown && (
              <button type="button" className="btn btn-white" onClick={props.onHint}>
                <Icon name="bulb" size={20} />
                {t.lesson.hint}
              </button>
            )}
            <button
              type="button"
              className="btn btn-ink btn-grow"
              disabled={props.selection === null}
              onClick={props.onSubmit}
            >
              {t.lesson.check}
            </button>
          </div>
        )}
        {phase === "question" && presented?.type !== "match" && <p className="keys-hint">{t.lesson.keys}</p>}
      </div>

      {phase === "feedback" && presented && (
        <Feedback
          presented={presented}
          course={props.course}
          correct={props.lastCorrect}
          t={t}
          onContinue={props.onContinue}
        />
      )}
      {confirming && <QuitDialog t={t} onStay={() => setConfirming(false)} onQuit={props.onClose} />}
    </main>
  );
}

/* ───────────────────────── teach ───────────────────────── */

function SpeakButton({ concept, t }: { concept: Concept; t: UiText }) {
  return (
    <button
      type="button"
      className="speak"
      aria-label={t.lesson.speakAria(concept.term)}
      onClick={() => void speak(concept.term, { conceptId: concept.id })}
    >
      <Icon name="speaker" size={16} />
    </button>
  );
}

function Twin({
  concept,
  side,
  generated,
  t,
  lang,
}: {
  concept: Concept;
  side: "a" | "b";
  generated: boolean;
  t: UiText;
  lang: Lang;
}) {
  const ipa = ipaFor(concept.id);
  const zh = lang === "zh-CN" ? zhTermFor(concept) : undefined;
  return (
    <div className={`twin twin-${side}`}>
      <div className="twin-art">
        <TermArt id={concept.id} size="hero" preferGenerated={generated} />
      </div>
      <div className="twin-term">{concept.term}</div>
      <div className="twin-ipa">
        {zh && <span className="twin-zh">{zh}</span>}
        {ipa && <span>{ipa}</span>}
        <SpeakButton concept={concept} t={t} />
      </div>
      <p className="twin-cap">{concept.caption}</p>
    </div>
  );
}

function highlight(sentence: string, term: string) {
  const match = fillPattern(term).exec(sentence);
  if (!match) return sentence;
  return (
    <>
      {sentence.slice(0, match.index)}
      <mark>{match[0]}</mark>
      {sentence.slice(match.index + match[0].length)}
    </>
  );
}

/** Wrap the first whole-word occurrence of the term in <em>. */
function emphasize(text: string, term: string | undefined) {
  if (!term) return text;
  const at = text.toLowerCase().indexOf(term.toLowerCase());
  if (at < 0) return text;
  return (
    <>
      {text.slice(0, at)}
      <em>{text.slice(at, at + term.length)}</em>
      {text.slice(at + term.length)}
    </>
  );
}

function TwinCard({ lead, course, t, lang }: { lead: string; course: Course; t: UiText; lang: Lang }) {
  const generated = prefersGeneratedArt(course);
  const a = conceptOf(course, lead);
  const twinId = twinOf(course, lead);
  const b = twinId ? conceptOf(course, twinId) : undefined;
  useEffect(() => {
    if (a) void speak(a.term, { conceptId: a.id });
  }, [a]);
  if (!a) return null;
  const type = t.mixTypes[a.mixUpType ?? "coexist"];
  return (
    <section className="teach" aria-label={t.lesson.newPair}>
      <span className="teach-tag">
        <Icon name="star" size={16} fill />
        {t.lesson.newPair}
      </span>
      <div className={`twins${b ? "" : " single"}`}>
        <Twin concept={a} side="a" generated={generated} t={t} lang={lang} />
        {b && (
          <span className="vs" aria-hidden="true">
            vs
          </span>
        )}
        {b && <Twin concept={b} side="b" generated={generated} t={t} lang={lang} />}
      </div>
      <div className="trick">
        <span className="trick-icon" aria-hidden="true">
          <Icon name="bulb" size={22} />
        </span>
        <div>
          <b className={`type-label type-${a.mixUpType ?? "coexist"}`}>
            {type.name} · {t.lesson.trick}
          </b>
          <p>{a.mixUpWhy}</p>
        </div>
      </div>
      {a.example && (
        <button
          type="button"
          className="example"
          aria-label={`${t.lesson.speakExampleAria}: ${a.example}`}
          onClick={() => void speak(a.example)}
        >
          <span className="example-label">
            <Icon name="speaker" size={14} />
            {t.lesson.inContext}
          </span>
          <span>“{highlight(a.example, a.term)}”</span>
        </button>
      )}
    </section>
  );
}

function Recap({ terms, course, t }: { terms: string[]; course: Course; t: UiText }) {
  const generated = prefersGeneratedArt(course);
  return (
    <section className="recap">
      <Mascot mood="think" size={112} />
      <span className="teach-tag">
        <Icon name="trophy" size={16} />
        {t.lesson.recap}
      </span>
      <h2 className="display">{t.lesson.recapTitle}</h2>
      <ul className="recap-list">
        {terms.map((id) => {
          const a = conceptOf(course, id);
          const twinId = twinOf(course, id);
          const b = twinId ? conceptOf(course, twinId) : undefined;
          if (!a) return null;
          return (
            <li key={id}>
              <TermArt id={a.id} size="sm" preferGenerated={generated} />
              <span>
                {a.term}
                {b && (
                  <>
                    <i aria-hidden="true">/</i>
                    {b.term}
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ───────────────────────── questions ───────────────────────── */

interface QuestionProps {
  presented: PresentedExercise;
  course: Course;
  t: UiText;
  selection: string | boolean | null;
  locked: boolean;
  lastCorrect: boolean;
  selL: string | null;
  selR: string | null;
  lockedIds: string[];
  hintShown: boolean;
  onPick: (value: string | boolean) => void;
  onMatch: (side: "left" | "right", id: string) => void;
}

function optionState(text: string | boolean, props: QuestionProps, correct: string | boolean | undefined) {
  const classes: string[] = [];
  if (props.selection === text) classes.push("sel");
  if (props.locked) {
    if (text === correct) classes.push("good");
    else if (props.selection === text) classes.push("bad");
    else classes.push("dim");
  }
  return classes.join(" ");
}

function Blank({ value, state }: { value: string | null; state: string }) {
  return <span className={`blank${value ? " filled" : ""} ${state}`}>{value ?? "\u00a0"}</span>;
}

function withBlank(story: string, blank: React.ReactNode) {
  const parts = story.split("____");
  if (parts.length < 2) return story;
  return (
    <>
      {parts[0]}
      {blank}
      {parts.slice(1).join("____")}
    </>
  );
}

function Question(props: QuestionProps) {
  const { presented, t, course } = props;
  const generated = prefersGeneratedArt(course);
  const kind = t.lesson.kinds[presented.type];

  useEffect(() => {
    if (presented.type !== "listen" || props.locked) return;
    const timer = setTimeout(
      () => void speak(presented.correctText ?? "", { conceptId: presented.termId }),
      250,
    );
    return () => clearTimeout(timer);
  }, [presented, props.locked]);

  const termId = presented.termId ?? presented.termIds?.find((id) => conceptOf(course, id));
  const concept = termId ? conceptOf(course, termId) : undefined;
  const twin = concept ? conceptOf(course, concept.mixUp) : undefined;

  // Recall questions show words only. A picture on each answer option gives
  // the answer away (an up-arrow tile next to "rally"), so art appears where
  // the word itself is the subject — teach cards, true/false, matching — and
  // never on the options the learner is choosing between.
  const tiles = (options: NonNullable<PresentedExercise["options"]>, big: boolean, art = false) => (
    <div className={`opts${big ? " tiles" : ""}`}>
      {options.map((option, index) => (
        <button
          type="button"
          key={option.text}
          className={`opt ${optionState(option.text, props, presented.correctText)}`}
          disabled={props.locked}
          aria-pressed={props.selection === option.text}
          onClick={() => props.onPick(option.text)}
        >
          {art && option.art && (
            <TermArt
              id={option.art || artIdForLabel(option.text)}
              size={big ? "lg" : "sm"}
              preferGenerated={generated}
            />
          )}
          <span className="opt-text">{option.text}</span>
          <span className="opt-key" aria-hidden="true">
            {index + 1}
          </span>
        </button>
      ))}
    </div>
  );

  let body: React.ReactNode = null;
  switch (presented.type) {
    case "meaning":
      body = (
        <>
          <h2 className="q-stem">{emphasize(presented.stem ?? "", concept?.term)}</h2>
          {tiles(presented.options ?? [], false)}
        </>
      );
      break;
    case "scenario":
      body = (
        <>
          <div className="bubble">“{presented.story}”</div>
          <h2 className="q-stem small">{presented.stem}</h2>
          {tiles(presented.options ?? [], true)}
        </>
      );
      break;
    case "headline": {
      const picked = typeof props.selection === "string" ? props.selection : null;
      const state = props.locked && picked ? (picked === presented.correctText ? "good" : "bad") : "";
      body = (
        <>
          <div className="news">
            <span className="news-tag">NEWS</span>
            <p>{withBlank(presented.story ?? "", <Blank value={picked} state={state} />)}</p>
          </div>
          <h2 className="q-stem small">{t.lesson.headlineAsk}</h2>
          {tiles(presented.options ?? [], true)}
        </>
      );
      break;
    }
    case "listen":
      body = (
        <>
          <h2 className="q-stem center">{t.lesson.listenAsk}</h2>
          <button
            type="button"
            className="listen"
            aria-label={t.lesson.replayAria}
            onClick={() =>
              void speak(presented.correctText ?? "", { conceptId: presented.termId, rate: 0.75 })
            }
          >
            <Icon name="speaker" size={56} />
          </button>
          {tiles(presented.options ?? [], true, false)}
        </>
      );
      break;
    case "truefalse": {
      const statement = (presented.stem ?? "").replace(/^.+? means: /, "").replace(/^.+?[:：]\s*/, "");
      const isZhStyle = !/ means: /.test(presented.stem ?? "");
      body = (
        <>
          <div className="tf-head">
            {concept && <TermArt id={concept.id} size="lg" preferGenerated={generated} />}
            <div>
              <b className="tf-term">{concept?.term}</b>
              <span className="tf-means">{t.lesson.tf.means}</span>
            </div>
          </div>
          <div className="bubble arrow">“{isZhStyle ? presented.stem : statement}”</div>
          <div className="tf">
            {[true, false].map((value, index) => (
              <button
                type="button"
                key={String(value)}
                className={`opt tf-${value ? "yes" : "no"} ${optionState(value, props, presented.answer as boolean)}`}
                disabled={props.locked}
                aria-pressed={props.selection === value}
                onClick={() => props.onPick(value)}
              >
                <Icon name={value ? "check" : "cross"} size={30} />
                <span>{value ? t.lesson.tf.true : t.lesson.tf.false}</span>
                <span className="opt-key" aria-hidden="true">
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        </>
      );
      break;
    }
    case "fill": {
      const picked = typeof props.selection === "string" ? props.selection : null;
      const state = props.locked && picked ? (picked === presented.answer ? "good" : "bad") : "";
      body = (
        <>
          <h2 className="q-stem">{t.lesson.pickWord}</h2>
          <div className="bubble">
            {withBlank(presented.story ?? "", <Blank value={picked} state={state} />)}
          </div>
          <div className="bank">
            {presented.bank?.map((word, index) => (
              <button
                type="button"
                key={word}
                className={`chip-btn ${optionState(word, props, presented.answer as string)}`}
                disabled={props.locked}
                aria-pressed={props.selection === word}
                onClick={() => props.onPick(word)}
              >
                {word}
                <span className="opt-key" aria-hidden="true">
                  {index + 1}
                </span>
              </button>
            ))}
          </div>
        </>
      );
      break;
    }
    case "audit":
      body = (
        <>
          <blockquote className="claim">{presented.story}</blockquote>
          <h2 className="q-stem small">{presented.stem}</h2>
          {tiles(presented.options ?? [], false, false)}
        </>
      );
      break;
    case "match":
      body = (
        <>
          <h2 className="q-stem">{t.lesson.matchAsk}</h2>
          <div className="match">
            <div className="match-col">
              {presented.left.map((chip) => (
                <button
                  type="button"
                  key={chip.id}
                  className={`match-btn term${props.lockedIds.includes(chip.id) ? " done" : props.selL === chip.id ? " sel" : ""}`}
                  disabled={props.locked || props.lockedIds.includes(chip.id)}
                  aria-pressed={props.selL === chip.id}
                  onClick={() => {
                    if (conceptOf(course, chip.id)) void speak(chip.text, { conceptId: chip.id });
                    props.onMatch("left", chip.id);
                  }}
                >
                  <TermArt id={chip.id} size="xs" preferGenerated={generated} />
                  {chip.text}
                </button>
              ))}
            </div>
            <div className="match-col">
              {presented.right.map((chip) => (
                <button
                  type="button"
                  key={chip.id}
                  className={`match-btn${props.lockedIds.includes(chip.id) ? " done" : props.selR === chip.id ? " sel" : ""}`}
                  disabled={props.locked || props.lockedIds.includes(chip.id)}
                  aria-pressed={props.selR === chip.id}
                  onClick={() => props.onMatch("right", chip.id)}
                >
                  {chip.text}
                </button>
              ))}
            </div>
          </div>
        </>
      );
      break;
  }

  return (
    <section className={`question q-${presented.type}`}>
      <span className={`q-kind kind-${presented.type}`}>
        <i aria-hidden="true" />
        {kind}
      </span>
      {body}
      {props.hintShown && !props.locked && concept && twin && (
        <div className="hint" role="note">
          <Mascot mood="think" size={48} />
          <div>
            <p>{t.lesson.hintBody(concept.term, twin.term)}</p>
            <small>{t.lesson.hintCost}</small>
          </div>
        </div>
      )}
    </section>
  );
}

/* ───────────────────────── feedback ───────────────────────── */

function Feedback({
  presented,
  course,
  correct,
  t,
  onContinue,
}: {
  presented: PresentedExercise;
  course: Course;
  correct: boolean;
  t: UiText;
  onContinue: () => void;
}) {
  const audit = presented.type === "audit";
  const title = correct
    ? pick(audit ? t.feedback.auditNice : t.feedback.nice, hash(presented.id))
    : audit
      ? t.feedback.auditNope
      : t.feedback.nope;
  const answer =
    presented.type === "truefalse"
      ? presented.answer
        ? t.lesson.tf.true
        : t.lesson.tf.false
      : presented.type === "fill"
        ? String(presented.answer)
        : presented.correctText;
  // A true/false item's own "why" restates the definition; the twin contrast
  // is the thing worth reading after a miss.
  const concept = presented.termId ? conceptOf(course, presented.termId) : undefined;
  const why =
    presented.type === "match" ? (correct ? "" : presented.why) : presented.why || concept?.mixUpWhy;
  return (
    <div className={`feedback ${correct ? "ok" : "no"}`} role="status" aria-live="assertive">
      <div className="feedback-row">
        <Mascot mood={correct ? "cheer" : "oops"} size={72} />
        <div>
          <h3>{title}</h3>
          {!correct && answer && presented.type !== "match" && (
            <p className="feedback-answer">
              {t.feedback.answer} <b>{answer}</b>
            </p>
          )}
          {why && <p>{why}</p>}
        </div>
      </div>
      <button
        type="button"
        className={`btn btn-block ${correct ? "btn-mint" : "btn-tomato"}`}
        onClick={onContinue}
      >
        {correct ? t.feedback.continue : t.feedback.again}
      </button>
    </div>
  );
}
