import { type ChangeEvent, type CSSProperties, useEffect, useMemo, useState } from "react";
import { artIdForLabel, Hedgehog, NAV_ICONS, TermArt } from "./art";
import { courseFor } from "./course";
import type { Concept, Course, Exercise, LearnerState, SessionState } from "./domain";
import {
  applyAnswer,
  currentExercise,
  emptyLearnerState,
  isLessonUnlocked,
  recentMissTermIds,
  requeuePrompt,
  startPracticeSession,
  startSession,
} from "./engine";
import {
  conceptOf,
  PRACTICE_ROUND,
  type PresentedExercise,
  practicePool,
  present,
  realTermIds as publishedTermIds,
  resolveMatch,
  type Summary,
  sessionSummary,
  type TeachMode,
  teachPlan,
} from "./flow";
import { localizedTerm } from "./localization";
import { activateUpdate } from "./pwa";
import { exportLearnerData, importLearnerData, loadLearnerState, saveLearnerState } from "./storage";
import { type Lang, loadLang, saveLang, UI, type UiText } from "./ui";

type Tab = "learn" | "practice" | "glossary" | "settings";
type Phase = "teach" | "question" | "feedback" | "complete" | "fail";

const MAX_HEARTS = 5;
const SNAKE = [0, 56, 8, -56];

const deviceId = crypto.randomUUID();
let eventCounter = 0;
const environment = {
  now: () => new Date(),
  random: () => Math.random(),
  deviceId,
  eventId: () => `${deviceId}-${Date.now()}-${++eventCounter}`,
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const realTermIds = (prompt: Exercise, course: Course) => publishedTermIds(prompt, course);

function StatsBar({ state }: { state: LearnerState }) {
  return (
    <div className="stats" role="img" aria-label={`XP ${state.xp} · ${state.streak}`}>
      <div className="stat xp">
        <span className="ic">◆</span>
        {state.xp}
      </div>
      <div className="stat streak">
        <span className="ic">🔥</span>
        {state.streak}
      </div>
    </div>
  );
}

function HeartRow({ n, popped, t }: { n: number; popped: boolean; t: UiText }) {
  return (
    <div className="hearts" role="img" aria-label={t.lesson.heartsAria(n, MAX_HEARTS)}>
      {/* fixed-length indicator: the hearts never reorder, so the index is the identity */}
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <span key={i} className={`ht ${i < n ? "full" : popped && i === n ? "empty pop" : "empty"}`}>
          ♥
        </span>
      ))}
    </div>
  );
}

function Nav({ tab, onTab, t }: { tab: Tab; onTab: (tab: Tab) => void; t: UiText }) {
  const items: Array<{ id: Tab; text: UiText["nav"]["learn"] }> = [
    { id: "learn", text: t.nav.learn },
    { id: "practice", text: t.nav.practice },
    { id: "glossary", text: t.nav.glossary },
    { id: "settings", text: t.nav.settings },
  ];
  return (
    <nav className="nav" aria-label={t.navAria}>
      {items.map((item) => (
        <button
          type="button"
          key={item.id}
          className={tab === item.id ? "on" : ""}
          aria-label={item.text.aria}
          onClick={() => onTab(item.id)}
        >
          {/* biome-ignore lint/security/noDangerouslySetInnerHtml: static, code-owned SVG icon markup from art.tsx */}
          <span dangerouslySetInnerHTML={{ __html: NAV_ICONS[item.id] }} />
          {item.text.label}
        </button>
      ))}
    </nav>
  );
}

function Confetti() {
  const [bits, setBits] = useState<CSSProperties[]>([]);
  useEffect(() => {
    const colors = ["#58CC02", "#FFC800", "#1CB0F6", "#FF4B4B", "#89E219", "#7DD3FC"];
    setBits(
      Array.from(
        { length: 40 },
        (_, i) =>
          ({
            background: colors[i % colors.length],
            width: `${8 + Math.random() * 10}px`,
            height: `${10 + Math.random() * 14}px`,
            left: `${36 + Math.random() * 28}%`,
            top: "26%",
            "--x": `${Math.random() * 260 - 130}px`,
            "--r": `${Math.random() * 420}deg`,
          }) as CSSProperties,
      ),
    );
    const timer = setTimeout(() => setBits([]), 1200);
    return () => clearTimeout(timer);
  }, []);
  return (
    <div className="confetti-layer">
      {/* one-shot random burst: the bits have no stable identity beyond position */}
      {bits.map((style, i) => (
        <i key={i} className="bit" style={style} />
      ))}
    </div>
  );
}

function App() {
  const [state, setState] = useState<LearnerState>(emptyLearnerState());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("learn");
  const [lang, setLangState] = useState<Lang>(() => loadLang());
  const [session, setSession] = useState<SessionState | null>(null);
  const [phase, setPhase] = useState<Phase>("teach");
  const [presented, setPresented] = useState<PresentedExercise | null>(null);
  const [selection, setSelection] = useState<string | boolean | null>(null);
  const [hearts, setHearts] = useState(MAX_HEARTS);
  const [lastCorrect, setLastCorrect] = useState(false);
  const [teachMode, setTeachMode] = useState<TeachMode>("first");
  const [teachTerms, setTeachTerms] = useState<string[]>([]);
  const [teachIndex, setTeachIndex] = useState(0);
  const [selL, setSelL] = useState<string | null>(null);
  const [selR, setSelR] = useState<string | null>(null);
  const [locked, setLocked] = useState<string[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [updateReady, setUpdateReady] = useState(false);

  const course = useMemo(() => courseFor(lang), [lang]);
  const t = UI[lang];

  // The document shell belongs to the UI language: screen readers pronounce it
  // and search engines index it — React state alone never reaches them.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.doc.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.doc.description);
  }, [lang, t]);

  useEffect(() => {
    loadLearnerState().then((loaded) => {
      setState(loaded);
      setReady(true);
    });
    const listener = () => setUpdateReady(true);
    window.addEventListener("kachi-update-ready", listener);
    return () => window.removeEventListener("kachi-update-ready", listener);
  }, []);

  const missedCount = useMemo(() => recentMissTermIds(state).length, [state]);

  const persist = (next: LearnerState) => {
    setState(next);
    void saveLearnerState(next);
  };

  const setLang = (next: Lang) => {
    setLangState(next);
    saveLang(next);
  };

  const markSeen = (ids: string[]) => {
    if (!ids.length) return;
    setState((prev) => {
      const next = { ...prev, seenConceptIds: Array.from(new Set([...prev.seenConceptIds, ...ids])) };
      void saveLearnerState(next);
      return next;
    });
  };

  const beginQuiz = (fresh: SessionState) => {
    setSession(fresh);
    setPhase("question");
    setSelection(null);
    setLocked([]);
    setSelL(null);
    setSelR(null);
    const first = currentExercise(course, fresh);
    if (first) {
      setPresented(present(first));
      markSeen(realTermIds(first, course));
    }
  };

  const beginLesson = (lessonId: string) => {
    const lesson = course.lessons.find((item) => item.id === lessonId);
    if (!lesson || !isLessonUnlocked(state, course, lessonId)) return;
    const fresh = startSession(course, lessonId, environment);
    const plan = teachPlan(lesson, course);
    setTeachMode(plan.mode);
    setTeachTerms(plan.terms);
    setTeachIndex(0);
    setHearts(MAX_HEARTS);
    setLastCorrect(false);
    setSelection(null);
    setLocked([]);
    setSelL(null);
    setSelR(null);
    setSummary(null);
    if (plan.terms.length) {
      setSession(fresh);
      setPhase("teach");
      setPresented(null);
      markSeen(plan.mode === "recap" ? plan.terms : [plan.terms[0]]);
    } else {
      beginQuiz(fresh);
    }
  };

  const beginPractice = (focusIds?: string[]) => {
    const picked = practicePool(state, course, focusIds);
    if (!picked.length) return;

    const fresh = startPracticeSession(picked, environment);
    setHearts(MAX_HEARTS);
    setLastCorrect(false);
    setSummary(null);
    beginQuiz(fresh);
  };

  const submit = (value: string | boolean, confusionPair?: [string, string]) => {
    if (!session || phase !== "question") return;
    const result = applyAnswer(course, state, session, value, environment, {
      heartsAfter: hearts - 1,
      confusionPair,
    });
    if (!result.attempt.correct) setHearts((current) => current - 1);
    persist(result.state);
    setSession(result.session);
    setLastCorrect(result.attempt.correct);
    setPhase("feedback");
  };

  const finish = (working: SessionState) => {
    setSummary(sessionSummary(working));
    setPhase("complete");
  };

  const continueAfterFeedback = () => {
    if (!session || !presented || phase !== "feedback") return;
    if (!lastCorrect && hearts <= 0) {
      setPhase("fail");
      return;
    }
    let working = session;
    // a failed match re-queues itself so the player can still finish the pairs they know
    if (presented.type === "match" && !lastCorrect) working = requeuePrompt(session, presented.id);
    if (working.index >= working.promptIds.length) {
      finish(working);
      return;
    }
    setSession(working);
    setPhase("question");
    setSelection(null);
    setLocked([]);
    setSelL(null);
    setSelR(null);
    const next = currentExercise(course, working);
    if (next) {
      setPresented(present(next));
      markSeen(realTermIds(next, course));
    }
  };

  const clearSession = () => {
    setSession(null);
    setPresented(null);
    setSummary(null);
    setPhase("teach");
  };

  const closeLesson = () => {
    clearSession();
    setTab("learn");
  };

  const onTeachContinue = () => {
    if (phase !== "teach") return;
    const last = teachMode === "recap" || teachIndex >= teachTerms.length - 1;
    if (last) {
      if (session) beginQuiz(session);
      return;
    }
    const nextIndex = teachIndex + 1;
    setTeachIndex(nextIndex);
    markSeen([teachTerms[nextIndex]]);
  };

  const onMatch = (side: "left" | "right", id: string) => {
    if (phase !== "question" || !presented?.pairs || locked.includes(id)) return;
    if (side === "left") {
      setSelL(id);
      if (selR) resolvePair(id, selR);
    } else {
      setSelR(id);
      if (selL) resolvePair(selL, id);
    }
  };

  const resolvePair = (leftId: string, rightId: string) => {
    if (!presented?.pairs) return;
    const outcome = resolveMatch(locked, presented.pairs, leftId, rightId);
    setLocked(outcome.locked);
    setSelL(null);
    setSelR(null);
    if (outcome.judged === "matched") submit("matched");
    // A mispair judges the whole prompt wrong; the two selected chips are the
    // actual confusion pair and must reach the engine as evidence.
    else if (outcome.judged === false) submit(false, [leftId, rightId]);
  };

  // keyboard: Enter drives the lesson; 1-4 pick options; Enter presses the hero CTA on complete/fail
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        if (session && (phase === "teach" || phase === "question" || phase === "feedback")) {
          event.preventDefault();
          if (phase === "teach") onTeachContinue();
          else if (phase === "question") {
            if (presented?.type !== "match" && selection !== null) submit(selection);
          } else continueAfterFeedback();
        } else if (phase === "complete" || phase === "fail") {
          const button = document.querySelector<HTMLElement>(".hero .btn");
          button?.click();
        }
        return;
      }
      if (!session || phase !== "question" || !presented) return;
      if (event.key >= "1" && event.key <= "4") {
        const index = Number(event.key) - 1;
        if (presented.type === "truefalse") {
          if (index === 0) setSelection(true);
          if (index === 1) setSelection(false);
        } else if (presented.type === "fill") {
          const word = presented.bank?.[index];
          if (word !== undefined) setSelection(word);
        } else if (presented.options?.[index]) {
          setSelection(presented.options[index].text);
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });

  const downloadExport = async () => {
    const blob = await exportLearnerData();
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `kachi-learning-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(href);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      persist(await importLearnerData(file));
      alert(t.settings.imported);
    } catch (error) {
      alert(error instanceof Error ? error.message : t.settings.importFailed);
    } finally {
      event.target.value = "";
    }
  };

  if (!ready) return <main className="loading">{t.loading}</main>;

  if (session && phase === "complete" && summary) {
    return (
      <CompleteScreen
        summary={summary}
        isPractice={session.mode === "practice"}
        lessonId={session.lessonId}
        course={course}
        t={t}
        onStart={beginLesson}
        onPractice={beginPractice}
        onPath={closeLesson}
      />
    );
  }
  if (session && phase === "fail") {
    return (
      <FailScreen
        isPractice={session.mode === "practice"}
        lessonId={session.lessonId}
        t={t}
        onRetryLesson={beginLesson}
        onRetryPractice={() => beginPractice()}
        onPath={closeLesson}
      />
    );
  }
  if (session && (phase === "teach" || phase === "question" || phase === "feedback")) {
    const activeLesson = course.lessons.find((item) => item.id === session.lessonId);
    return (
      <LessonScreen
        lessonTitle={session.mode === "practice" ? t.lesson.practiceTitle : (activeLesson?.title ?? "")}
        phase={phase}
        t={t}
        lang={lang}
        course={course}
        teachMode={teachMode}
        teachTerms={teachTerms}
        teachIndex={teachIndex}
        presented={presented}
        selection={selection}
        hearts={hearts}
        lastCorrect={lastCorrect}
        total={session.promptIds.length}
        questionIndex={phase === "feedback" ? Math.max(session.index - 1, 0) : session.index}
        selL={selL}
        selR={selR}
        locked={locked}
        onPick={setSelection}
        onSubmit={() => selection !== null && submit(selection)}
        onMatch={onMatch}
        onTeachContinue={onTeachContinue}
        onContinue={continueAfterFeedback}
        onClose={closeLesson}
      />
    );
  }

  return (
    <main className="shell">
      {updateReady && (
        <button type="button" className="update" onClick={activateUpdate}>
          {t.updateBanner}
        </button>
      )}

      {tab === "learn" && (
        <LearnHome state={state} course={course} t={t} missedCount={missedCount} onStart={beginLesson} />
      )}
      {tab === "practice" && <PracticeHome t={t} missedCount={missedCount} onStart={() => beginPractice()} />}
      {tab === "glossary" && (
        <Glossary
          state={state}
          course={course}
          t={t}
          lang={lang}
          query={glossaryQuery}
          onQuery={setGlossaryQuery}
        />
      )}
      {tab === "settings" && (
        <Settings t={t} lang={lang} onLang={setLang} onExport={downloadExport} onImport={onImport} />
      )}

      <Nav tab={tab} onTab={setTab} t={t} />
    </main>
  );
}

function LearnHome({
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
  onStart: (id: string) => void;
}) {
  const upNext = course.lessons.find(
    (lesson) => !state.completedLessonIds.includes(lesson.id) && isLessonUnlocked(state, course, lesson.id),
  );
  return (
    <>
      <header className="top">
        <div className="brand">Kachi</div>
        <StatsBar state={state} />
      </header>
      <p className="tagline">{t.home.tagline}</p>
      <div className="scroll">
        {course.units.map((unit) => (
          <section key={unit.id}>
            <div className={`unit-banner u${unit.id}`}>
              <div className="kicker">{t.home.unit(unit.id)}</div>
              <h2>{unit.title}</h2>
              <p>{unit.blurb}</p>
            </div>
            <div className="path">
              {course.lessons
                .filter((lesson) => lesson.unit === unit.id)
                .map((lesson, index) => {
                  const done = state.completedLessonIds.includes(lesson.id);
                  const unlocked = isLessonUnlocked(state, course, lesson.id);
                  const isNext = upNext?.id === lesson.id;
                  const cls =
                    "node" +
                    (lesson.review ? " review" : "") +
                    (done ? " done" : isNext ? " next" : unlocked ? "" : " locked");
                  return (
                    <div
                      className="node-wrap"
                      key={lesson.id}
                      style={{ transform: `translateX(${SNAKE[index % SNAKE.length]}px)` }}
                    >
                      <button
                        type="button"
                        className={cls}
                        aria-label={unlocked ? lesson.title : t.home.lockedLesson(lesson.title)}
                        disabled={!unlocked}
                        onClick={() => onStart(lesson.id)}
                      >
                        {!unlocked ? (
                          <span className="lock">🔒</span>
                        ) : done ? (
                          "✓"
                        ) : lesson.review ? (
                          "★"
                        ) : (
                          lesson.icon || index + 1
                        )}
                      </button>
                      <div className="node-label">
                        {isNext ? t.home.upNext : ""}
                        {lesson.title}
                      </div>
                    </div>
                  );
                })}
            </div>
          </section>
        ))}
        {missedCount > 0 && <p className="unit-note">{t.home.missedNote(missedCount)}</p>}
        <p className="unit-note">{t.home.unitNote}</p>
      </div>
    </>
  );
}

function PracticeHome({ t, missedCount, onStart }: { t: UiText; missedCount: number; onStart: () => void }) {
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
      </div>
    </>
  );
}

function Glossary({
  state,
  course,
  t,
  lang,
  query,
  onQuery,
}: {
  state: LearnerState;
  course: Course;
  t: UiText;
  lang: Lang;
  query: string;
  onQuery: (value: string) => void;
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

function Settings({
  t,
  lang,
  onLang,
  onExport,
  onImport,
}: {
  t: UiText;
  lang: Lang;
  onLang: (lang: Lang) => void;
  onExport: () => void;
  onImport: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <header className="top">
        <div className="brand">{t.settings.brand}</div>
      </header>
      <div className="prac-hero">
        <h1>{t.settings.title}</h1>
        <p className="sub">{t.settings.copy}</p>
        <fieldset className="lang-switch" aria-label={t.settings.langLabel}>
          {(Object.entries(t.settings.langNames) as Array<[Lang, string]>).map(([value, name]) => (
            <button
              type="button"
              key={value}
              className={lang === value ? "on" : ""}
              aria-pressed={lang === value}
              onClick={() => onLang(value)}
            >
              {name}
            </button>
          ))}
        </fieldset>
        <button type="button" className="btn btn-green" onClick={onExport}>
          {t.settings.exportBtn}
        </button>
        <label className="file-button">
          {t.settings.importBtn}
          <input type="file" accept="application/json" onChange={onImport} />
        </label>
        <p className="fine">{t.settings.contentNote}</p>
      </div>
    </>
  );
}

function LessonScreen(props: {
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
  onPick: (value: string | boolean) => void;
  onSubmit: () => void;
  onMatch: (side: "left" | "right", id: string) => void;
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
      </div>
      {phase === "question" && presented?.type !== "match" && (
        <div className="foot">
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
  const termZh = lang === "zh-CN" ? localizedTerm(termId).termZh : null;
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
          <strong>{lang === "zh-CN" ? "别混淆" : "Don't mix up"}</strong>
          {lang === "zh-CN" ? "：" : ": "}
          {concept.mixUp}。{concept.mixUpWhy}
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
                <span className="cap">{value ? "True" : "False"}</span>
              </button>
            );
          })}
        </div>
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

function CompleteScreen(props: {
  summary: Summary;
  isPractice: boolean;
  lessonId: string;
  course: Course;
  t: UiText;
  onStart: (id: string) => void;
  onPractice: (focus?: string[]) => void;
  onPath: () => void;
}) {
  const { summary, t } = props;
  const acc = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
  const lessonIndex = props.course.lessons.findIndex((lesson) => lesson.id === props.lessonId);
  const next = props.isPractice ? undefined : props.course.lessons[lessonIndex + 1];
  return (
    <main className="hero">
      <Confetti />
      <div className="mascot">
        <Hedgehog />
      </div>
      <h1>
        {summary.xpPerfect
          ? t.complete.flawless
          : props.isPractice
            ? t.complete.practiceDone
            : t.complete.done}
      </h1>
      <p className="sub">{t.complete.accuracy(acc, summary.correct, summary.total)}</p>
      <div className="xp-card">
        {props.isPractice ? (
          <div className="xp-row">
            <span>{t.complete.xpCorrect}</span>
            <span>+{summary.xpHit} XP</span>
          </div>
        ) : (
          <>
            <div className="xp-row">
              <span>{t.complete.xpCorrect}</span>
              <span>+{summary.xpHit} XP</span>
            </div>
            <div className="xp-row">
              <span>{t.complete.xpLesson}</span>
              <span>+{summary.xpDone} XP</span>
            </div>
            {summary.xpPerfect > 0 && (
              <div className="xp-row">
                <span>{t.complete.xpPerfect}</span>
                <span>+{summary.xpPerfect} XP</span>
              </div>
            )}
          </>
        )}
        <div className="xp-row total">
          <span>{t.complete.xpTotal}</span>
          <span>+{summary.gained} XP</span>
        </div>
      </div>
      {summary.mix.length > 0 && (
        <>
          <p className="sub" style={{ marginBottom: 8 }}>
            {t.complete.mixTitle}
          </p>
          <div className="chips">
            {summary.mix.map((id) => {
              const concept = conceptOf(props.course, id);
              if (!concept) return null;
              return (
                <span className="chip" key={id}>
                  {concept.term} vs {concept.mixUp}
                </span>
              );
            })}
          </div>
        </>
      )}
      {props.isPractice ? (
        <>
          <button type="button" className="btn btn-gold" onClick={() => props.onPractice()}>
            {t.complete.practiceAgain}
          </button>
          <button type="button" className="btn btn-ghost" onClick={props.onPath}>
            {t.complete.backToPath}
          </button>
        </>
      ) : next ? (
        <>
          <button type="button" className="btn btn-gold" onClick={() => props.onStart(next.id)}>
            {t.complete.nextLesson(next.title)}
          </button>
          {summary.mix.length > 0 && (
            <button type="button" className="btn btn-green" onClick={() => props.onPractice(summary.mix)}>
              {t.complete.practiceThose}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={props.onPath}>
            {t.complete.backToPath}
          </button>
        </>
      ) : (
        <>
          {summary.mix.length > 0 && (
            <button type="button" className="btn btn-green" onClick={() => props.onPractice(summary.mix)}>
              {t.complete.practiceThose}
            </button>
          )}
          <button type="button" className="btn btn-ghost" onClick={props.onPath}>
            {t.complete.backToPath}
          </button>
        </>
      )}
    </main>
  );
}

function FailScreen(props: {
  isPractice: boolean;
  lessonId: string;
  t: UiText;
  onRetryLesson: (id: string) => void;
  onRetryPractice: () => void;
  onPath: () => void;
}) {
  const { t } = props;
  return (
    <main className="hero">
      <div className="mascot">💔</div>
      <h1>{t.fail.title}</h1>
      <p className="sub">{t.fail.copy}</p>
      {props.isPractice ? (
        <button type="button" className="btn btn-gold" onClick={props.onRetryPractice}>
          {t.fail.retryPractice}
        </button>
      ) : (
        <button type="button" className="btn btn-gold" onClick={() => props.onRetryLesson(props.lessonId)}>
          {t.fail.retryLesson}
        </button>
      )}
      <button type="button" className="btn btn-ghost" onClick={props.onPath}>
        {t.fail.backToPath}
      </button>
    </main>
  );
}

export default App;
