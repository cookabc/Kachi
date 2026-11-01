import { type ChangeEvent, lazy, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { prefersGeneratedArt, TermArt } from "./art";
import { Nav, type Tab } from "./chrome";
import { LazyPanel } from "./components/LazyPanel";
import {
  ALL_PACKS,
  courseFor,
  DEFAULT_PACK,
  course as defaultCourse,
  loadCourse,
  loadPackId,
  PACKS,
  savePackId,
} from "./course";
import type { Concept, Course, LearnerState } from "./domain";
import { emptyLearnerState } from "./engine";
import { conceptOf } from "./flow";
import { type FlowEvent, type FlowState, idleState, reduceFlow } from "./flow-machine";
import { handleEnterShortcut } from "./keyboard";
import { applyMotion, clampLevel, effectiveLevel, loadMotionLevel, saveMotionLevel } from "./motion";
import { coursePairs, isPairMet } from "./pairs";
import { activateUpdate } from "./pwa";
import { CompleteScreen } from "./screens/CompleteScreen";
import { LearnHome } from "./screens/LearnHome";
import { LessonScreen } from "./screens/LessonScreen";
import { playAnswerSound, playCompleteSound } from "./sfx";
import type { PairCardInput } from "./share-card";
import {
  exportLearnerData,
  INCOMPATIBLE_LEARNER_FILE,
  importLearnerData,
  loadLearnerState,
  saveLearnerState,
} from "./storage";
import { type Lang, loadLang, saveLang, UI, type UiText } from "./ui";

const PairsScreen = lazy(() => import("./screens/PairsScreen").then((m) => ({ default: m.PairsScreen })));
const MeScreen = lazy(() => import("./screens/MeScreen").then((m) => ({ default: m.MeScreen })));
const LevelsSheet = lazy(() => import("./screens/LevelsSheet").then((m) => ({ default: m.LevelsSheet })));
const ShareSheet = lazy(() => import("./screens/ShareSheet").then((m) => ({ default: m.ShareSheet })));

const deviceId = crypto.randomUUID();
let eventCounter = 0;
const environment = {
  now: () => new Date(),
  random: () => Math.random(),
  deviceId,
  eventId: () => `${deviceId}-${Date.now()}-${++eventCounter}`,
};

function packLevel(packId: string): number {
  return ALL_PACKS.find((pack) => pack.id === packId)?.level ?? 1;
}

function pairCardInput(course: Course, concept: Concept, t: UiText): PairCardInput {
  const sibling = conceptOf(course, concept.mixUp);
  const unit = course.units.find((item) => item.id === concept.unit);
  return {
    kicker: t.share.kicker(packLevel(course.packId), unit?.title ?? ""),
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
  const [packId, setPackIdState] = useState<string>(DEFAULT_PACK);
  const [course, setCourse] = useState<Course>(defaultCourse);
  const [flowState, setFlowState] = useState<FlowState>(() => idleState(emptyLearnerState()));
  const flow = flowState.flow;
  const state = flowState.learner;
  const setState = (next: LearnerState) => setFlowState((current) => ({ ...current, learner: next }));
  const [updateReady, setUpdateReady] = useState(false);
  const courseRequest = useRef(0);
  const [courseFailure, setCourseFailure] = useState<{ packId: string; lang: Lang } | null>(null);
  const [loadingPack, setLoadingPack] = useState<string | null>(null);
  const [levelsOpen, setLevelsOpen] = useState(false);
  const [shareCards, setShareCards] = useState<PairCardInput[] | null>(null);
  const [storageFailed, setStorageFailed] = useState(false);
  const [motion, setMotionState] = useState<number>(() => effectiveLevel(loadMotionLevel()));
  const questionShownAt = useRef(0);

  const t = UI[lang];

  useEffect(() => {
    document.documentElement.lang = lang;
    document.title = t.doc.title;
    document.querySelector('meta[name="description"]')?.setAttribute("content", t.doc.description);
  }, [lang, t]);

  // Boot: learner record and course load independently, so one failing never
  // keeps the loading screen up. The default level ships in the bundle; a
  // stored other level is fetched, and falls back to the default if offline.
  useEffect(() => {
    let alive = true;
    const initialLang = loadLang();
    const initialPack = loadPackId() ?? DEFAULT_PACK;
    const learner = loadLearnerState().then(
      (loaded) => ({ loaded, failed: false }),
      () => ({ loaded: emptyLearnerState(), failed: true }),
    );
    const pack = loadCourse(initialPack, initialLang).then(
      (loadedCourse) => ({ loadedCourse, lang: initialLang, packId: initialPack }),
      // Offline on a first visit, or a chunk that failed: the bundled English
      // level 1 always renders. The language follows the course that loaded.
      () => {
        const fallback = courseFor(DEFAULT_PACK, initialLang);
        return fallback
          ? { loadedCourse: fallback, lang: initialLang, packId: DEFAULT_PACK }
          : { loadedCourse: defaultCourse, lang: "en-US" as Lang, packId: DEFAULT_PACK };
      },
    );
    void Promise.all([learner, pack]).then(([learnerResult, packResult]) => {
      if (!alive) return;
      setFlowState((current) => ({ ...current, learner: learnerResult.loaded }));
      setStorageFailed(learnerResult.failed);
      setCourse(packResult.loadedCourse);
      setPackIdState(packResult.packId);
      if (packResult.lang !== initialLang) {
        setLangState(packResult.lang);
        saveLang(packResult.lang);
      }
      setReady(true);
    });
    const listener = () => setUpdateReady(true);
    window.addEventListener("kachi-update-ready", listener);
    return () => {
      alive = false;
      ++courseRequest.current;
      window.removeEventListener("kachi-update-ready", listener);
    };
  }, []);

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

  useEffect(() => {
    applyMotion(motion);
  }, [motion]);

  // Feedback cues: a chime and a short buzz on phones. Keyed on the session's
  // result count so each graded answer fires exactly once.
  const resultCount = flow.session?.results.length ?? 0;
  const lastCue = useRef(0);
  useEffect(() => {
    if (flow.phase === "feedback" && resultCount > lastCue.current) {
      playAnswerSound(flow.lastCorrect, motion);
      if (motion > 0) navigator.vibrate?.(flow.lastCorrect ? 12 : [30, 40, 30]);
    }
    if (flow.phase === "complete" && lastCue.current !== -1) {
      playCompleteSound(motion);
      lastCue.current = -1;
      return;
    }
    lastCue.current = flow.session ? resultCount : 0;
  }, [flow.phase, flow.lastCorrect, flow.session, resultCount, motion]);

  const setMotion = (value: number) => {
    const level = clampLevel(value);
    setMotionState(level);
    saveMotionLevel(level);
  };

  // Commit course identity and language together. A failed or obsolete request
  // cannot replace a working course, reset the selected level, or change locale.
  const selectCourse = (nextPack: string, nextLang: Lang, onDone?: () => void) => {
    const revision = ++courseRequest.current;
    setCourseFailure(null);
    const commit = (loaded: Course) => {
      if (revision !== courseRequest.current) return;
      setCourse(loaded);
      setPackIdState(nextPack);
      savePackId(nextPack);
      setLangState(nextLang);
      saveLang(nextLang);
      setLoadingPack(null);
      onDone?.();
    };
    const cached = courseFor(nextPack, nextLang);
    if (cached) {
      commit(cached);
      return;
    }
    setLoadingPack(nextPack);
    void loadCourse(nextPack, nextLang).then(commit, () => {
      if (revision !== courseRequest.current) return;
      setLoadingPack(null);
      setCourseFailure({ packId: nextPack, lang: nextLang });
    });
  };
  const setLang = (next: Lang) => selectCourse(packId, next);
  const pickLevel = (next: string) => {
    if (next === packId) {
      setLevelsOpen(false);
      return;
    }
    selectCourse(next, lang, () => {
      setLevelsOpen(false);
      setTab("learn");
      window.scrollTo({ top: 0 });
    });
  };

  // The registry lists levels in reading order; counts of already-known words
  // tell a learner how much of a level is genuinely new.
  const levelChoices = useMemo(
    () =>
      [...PACKS]
        .sort((a, b) => a.level - b.level)
        .map((pack) => {
          const loaded = courseFor(pack.id, lang);
          const known = loaded
            ? loaded.concepts.filter((concept) => state.seenConceptIds.includes(concept.id)).length
            : 0;
          return {
            id: pack.id,
            level: pack.level,
            title: lang === "zh-CN" ? pack.title : pack.titleEn,
            goal: lang === "zh-CN" ? pack.goal : pack.goalEn,
            conceptCount: pack.conceptCount,
            known: pack.id === packId ? 0 : known,
          };
        }),
    [lang, state.seenConceptIds, packId],
  );
  const currentLevel = levelChoices.find((item) => item.id === packId) ?? levelChoices[0];
  const nextLevel = levelChoices.find((item) => item.level === currentLevel.level + 1);

  const pairCount = useMemo(
    () => coursePairs(course).filter((pair) => isPairMet(state, pair)).length,
    [course, state],
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

  // ---- lesson lifecycle: one pure reducer (flow-machine.ts) -------------------

  const dispatch = useCallback(
    (event: FlowEvent) => {
      setFlowState((current) => {
        const out = reduceFlow(current, event, { course, environment });
        const learner = out.seen.length
          ? {
              ...out.state.learner,
              seenConceptIds: Array.from(new Set([...out.state.learner.seenConceptIds, ...out.seen])),
            }
          : out.state.learner;
        if (out.state.flow.phase === "question") questionShownAt.current = environment.now().getTime();
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

  const answer = useCallback(
    (value: string | boolean) => dispatch({ type: "submit", answer: value, latencyMs: latency() }),
    [dispatch, latency],
  );

  // Keyboard: Enter drives the lesson, 1–4 choose. On the completion screen
  // Enter activates the primary action only when focus is not on a control.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter") {
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
    const blob = await exportLearnerData(state);
    const href = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = href;
    link.download = `kachi-learning-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 30_000);
  };

  const onImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setState(await importLearnerData(file));
      alert(t.me.imported);
    } catch (error) {
      const incompatible = error instanceof Error && error.message === INCOMPATIBLE_LEARNER_FILE;
      alert(incompatible ? t.me.importInvalid : t.me.importFailed);
    } finally {
      event.target.value = "";
    }
  };

  if (!ready) return <main className="loading">{t.loading}</main>;

  const shareLayer = shareCards && (
    <LazyPanel t={t}>
      <ShareSheet cards={shareCards} t={t} onClose={() => setShareCards(null)} />
    </LazyPanel>
  );

  if (flow.session && flow.phase === "complete" && flow.summary) {
    const session = flow.session;
    return (
      <>
        <CompleteScreen
          summary={flow.summary}
          bestCombo={flow.bestCombo}
          isPractice={session.mode === "practice"}
          lessonId={session.lessonId}
          course={course}
          t={t}
          motion={motion}
          blocked={shareCards !== null}
          onStart={beginLesson}
          onPractice={beginPractice}
          onPath={closeLesson}
          onShare={() => {
            const lesson = course.lessons.find((item) => item.id === session.lessonId);
            openShare(lesson ? [...new Set(lesson.prompts.flatMap((prompt) => prompt.termIds ?? []))] : []);
          }}
        />
        {shareLayer}
      </>
    );
  }

  if (flow.session && (flow.phase === "teach" || flow.phase === "question" || flow.phase === "feedback")) {
    const session = flow.session;
    const activeLesson = course.lessons.find((item) => item.id === session.lessonId);
    // Progress counts first-time prompts only: a replayed miss extends the run
    // without moving the bar backwards.
    const firstPass = new Set(session.promptIds).size;
    const answered = new Set(session.results.filter((r) => r.correct || r.isRetry).map((r) => r.exerciseId))
      .size;
    return (
      <LessonScreen
        title={session.mode === "practice" ? t.lesson.practiceTitle : (activeLesson?.title ?? "")}
        phase={flow.phase}
        t={t}
        lang={lang}
        course={course}
        teachMode={flow.teachMode}
        teachTerms={flow.teachTerms}
        teachIndex={flow.teachIndex}
        presented={flow.presented}
        selection={flow.selection}
        lastCorrect={flow.lastCorrect}
        combo={flow.combo}
        answered={answered}
        total={firstPass}
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

  const stagePairs = coursePairs(course).slice(0, 6);
  return (
    <div className="app">
      <div className="stage" aria-hidden="true">
        {stagePairs.map((pair) => (
          <span className="sticker" key={pair.id}>
            <TermArt id={pair.a} size="lg" preferGenerated={prefersGeneratedArt(course)} />
            {conceptOf(course, pair.a)?.term}
            <i>/</i>
            {conceptOf(course, pair.b)?.term}
          </span>
        ))}
      </div>
      <div className="app-col">
        {updateReady && (
          <button type="button" className="banner" onClick={activateUpdate}>
            {t.updateBanner}
          </button>
        )}
        {courseFailure && !levelsOpen && (
          <div className="banner alert" role="alert">
            <p>{t.courseLoadFailed}</p>
            <button
              type="button"
              className="btn btn-white btn-sm"
              onClick={() =>
                selectCourse(courseFailure.packId, courseFailure.lang, () => setLevelsOpen(false))
              }
            >
              {t.retryLoad}
            </button>
          </div>
        )}
        {storageFailed && (
          <p className="banner alert" role="alert">
            {t.storageUnavailable}
          </p>
        )}

        {tab === "learn" && (
          <LearnHome
            state={state}
            course={course}
            t={t}
            level={currentLevel}
            nextLevel={nextLevel}
            now={environment.now()}
            onStart={beginLesson}
            onReview={() => beginPractice()}
            onLevels={() => setLevelsOpen(true)}
          />
        )}
        {tab === "pairs" && (
          <LazyPanel t={t}>
            <PairsScreen
              state={state}
              course={course}
              t={t}
              lang={lang}
              onShare={openShare}
              onPractice={(ids) => beginPractice(ids)}
            />
          </LazyPanel>
        )}
        {tab === "me" && (
          <LazyPanel t={t}>
            <MeScreen
              state={state}
              course={course}
              t={t}
              lang={lang}
              motion={motion}
              onLang={setLang}
              onMotion={setMotion}
              onPractice={(ids) => beginPractice(ids)}
              onExport={downloadExport}
              onImport={onImport}
            />
          </LazyPanel>
        )}

        {levelsOpen && (
          <LazyPanel t={t}>
            <LevelsSheet
              levels={levelChoices}
              current={packId}
              loadingId={loadingPack}
              failedId={courseFailure?.packId ?? null}
              t={t}
              onPick={pickLevel}
              onRetry={() => courseFailure && pickLevel(courseFailure.packId)}
              onClose={() => setLevelsOpen(false)}
            />
          </LazyPanel>
        )}
        {shareLayer}
      </div>
      <Nav
        tab={tab}
        t={t}
        pairCount={pairCount}
        onTab={(next) => {
          setTab(next);
          window.scrollTo({ top: 0 });
        }}
      />
    </div>
  );
}

export default App;
