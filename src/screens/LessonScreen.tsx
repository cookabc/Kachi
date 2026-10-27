import { artIdForLabel, TermArt } from "../art";
import { HeartRow } from "../chrome";
import type { Course } from "../domain";
import { conceptOf, type PresentedExercise, type TeachMode } from "../flow";
import { localizedTerm } from "../localization";
import type { Lang, UiText } from "../ui";

export type Phase = "teach" | "question" | "feedback" | "complete" | "fail";

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function LessonScreen(props: {
  lessonTitle: string;
  phase: Phase;
  t: UiText;
  lang: Lang;
  course: Course;
  teachMode: TeachMode;
  teachTerms: string[];
  teachIndex: number;
  presented: PresentedExercise | null;
  selection: string | boolean | null;
  hearts: number;
  lastCorrect: boolean;
  total: number;
  questionIndex: number;
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
}) {
  const { phase, presented, t } = props;
  if (phase === "teach") {
    const recap = props.teachMode === "recap";
    const termId = props.teachTerms[props.teachIndex];
    const last = recap || props.teachIndex >= props.teachTerms.length - 1;
    return (
      <main className="lesson">
        <div className="l-top">
          <button type="button" className="xbtn" aria-label={t.lesson.close} onClick={props.onClose}>
            ×
          </button>
          <div className="learn-tag">{t.lesson.learnTag}</div>
          {!recap && (
            <div className="pips dim">
              {props.teachTerms.map((term, index) => (
                <div
                  key={term}
                  className={`pip${index < props.teachIndex ? " on" : index === props.teachIndex ? " now" : ""}`}
                />
              ))}
            </div>
          )}
        </div>
        <div className="prompt teach">
          {recap ? (
            <RecapCard terms={props.teachTerms} course={props.course} t={t} />
          ) : (
            termId && <TeachCard termId={termId} course={props.course} t={t} lang={props.lang} />
          )}
        </div>
        <div className="foot">
          <button type="button" className="btn btn-gold" onClick={props.onTeachContinue}>
            {recap ? t.lesson.recapGo : last ? t.lesson.teachStart : t.lesson.teachContinue}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="lesson">
      <div className="l-top">
        <button type="button" className="xbtn" aria-label={t.lesson.close} onClick={props.onClose}>
          ×
        </button>
        <div className="pips">
          {/* positional progress pips: index is the meaning, order is fixed */}
          {Array.from({ length: props.total }, (_, index) => (
            <div
              key={index}
              className={`pip${index < props.questionIndex ? " on" : index === props.questionIndex ? " now" : ""}`}
            />
          ))}
        </div>
        <HeartRow n={props.hearts} popped={phase === "feedback" && !props.lastCorrect} t={t} />
      </div>
      <div className="prompt">
        {presented && (
          <PromptBody
            presented={presented}
            t={t}
            selection={props.selection}
            locked={phase === "feedback"}
            selL={props.selL}
            selR={props.selR}
            lockedIds={props.locked}
            onPick={props.onPick}
            onMatch={props.onMatch}
          />
        )}
        {/* The hint names the confusable partner, never the answer. It is the
            honest way to unstick someone without turning the drill into a
            multiple-guess loop — and it costs mastery credit, which is why the
            cost is stated up front rather than discovered afterwards. */}
        {phase === "question" && props.hintShown && presented && (
          <HintCard presented={presented} course={props.course} t={t} />
        )}
      </div>
      {phase === "question" && presented?.type !== "match" && (
        <div className="foot">
          {!props.hintShown && (
            <button type="button" className="btn btn-ghost" onClick={props.onHint}>
              {t.lesson.hint}
            </button>
          )}
          <button
            type="button"
            className="btn btn-gold"
            disabled={props.selection === null}
            onClick={props.onSubmit}
          >
            {t.lesson.check}
          </button>
        </div>
      )}
      {phase === "feedback" && presented && (
        <div className={`sheet ${props.lastCorrect ? "ok" : "no"}`} role="status">
          <h3>{pick(props.lastCorrect ? t.verdicts.nice : t.verdicts.nope)}</h3>
          <p>{presented.why}</p>
          <button
            type="button"
            className={`btn ${props.lastCorrect ? "btn-green" : "btn-red"}`}
            onClick={props.onContinue}
          >
            {t.lesson.continue}
          </button>
        </div>
      )}
    </main>
  );
}

function TeachCard({ termId, course, t, lang }: { termId: string; course: Course; t: UiText; lang: Lang }) {
  const concept = conceptOf(course, termId);
  if (!concept) return null;
  const sibling = conceptOf(course, concept.mixUp);
  // Generated packs carry the Chinese name natively; the legacy pack falls
  // back to its gloss map. The en UI never shows it.
  const termZh = lang === "zh-CN" ? (concept.termZh ?? localizedTerm(termId).termZh) : null;
  const mixLabel = concept.mixUpType ? t.lesson.mixTypes[concept.mixUpType] : null;
  return (
    <>
      <div className="kicker2">{t.lesson.teachKicker(termZh)}</div>
      <div className="teach-art">
        <TermArt id={concept.id} size="hero" />
      </div>
      {concept.caption && <p className="teach-cap">{concept.caption}</p>}
      <div className="teach-term">{concept.term}</div>
      <p className="teach-def">{concept.definition}</p>
      <div className="teach-ex">{concept.example}</div>
      <div className="teach-mix">
        <TermArt id={sibling ? sibling.id : concept.mixUp} size="xs" />
        <div>
          <strong>
            {lang === "zh-CN" ? "别混淆" : "Don't mix up"}
            {mixLabel ? ` · ${mixLabel}` : ""}
          </strong>
          {lang === "zh-CN" ? "：" : ": "}
          {sibling ? sibling.term : concept.mixUp}
          {lang === "zh-CN" ? "。" : ". "}
          {concept.mixUpWhy}
        </div>
      </div>
    </>
  );
}

function RecapCard({ terms, course, t }: { terms: string[]; course: Course; t: UiText }) {
  return (
    <>
      <div className="kicker2">{t.lesson.recapKicker}</div>
      <div className="stem" style={{ textAlign: "center", marginBottom: 12 }}>
        {t.lesson.recapTitle}
      </div>
      <div className="recap-strip">
        {terms.map((id) => {
          const concept = conceptOf(course, id);
          if (!concept) return null;
          return (
            <div className="recap-item" key={id}>
              <TermArt id={id} size="sm" />
              <span>{concept.term}</span>
            </div>
          );
        })}
      </div>
      <p className="teach-def" style={{ marginTop: 16 }}>
        {t.lesson.recapSub}
      </p>
    </>
  );
}

function HintCard({ presented, course, t }: { presented: PresentedExercise; course: Course; t: UiText }) {
  // Which concept this prompt is testing: the explicit termId, or the first
  // published term reference. A match prompt has neither, so it falls back to
  // the pair list rather than inventing a term.
  const conceptId = presented.termId ?? presented.termIds?.find((id) => conceptOf(course, id));
  const concept = conceptId ? conceptOf(course, conceptId) : undefined;
  const mixUpTerm = concept ? (conceptOf(course, concept.mixUp)?.term ?? concept.mixUp) : undefined;
  return (
    <div className="hint-card" role="note">
      {concept && mixUpTerm ? <p>{t.lesson.hintBody(concept.term, mixUpTerm)}</p> : <p>{t.lesson.hint}</p>}
      <span className="hint-cost">{t.lesson.hintCost}</span>
    </div>
  );
}

function PromptBody(props: {
  presented: PresentedExercise;
  t: UiText;
  selection: string | boolean | null;
  locked: boolean;
  selL: string | null;
  selR: string | null;
  lockedIds: string[];
  onPick: (value: string | boolean) => void;
  onMatch: (side: "left" | "right", id: string) => void;
}) {
  const { presented, selection, locked, t } = props;
  return (
    <>
      <div className="kicker2">{t.lesson.kickers[presented.type]}</div>
      {presented.type === "scenario" && presented.story && <div className="story">{presented.story}</div>}
      {presented.type === "fill" && presented.story ? (
        <FillStory presented={presented} selection={selection} />
      ) : (
        presented.stem && <div className="stem">{presented.stem}</div>
      )}

      {(presented.type === "meaning" || presented.type === "scenario") && (
        <div className="opts">
          {presented.options?.map((option) => {
            let cls = "opt tile";
            if (option.text.length > 42) cls += " longcap";
            if (selection === option.text) cls += " sel";
            if (locked) {
              if (option.text === presented.correctText) cls += " good";
              else if (selection === option.text) cls += " bad";
            }
            return (
              <button
                type="button"
                key={option.text}
                className={cls}
                disabled={locked}
                onClick={() => props.onPick(option.text)}
              >
                <TermArt id={option.art || artIdForLabel(option.text)} size="lg" />
                <span className="cap">{option.text}</span>
              </button>
            );
          })}
        </div>
      )}

      {presented.type === "truefalse" && (
        <div className="tf">
          {[true, false].map((value) => {
            let cls = "opt tile";
            if (selection === value) cls += " sel";
            if (locked) {
              if (value === presented.answer) cls += " good";
              else if (selection === value) cls += " bad";
            }
            return (
              <button
                type="button"
                key={String(value)}
                className={cls}
                disabled={locked}
                onClick={() => props.onPick(value)}
              >
                <TermArt id={value ? "true" : "false"} size="lg" />
                <span className="cap">{value ? t.lesson.tfLabels.true : t.lesson.tfLabels.false}</span>
              </button>
            );
          })}
        </div>
      )}

      {presented.type === "headline" && (
        <HeadlineBody presented={presented} selection={selection} locked={locked} onPick={props.onPick} />
      )}

      {presented.type === "fill" && (
        <div className="bank">
          {presented.bank?.map((word) => {
            let cls = "bank-chip";
            if (selection === word) cls += " sel";
            if (locked) {
              if (word === presented.answer) cls += " good";
              else if (selection === word) cls += " bad";
            }
            return (
              <button
                type="button"
                key={word}
                className={cls}
                disabled={locked}
                onClick={() => props.onPick(word)}
              >
                <TermArt id={artIdForLabel(word)} size="sm" />
                <span>{word}</span>
              </button>
            );
          })}
        </div>
      )}

      {presented.type === "match" && (
        <>
          <div className="stem">{t.lesson.matchHint}</div>
          <div className="match">
            <div>
              {presented.left.map((chip) => (
                <MatchChip
                  key={chip.id}
                  chip={chip}
                  side="left"
                  lockedIds={props.lockedIds}
                  selected={props.selL === chip.id}
                  disabled={locked}
                  onMatch={props.onMatch}
                />
              ))}
            </div>
            <div>
              {presented.right.map((chip) => (
                <MatchChip
                  key={chip.id}
                  chip={chip}
                  side="right"
                  lockedIds={props.lockedIds}
                  selected={props.selR === chip.id}
                  disabled={locked}
                  onMatch={props.onMatch}
                />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

/**
 * The headline drill: one real-syntax sentence with a blank, and the two terms
 * of the pair as the only options.
 *
 * Selecting a word drops it into the sentence in place, so the learner reads
 * the whole line rather than judging a word in isolation — which is exactly the
 * skill the product claims to teach. After checking, the sentence keeps the
 * chosen word and colours it, so a wrong choice leaves a visibly wrong headline
 * on screen instead of a bare "incorrect".
 */
function HeadlineBody({
  presented,
  selection,
  locked,
  onPick,
}: {
  presented: PresentedExercise;
  selection: string | boolean | null;
  locked: boolean;
  onPick: (value: string | boolean) => void;
}) {
  const picked = typeof selection === "string" ? selection : null;
  const parts = (presented.story ?? "").split("____");
  const correctText = presented.correctText;
  return (
    <>
      <div className="headline">
        {parts.length > 1 ? (
          <>
            {parts[0]}
            <span
              className={`hl-blank${picked ? " filled" : ""}${locked && picked ? (picked === correctText ? " good" : " bad") : ""}`}
            >
              {picked ?? "\u00a0\u00a0\u00a0\u00a0\u00a0\u00a0"}
            </span>
            {parts.slice(1).join("____")}
          </>
        ) : (
          presented.story
        )}
      </div>
      <div className="hl-opts">
        {presented.options?.map((option) => {
          let cls = "hl-opt";
          if (picked === option.text) cls += " sel";
          if (locked) {
            if (option.text === correctText) cls += " good";
            else if (picked === option.text) cls += " bad";
          }
          return (
            <button
              type="button"
              key={option.text}
              className={cls}
              disabled={locked}
              onClick={() => onPick(option.text)}
            >
              {option.text}
            </button>
          );
        })}
      </div>
    </>
  );
}

function FillStory({
  presented,
  selection,
}: {
  presented: PresentedExercise;
  selection: string | boolean | null;
}) {
  const filled = typeof selection === "string" ? selection : "";
  const story = presented.story ?? "";
  const blank = <span className="blank">{filled || " "}</span>;
  const parts = story.split("____");
  return (
    <div className="story">
      {parts.length > 1 ? (
        <>
          {parts[0]}
          {blank}
          {parts.slice(1).join("____")}
        </>
      ) : (
        <>
          {story} {blank}
        </>
      )}
    </div>
  );
}

function MatchChip(props: {
  chip: { id: string; text: string };
  side: "left" | "right";
  lockedIds: string[];
  selected: boolean;
  disabled: boolean;
  onMatch: (side: "left" | "right", id: string) => void;
}) {
  const isLocked = props.lockedIds.includes(props.chip.id);
  const cls = `mchip${isLocked ? " good" : props.selected ? " sel" : ""}`;
  return (
    <button
      type="button"
      className={cls}
      disabled={props.disabled || isLocked}
      onClick={() => props.onMatch(props.side, props.chip.id)}
    >
      {props.side === "left" && <TermArt id={props.chip.id} size="xs" />}
      {props.chip.text}
    </button>
  );
}
