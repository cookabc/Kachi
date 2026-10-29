import { type ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Nav, type Tab } from "./chrome";
import { ALL_PACKS, courseFor, DEFAULT_PACK, course as defaultCourse, loadCourse } from "./course";
import type { Concept, Course, LearnerState, SessionState } from "./domain";
import { emptyLearnerState, isLessonDone, isLessonUnlocked, recentMissTermIds } from "./engine";
import { conceptOf } from "./flow";
import { type FlowEvent, type FlowState, idleState, reduceFlow } from "./flow-machine";
import { handleEnterShortcut } from "./keyboard";
import { applyMotion, clampLevel, effectiveLevel, loadMotionLevel, saveMotionLevel } from "./motion";
import { activateUpdate } from "./pwa";
import { CompleteScreen } from "./screens/CompleteScreen";
import { FailScreen } from "./screens/FailScreen";
import { Glossary } from "./screens/Glossary";
import { GraphScreen } from "./screens/GraphScreen";
import { LearnHome } from "./screens/LearnHome";
import { LessonScreen } from "./screens/LessonScreen";
import { PracticeHome } from "./screens/PracticeHome";
import { Settings } from "./screens/Settings";
import { ShareSheet } from "./screens/ShareSheet";
import type { PairCardInput } from "./share-card";
import {
  exportLearnerData,
  INCOMPATIBLE_LEARNER_FILE,
  importLearnerData,
  loadLearnerState,
  saveLearnerState,
} from "./storage";
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
    kicker: `Kachi, ${t.home.unit(concept.unit)}, ${unit?.title ?? ""}`,
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
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("learn");
  const [lang, setLangState] = useState<Lang>(() => loadLang());
  // Which course the learner is working through. Separate from language: the
  // same pack exists in both locales, and switching pack must not switch locale.
  const [packId, setPackIdState] = useState<string>(DEFAULT_PACK);
  // The zh pack is bundled and always renderable; a stored en-US preference
  // swaps in the lazy en pack before the loading screen lifts.
  const [course, setCourse] = useState<Course>(defaultCourse);
  // The whole lesson lifecycle is one value, owned by the pure reducer in
  // flow-machine.ts. Nothing below reaches into its fields to mutate them.
  const [flowState, setFlowState] = useState<FlowState>(() => idleState(emptyLearnerState()));
  const flow = flowState.flow;
  // The learner record lives inside flowState so a reducer transition can never
  // leave the saved snapshot behind the visible flow. `state` is a readable
  // alias for the many places that only need to read it.
  const state = flowState.learner;
  const setState = (next: LearnerState) => setFlowState((current) => ({ ...current, learner: next }));
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [updateReady, setUpdateReady] = useState(false);
  const [shareCards, setShareCards] = useState<PairCardInput[] | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  // null stored = untouched slider = follow the OS reduced-motion preference
  const [motion, setMotionState] = useState<number>(() => effectiveLevel(loadMotionLevel()));
  // When the prompt on screen was presented — feeds attempt.latencyMs. A ref,
  // not state: resetting it must not re-render the question.
  const questionShownAt = useRef(0);

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
    // Course and IndexedDB fail on their own. One shared promise used to reject
    // the whole boot, and the loading screen never lifted.
    const learner = loadLearnerState().then(
      (loaded) => ({ loaded, failed: false }),
      () => ({ loaded: emptyLearnerState(), failed: true }),
    );
    const pack = loadCourse(DEFAULT_PACK, initialLang).then(
      (loadedCourse) => ({ loadedCourse, lang: initialLang }),
      () => {
        // The lazy pack could not be fetched. The default packs ship in the
        // main bundle in both locales, so fall back to the bundled copy of the
        // language that was asked for, and only then to English.
        const fallback: Lang = initialLang === "zh-CN" ? "zh-CN" : "en-US";
        saveLang(fallback);
        return { loadedCourse: courseFor(DEFAULT_PACK, fallback) ?? defaultCourse, lang: fallback };
      },
    );
    void Promise.all([learner, pack]).then(([learnerResult, packResult]) => {
      if (!alive) return;
      setFlowState((current) => ({ ...current, learner: learnerResult.loaded }));
      setStorageFailed(learnerResult.failed);
      setCourse(packResult.loadedCourse);
      if (packResult.lang !== initialLang) setLangState(packResult.lang);
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
  // terms, and imports alike — updaters stay pure. A rejected write is shown
  // on the same alert the startup path uses, and logged, without taking the
  // UI down with it.
  useEffect(() => {
    if (!ready || storageFailed) return;
    let active = true;
    void saveLearnerState(state).catch((error: unknown) => {
      console.error("Failed to save learning progress", error);
      if (active) setStorageFailed(true);
    });
    return () => {
      active = false;
    };
  }, [state, ready, storageFailed]);

  // Mirror the motion level onto <html data-motion> whenever it changes.
  useEffect(() => {
    applyMotion(motion);
  }, [motion]);

  const setMotion = (value: number) => {
    const level = clampLevel(value);
    setMotionState(level);
    saveMotionLevel(level);
  };

  const missedCount = useMemo(() => recentMissTermIds(state).length, [state]);

  // Registry entries that have content versus ones still being written. A pack
  // shows as selectable only when there is a chunk to load for this locale.
  const packChoices = useMemo(
    () =>
      ALL_PACKS.map((pack) => ({
        id: pack.id,
        level: pack.level,
        // The picker must follow the interface language; the registry carries
        // both names. Rendering pack.title unconditionally showed a Chinese
        // course list inside the English UI.
        title: lang === "zh-CN" ? pack.title : pack.titleEn,
        goal: lang === "zh-CN" ? pack.goal : pack.goalEn,
        conceptCount: pack.conceptCount,
        ready: Boolean(courseFor(pack.id, lang)) || pack.status === "ready" || pack.status === "building",
        legacy: pack.legacy,
      })),
    [lang],
  );

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
    const cached = courseFor(packId, next);
    if (cached) {
      setCourse(cached);
      return;
    }
    setReady(false);
    void loadCourse(packId, next)
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

  const setPack = (next: string) => {
    if (next === packId) return;
    setPackIdState(next);
    const cached = courseFor(next, lang);
    if (cached) {
      setCourse(cached);
      return;
    }
    setReady(false);
    void loadCourse(next, lang)
      .then((loaded) => {
        setCourse(loaded);
        setReady(true);
      })
      .catch(() => {
        // A pack with no chunk (planned but unwritten) keeps the current one.
        setPackIdState(packId);
        setReady(true);
      });
  };

  // ---- lesson lifecycle ----------------------------------------------------
  // All of it lives in one pure reducer (flow-machine.ts). This component only
  // forwards events, records when the prompt appeared, and persists the result.

  const dispatch = useCallback(
    (event: FlowEvent) => {
      setFlowState((current) => {
        const out = reduceFlow(current, event, { course, environment });
        // Fold newly met terms into the learner record here, inside the same
        // update, so the saved snapshot and the flow never disagree.
        const learner = out.seen.length
          ? {
              ...out.state.learner,
              seenConceptIds: Array.from(new Set([...out.state.learner.seenConceptIds, ...out.seen])),
            }
          : out.state.learner;
        if (out.state.flow.phase === "question") {
          questionShownAt.current = environment.now().getTime();
        }
        return { flow: out.state.flow, learner };
      });
    },
    [course],
  );

  const latency = useCallback(() => environment.now().getTime() - questionShownAt.current, []);

  const beginLesson = (lessonId: string) => {
    dispatch({ type: "startLesson", lessonId });
    setTab("learn");
  };

  const beginPractice = (focusIds?: string[]) => dispatch({ type: "startPractice", focusIds });

  const closeLesson = () => {
    dispatch({ type: "close" });
    setTab("learn");
  };

  // A match is two clicks: pick a chip, then pick its partner. The first pick
  // is selection state; a completed pair is the engine event.
  const onMatch = (side: "left" | "right", id: string) => {
    if (flow.phase !== "question" || !flow.presented?.pairs || flow.locked.includes(id)) return;
    if (side === "left" && flow.selR) {
      dispatch({ type: "submitMatch", leftId: id, rightId: flow.selR, latencyMs: latency() });
      return;
    }
    if (side === "right" && flow.selL) {
      dispatch({ type: "submitMatch", leftId: flow.selL, rightId: id, latencyMs: latency() });
      return;
    }
    dispatch({ type: "selectChip", side, id });
  };

  // Stable so the keyboard effect below can list it without re-binding on
  // every render; `latency()` reads a ref, so the identity is all that matters.
  const answer = useCallback(
    (value: string | boolean) => dispatch({ type: "submit", answer: value, latencyMs: latency() }),
    [dispatch, latency],
  );

  // keyboard: Enter drives the lesson; 1-4 pick options. On complete/fail, Enter
  // activates the primary action only when focus is not already on a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
        // Lesson phases dispatch into the flow machine. Complete/fail only
        // activate the primary button when Enter was not already aimed at a
        // control or the share dialog.
        handleEnterShortcut(event, {
          shareOpen: shareCards !== null,
          phase: flow.phase,
          inSession: flow.session !== null,
          onLessonEnter: () => {
            if (flow.phase === "teach") dispatch({ type: "teachContinue" });
            else if (flow.phase === "question") {
              if (flow.presented?.type !== "match" && flow.selection !== null) answer(flow.selection);
            } else dispatch({ type: "continue" });
          },
        });
        return;
      }
      if (!flow.session || flow.phase !== "question" || !flow.presented) return;
      if (event.key >= "1" && event.key <= "4") {
        const index = Number(event.key) - 1;
        if (flow.presented.type === "truefalse") {
          if (index === 0) dispatch({ type: "select", value: true });
          if (index === 1) dispatch({ type: "select", value: false });
        } else if (flow.presented.type === "fill") {
          const word = flow.presented.bank?.[index];
          if (word !== undefined) dispatch({ type: "select", value: word });
        } else if (flow.presented.options?.[index]) {
          dispatch({ type: "select", value: flow.presented.options[index].text });
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [flow, dispatch, answer, shareCards]);

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
      const incompatible = error instanceof Error && error.message === INCOMPATIBLE_LEARNER_FILE;
      alert(incompatible ? t.settings.importInvalid : t.settings.importFailed);
    } finally {
      event.target.value = "";
    }
  };

  if (!ready) return <main className="loading">{t.loading}</main>;

  if (flow.session && flow.phase === "complete" && flow.summary) {
    return (
      <>
        <CompleteScreen
          summary={flow.summary}
          isPractice={flow.session.mode === "practice"}
          lessonId={flow.session.lessonId}
          course={course}
          t={t}
          motion={motion}
          blocked={shareCards !== null}
          onStart={beginLesson}
          onPractice={beginPractice}
          onPath={closeLesson}
          onShare={() => openShare(shareConceptIds(flow.session!))}
        />
        {shareCards && <ShareSheet cards={shareCards} t={t} onClose={() => setShareCards(null)} />}
      </>
    );
  }
  if (flow.session && flow.phase === "fail") {
    return (
      <FailScreen
        isPractice={flow.session.mode === "practice"}
        lessonId={flow.session.lessonId}
        t={t}
        onRetryLesson={beginLesson}
        onRetryPractice={() => beginPractice()}
        onPath={closeLesson}
      />
    );
  }
  if (flow.session && (flow.phase === "teach" || flow.phase === "question" || flow.phase === "feedback")) {
    const activeLesson = course.lessons.find((item) => item.id === flow.session?.lessonId);
    return (
      <LessonScreen
        lessonTitle={flow.session.mode === "practice" ? t.lesson.practiceTitle : (activeLesson?.title ?? "")}
        phase={flow.phase}
        t={t}
        lang={lang}
        course={course}
        teachMode={flow.teachMode}
        teachTerms={flow.teachTerms}
        teachIndex={flow.teachIndex}
        presented={flow.presented}
        selection={flow.selection}
        hearts={flow.hearts}
        lastCorrect={flow.lastCorrect}
        total={flow.session.promptIds.length}
        questionIndex={flow.phase === "feedback" ? Math.max(flow.session.index - 1, 0) : flow.session.index}
        selL={flow.selL}
        selR={flow.selR}
        locked={flow.locked}
        hintShown={flow.hintShown}
        onPick={(value) => dispatch({ type: "select", value })}
        onSubmit={() => flow.selection !== null && answer(flow.selection)}
        onMatch={onMatch}
        onHint={() => dispatch({ type: "hint" })}
        onTeachContinue={() => dispatch({ type: "teachContinue" })}
        onContinue={() => dispatch({ type: "continue" })}
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
          <span className="desktop-edition">{t.desktop.edition}</span>
        </div>
        <div className="desktop-story-main">
          <p className="desktop-eyebrow">{t.desktop.eyebrow}</p>
          <p id="desktop-story-title" className="desktop-story-title">
            {t.desktop.titleLead}
            <br />
            {t.desktop.titleBefore}
            <span>{t.desktop.titleEm}</span>
          </p>
          <p className="desktop-story-copy">{t.desktop.copy}</p>
          <div className="concept-pair">
            <div>
              <span>{t.desktop.hedgeMark}</span>
              <strong>{t.desktop.hedge}</strong>
            </div>
            <span className="concept-pair-divider" aria-hidden="true">
              ≠
            </span>
            <div>
              <span>{t.desktop.pledgeMark}</span>
              <strong>{t.desktop.pledge}</strong>
            </div>
          </div>
          <button
            type="button"
            className="desktop-start"
            onClick={() =>
              beginLesson(
                course.lessons.find(
                  (lesson) =>
                    isLessonUnlocked(state, course, lesson.id) && !isLessonDone(state, course, lesson.id),
                )?.id ?? course.lessons[0].id,
              )
            }
          >
            {t.desktop.start}
            <span aria-hidden="true">↗</span>
          </button>
        </div>
        <div className="desktop-story-bottom">
          <span>{t.desktop.footer}</span>
          <span>
            {course.lessons
              .filter((lesson) => isLessonDone(state, course, lesson.id))
              .length.toString()
              .padStart(2, "0")}{" "}
            / {course.lessons.length.toString().padStart(2, "0")}
          </span>
        </div>
      </aside>
      <div className="app-window">
        {updateReady && (
          <button type="button" className="update" onClick={activateUpdate}>
            {t.updateBanner}
          </button>
        )}
        {storageFailed && (
          <p className="fine" role="alert">
            {t.storageUnavailable}
          </p>
        )}

        {tab === "learn" && (
          <LearnHome state={state} course={course} t={t} missedCount={missedCount} onStart={beginLesson} />
        )}
        {tab === "practice" && (
          <PracticeHome
            state={state}
            course={course}
            t={t}
            lang={lang}
            missedCount={missedCount}
            onStart={() => beginPractice()}
          />
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
            lang={lang}
            onOpenGlossary={(term) => {
              setGlossaryQuery(term);
              setTab("glossary");
            }}
          />
        )}
        {tab === "settings" && (
          <Settings
            t={t}
            lang={lang}
            motion={motion}
            packs={packChoices}
            packId={packId}
            onLang={setLang}
            onMotion={setMotion}
            onPack={setPack}
            onExport={downloadExport}
            onImport={onImport}
          />
        )}

        {shareCards && <ShareSheet cards={shareCards} t={t} onClose={() => setShareCards(null)} />}

        <Nav tab={tab} onTab={setTab} t={t} />
      </div>
    </main>
  );
}

export default App;
