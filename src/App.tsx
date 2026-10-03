import { type ChangeEvent, useEffect, useMemo, useState } from "react";
import { MAX_HEARTS, Nav, type Tab } from "./chrome";
import { courseFor, course as defaultCourse, loadCourse } from "./course";
import type { Concept, Course, LearnerState, SessionState } from "./domain";
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
import { activateUpdate } from "./pwa";
import { CompleteScreen } from "./screens/CompleteScreen";
import { FailScreen } from "./screens/FailScreen";
import { Glossary } from "./screens/Glossary";
import { GraphScreen } from "./screens/GraphScreen";
import { LearnHome } from "./screens/LearnHome";
import { LessonScreen, type Phase } from "./screens/LessonScreen";
import { PracticeHome } from "./screens/PracticeHome";
import { Settings } from "./screens/Settings";
import { ShareSheet } from "./screens/ShareSheet";
import type { PairCardInput } from "./share-card";
import { exportLearnerData, importLearnerData, loadLearnerState, saveLearnerState } from "./storage";
import { type Lang, loadLang, saveLang, UI, type UiText } from "./ui";

const deviceId = crypto.randomUUID();
let eventCounter = 0;
const environment = {
  now: () => new Date(),
  random: () => Math.random(),
  deviceId,
  eventId: () => `${deviceId}-${Date.now()}-${++eventCounter}`,
};

function pairCardInput(course: Course, concept: Concept, t: UiText): PairCardInput {
  const sibling = conceptOf(course, concept.mixUp);
  const unit = course.units.find((item) => item.id === concept.unit);
  return {
    kicker: `Kachi · ${t.home.unit(concept.unit)} · ${unit?.title ?? ""}`,
    termA: concept.term,
    forkA: concept.definition,
    termB: sibling?.term ?? concept.mixUp,
    forkB: sibling?.definition ?? "",
    example: concept.example,
    artA: concept.id,
    artB: sibling?.id,
  };
}

function App() {
  const [state, setState] = useState<LearnerState>(emptyLearnerState());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("learn");
  const [lang, setLangState] = useState<Lang>(() => loadLang());
  // The zh pack is bundled and always renderable; a stored en-US preference
  // swaps in the lazy en pack before the loading screen lifts.
  const [course, setCourse] = useState<Course>(defaultCourse);
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
  const [shareCards, setShareCards] = useState<PairCardInput[] | null>(null);

  const t = UI[lang];

  // The document shell belongs to the UI language: screen readers pronounce it
  // and search engines index it — React state alone never reaches them.
  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.doc.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.doc.description);
  }, [lang, t]);

  useEffect(() => {
    let alive = true;
    // Re-read the stored language here: this effect is mount-only, and a
    // state variable would drag a later language change back into it.
    const initialLang = loadLang();
    void Promise.all([loadLearnerState(), loadCourse(initialLang)]).then(([loaded, loadedCourse]) => {
      if (!alive) return;
      setState(loaded);
      setCourse(loadedCourse);
      setReady(true);
    });
    const listener = () => setUpdateReady(true);
    window.addEventListener("kachi-update-ready", listener);
    return () => {
      alive = false;
      window.removeEventListener("kachi-update-ready", listener);
    };
  }, []);

  // Every committed state change is durable: one save path for answers, seen
  // terms, and imports alike — updaters stay pure.
  useEffect(() => {
    if (ready) void saveLearnerState(state);
  }, [state, ready]);

  const missedCount = useMemo(() => recentMissTermIds(state).length, [state]);

  const openShare = (conceptIds: string[]) => {
    const seenPairs = new Set<string>();
    const cards: PairCardInput[] = [];
    for (const id of conceptIds) {
      const concept = conceptOf(course, id);
      if (!concept) continue;
      const key = [concept.id, concept.mixUp].sort().join("|");
      if (seenPairs.has(key)) continue;
      seenPairs.add(key);
      cards.push(pairCardInput(course, concept, t));
    }
    if (cards.length) setShareCards(cards);
  };

  const shareConceptIds = (sess: SessionState): string[] => {
    if (sess.mode !== "practice") {
      const lesson = course.lessons.find((item) => item.id === sess.lessonId);
      return lesson ? [...new Set(lesson.prompts.flatMap((prompt) => prompt.termIds ?? []))] : [];
    }
    const wanted = new Set(sess.promptIds);
    return [
      ...new Set(
        course.lessons
          .flatMap((lesson) => lesson.prompts)
          .filter((prompt) => wanted.has(prompt.id))
          .flatMap((prompt) => prompt.termIds ?? []),
      ),
    ];
  };

  const setLang = (next: Lang) => {
    setLangState(next);
    saveLang(next);
    const cached = courseFor(next);
    if (cached) {
      setCourse(cached);
      return;
    }
    setReady(false);
    void loadCourse(next)
      .then((loaded) => {
        setCourse(loaded);
        setReady(true);
      })
      .catch(() => {
        // The lazy pack could not be fetched (offline before the service
        // worker cached it): fall back to the zh pack so the interface
        // strings and the course never disagree.
        setCourse(defaultCourse);
        setLangState("zh-CN");
        saveLang("zh-CN");
        setReady(true);
      });
  };

  const markSeen = (ids: string[]) => {
    if (!ids.length) return;
    setState((prev) => ({
      ...prev,
      seenConceptIds: Array.from(new Set([...prev.seenConceptIds, ...ids])),
    }));
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
      markSeen(publishedTermIds(first, course));
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
    setState(result.state);
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
      markSeen(publishedTermIds(next, course));
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
      setState(await importLearnerData(file));
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
      <>
        <CompleteScreen
          summary={summary}
          isPractice={session.mode === "practice"}
          lessonId={session.lessonId}
          course={course}
          t={t}
          onStart={beginLesson}
          onPractice={beginPractice}
          onPath={closeLesson}
          onShare={() => openShare(shareConceptIds(session))}
        />
        {shareCards && <ShareSheet cards={shareCards} t={t} onClose={() => setShareCards(null)} />}
      </>
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
    <main className="shell home-shell">
      <aside className="desktop-story" aria-labelledby="desktop-story-title">
        <div className="desktop-story-top">
          <span className="desktop-wordmark">
            Kachi<span aria-hidden="true">✳</span>
          </span>
          <span className="desktop-edition">
            {lang === "zh-CN" ? "财经英语实验室 / 001" : "FINANCIAL ENGLISH LAB / 001"}
          </span>
        </div>
        <div className="desktop-story-main">
          <p className="desktop-eyebrow">
            {lang === "zh-CN" ? "学会看清词语背后的动作" : "SEE THE ACTION BEHIND THE WORD"}
          </p>
          <p id="desktop-story-title" className="desktop-story-title">
            {lang === "zh-CN" ? (
              <>
                别背单词。
                <br />
                学会<span>分辨。</span>
              </>
            ) : (
              <>
                Less memorizing.
                <br />
                <span>More meaning.</span>
              </>
            )}
          </p>
          <p className="desktop-story-copy">
            {lang === "zh-CN"
              ? "Hedge 是保护风险，Pledge 是拿资产作抵押。一个词的差别，可能让整段财经新闻的意思反过来。"
              : "Hedge protects against risk. Pledge puts an asset up as collateral. One word can change the meaning of a financial story."}
          </p>
          <div className="concept-pair">
            <div>
              <span>01 / HEDGE</span>
              <strong>{lang === "zh-CN" ? "对冲风险" : "Protect"}</strong>
            </div>
            <span className="concept-pair-divider" aria-hidden="true">
              ≠
            </span>
            <div>
              <span>02 / PLEDGE</span>
              <strong>{lang === "zh-CN" ? "抵押资产" : "Collateral"}</strong>
            </div>
          </div>
          <button
            type="button"
            className="desktop-start"
            onClick={() =>
              beginLesson(
                course.lessons.find(
                  (lesson) =>
                    isLessonUnlocked(state, course, lesson.id) &&
                    !state.completedLessonIds.includes(lesson.id),
                )?.id ?? course.lessons[0].id,
              )
            }
          >
            {lang === "zh-CN" ? "开始下一课" : "Start the next lesson"}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="desktop-story-bottom">
          <span>
            {lang === "zh-CN"
              ? "本地保存 · 无账户 · 无投资建议"
              : "LOCAL FIRST · NO ACCOUNT · NO INVESTMENT ADVICE"}
          </span>
          <span>
            {state.completedLessonIds.length.toString().padStart(2, "0")} /{" "}
            {course.lessons.length.toString().padStart(2, "0")}
          </span>
        </div>
      </aside>
      <div className="app-window">
        {updateReady && (
          <button type="button" className="update" onClick={activateUpdate}>
            {t.updateBanner}
          </button>
        )}

        {tab === "learn" && (
          <LearnHome state={state} course={course} t={t} missedCount={missedCount} onStart={beginLesson} />
        )}
        {tab === "practice" && (
          <PracticeHome t={t} missedCount={missedCount} onStart={() => beginPractice()} />
        )}
        {tab === "glossary" && (
          <Glossary
            state={state}
            course={course}
            t={t}
            lang={lang}
            query={glossaryQuery}
            onQuery={setGlossaryQuery}
            onShare={(conceptIds) => openShare(conceptIds)}
          />
        )}
        {tab === "graph" && (
          <GraphScreen
            state={state}
            course={course}
            t={t}
            onOpenGlossary={(term) => {
              setGlossaryQuery(term);
              setTab("glossary");
            }}
          />
        )}
        {tab === "settings" && (
          <Settings t={t} lang={lang} onLang={setLang} onExport={downloadExport} onImport={onImport} />
        )}

        {shareCards && <ShareSheet cards={shareCards} t={t} onClose={() => setShareCards(null)} />}

        <Nav tab={tab} onTab={setTab} t={t} />
      </div>
    </main>
  );
}

export default App;
