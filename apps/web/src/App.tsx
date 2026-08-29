import { ChangeEvent, CSSProperties, useEffect, useMemo, useState } from "react";
import type { Concept, Exercise, LearnerState, SessionState } from "@kachi/domain";
import {
  applyAnswer,
  currentExercise,
  duePairIds,
  emptyLearnerState,
  isLessonUnlocked,
  pairIdForConcept,
  recentMissTermIds,
  requeuePrompt,
  startPracticeSession,
  startSession
} from "@kachi/learning-engine";
import { course } from "./course";
import { localizedTerm, termLocalization } from "./localization";
import { exportLearnerData, importLearnerData, loadLearnerState, saveLearnerState } from "./storage";
import { artIdForLabel, Hedgehog, NAV_ICONS, TermArt } from "./art";
import {
  PRACTICE_ROUND,
  conceptOf,
  practicePool,
  present,
  realTermIds as publishedTermIds,
  resolveMatch,
  sessionSummary,
  teachPlan,
  type PresentedExercise,
  type Summary,
  type TeachMode
} from "./flow";

type Tab = "learn" | "practice" | "glossary" | "settings";
type Phase = "teach" | "question" | "feedback" | "complete" | "fail";

const MAX_HEARTS = 5;
const SNAKE = [0, 56, 8, -56];
const NICE = ["不错。", "正是。", "答对了。", "漂亮。"];
const NOPE = ["还差一点。", "混淆了。", "又是这一对。", "岔路走反了。"];
const KICKERS: Record<Exercise["type"], string> = {
  meaning: "词义辨析",
  truefalse: "判断正误",
  fill: "补全句子",
  scenario: "真实情境",
  match: "配对练习"
};

const deviceId = crypto.randomUUID();
let eventCounter = 0;
const environment = {
  now: () => new Date(),
  random: () => Math.random(),
  deviceId,
  eventId: () => `${deviceId}-${Date.now()}-${++eventCounter}`
};

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

const conceptById = (id: string) => conceptOf(course, id);
const realTermIds = (prompt: Exercise) => publishedTermIds(prompt, course);

function zhMixHint(prompt: Exercise): string | undefined {
  const termId = (prompt.termIds ?? []).find((id) => termLocalization[id]);
  return termId ? localizedTerm(termId).mixUpWhyZh : undefined;
}

function StatsBar({ state }: { state: LearnerState }) {
  return (
    <div className="stats" aria-label={`经验 ${state.xp}，连续学习 ${state.streak} 天`}>
      <div className="stat xp"><span className="ic">◆</span>{state.xp}</div>
      <div className="stat streak"><span className="ic">🔥</span>{state.streak}</div>
    </div>
  );
}

function HeartRow({ n, popped }: { n: number; popped: boolean }) {
  return (
    <div className="hearts" aria-label={`剩余爱心 ${n}/${MAX_HEARTS}`}>
      {Array.from({ length: MAX_HEARTS }, (_, i) => (
        <span key={i} className={"ht " + (i < n ? "full" : popped && i === n ? "empty pop" : "empty")}>♥</span>
      ))}
    </div>
  );
}

function Nav({ tab, onTab }: { tab: Tab; onTab: (tab: Tab) => void }) {
  const items: Array<{ id: Tab; label: string; aria: string }> = [
    { id: "learn", label: "学习", aria: "学习路径" },
    { id: "practice", label: "复习", aria: "复习练习" },
    { id: "glossary", label: "词汇", aria: "词汇表" },
    { id: "settings", label: "设置", aria: "设置" }
  ];
  return (
    <nav className="nav" aria-label="主导航">
      {items.map((item) => (
        <button key={item.id} className={tab === item.id ? "on" : ""} aria-label={item.aria} onClick={() => onTab(item.id)}>
          <span dangerouslySetInnerHTML={{ __html: NAV_ICONS[item.id] }} />
          {item.label}
        </button>
      ))}
    </nav>
  );
}

function Confetti() {
  const [bits, setBits] = useState<CSSProperties[]>([]);
  useEffect(() => {
    const colors = ["#58CC02", "#FFC800", "#1CB0F6", "#FF4B4B", "#89E219", "#7DD3FC"];
    setBits(Array.from({ length: 40 }, (_, i) => ({
      background: colors[i % colors.length],
      width: `${8 + Math.random() * 10}px`,
      height: `${10 + Math.random() * 14}px`,
      left: `${36 + Math.random() * 28}%`,
      top: "26%",
      "--x": `${Math.random() * 260 - 130}px`,
      "--r": `${Math.random() * 420}deg`
    }) as CSSProperties));
    const timer = setTimeout(() => setBits([]), 1200);
    return () => clearTimeout(timer);
  }, []);
  return <>{bits.map((style, i) => <i key={i} className="bit" style={style} />)}</>;
}

function App() {
  const [state, setState] = useState<LearnerState>(emptyLearnerState());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("learn");
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
      markSeen(realTermIds(first));
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

  const submit = (value: string | boolean) => {
    if (!session || phase !== "question") return;
    const result = applyAnswer(course, state, session, value, environment, { heartsAfter: hearts - 1 });
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
      markSeen(realTermIds(next));
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
    else if (outcome.judged === false) submit(false); // first wrong pairing judges the whole prompt
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
      alert("学习数据已导入。");
    } catch (error) {
      alert(error instanceof Error ? error.message : "导入失败。");
    } finally {
      event.target.value = "";
    }
  };

  if (!ready) return <main className="loading">正在准备离线学习空间…</main>;

  if (session && phase === "complete" && summary) {
    return <CompleteScreen summary={summary} isPractice={session.mode === "practice"} lessonId={session.lessonId} onStart={beginLesson} onPractice={beginPractice} onPath={closeLesson} />;
  }
  if (session && phase === "fail") {
    return <FailScreen isPractice={session.mode === "practice"} lessonId={session.lessonId} onRetryLesson={beginLesson} onRetryPractice={() => beginPractice()} onPath={closeLesson} />;
  }
  if (session && (phase === "teach" || phase === "question" || phase === "feedback")) {
    const activeLesson = course.lessons.find((item) => item.id === session.lessonId);
    return (
      <LessonScreen
        lessonTitle={session.mode === "practice" ? "今日复习" : activeLesson?.title ?? "课程"}
        phase={phase}
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
      {updateReady && <button className="update" onClick={() => window.location.reload()}>新版本已准备好，完成当前学习后点击更新</button>}

      {tab === "learn" && <LearnHome state={state} missedCount={missedCount} onStart={beginLesson} />}
      {tab === "practice" && <PracticeHome missedCount={missedCount} onStart={() => beginPractice()} />}
      {tab === "glossary" && <Glossary state={state} query={glossaryQuery} onQuery={setGlossaryQuery} />}
      {tab === "settings" && <Settings onExport={downloadExport} onImport={onImport} />}

      <Nav tab={tab} onTab={setTab} />
    </main>
  );
}

function LearnHome({ state, missedCount, onStart }: { state: LearnerState; missedCount: number; onStart: (id: string) => void }) {
  const upNext = course.lessons.find((lesson) => !state.completedLessonIds.includes(lesson.id) && isLessonUnlocked(state, course, lesson.id));
  return (
    <>
      <header className="top">
        <div className="brand">Kachi</div>
        <StatsBar state={state} />
      </header>
      <p className="tagline">读懂财经英语，先分清容易混淆的词。五分钟，没有投资建议。</p>
      <div className="scroll">
        {course.units.map((unit) => (
          <section key={unit.id}>
            <div className={`unit-banner u${unit.id}`}>
              <div className="kicker">单元 {unit.id}</div>
              <h2>{unit.title}</h2>
              <p>{unit.blurb}</p>
            </div>
            <div className="path">
              {course.lessons.filter((lesson) => lesson.unit === unit.id).map((lesson, index) => {
                const done = state.completedLessonIds.includes(lesson.id);
                const unlocked = isLessonUnlocked(state, course, lesson.id);
                const isNext = upNext?.id === lesson.id;
                const cls = "node" + (lesson.review ? " review" : "") + (done ? " done" : isNext ? " next" : unlocked ? "" : " locked");
                return (
                  <div className="node-wrap" key={lesson.id} style={{ transform: `translateX(${SNAKE[index % SNAKE.length]}px)` }}>
                    <button className={cls} aria-label={lesson.title} onClick={() => unlocked && onStart(lesson.id)}>
                      {!unlocked ? <span className="lock">🔒</span> : done ? "✓" : lesson.review ? "★" : lesson.icon || index + 1}
                    </button>
                    <div className="node-label">{isNext ? "接下来 · " : ""}{lesson.title}</div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
        {missedCount > 0 && <p className="unit-note">有 {missedCount} 个术语等着复习——它们在「复习」页。</p>}
        <p className="unit-note">第 1–2 单元是正在进行的对话；3–5 单元在路径上等你。</p>
      </div>
    </>
  );
}

function PracticeHome({ missedCount, onStart }: { missedCount: number; onStart: () => void }) {
  return (
    <>
      <header className="top">
        <div className="brand">今日复习</div>
      </header>
      <div className="prac-hero">
        <Hedgehog />
        <h1>练掉混淆。</h1>
        {missedCount > 0
          ? <p className="sub">你有 {missedCount} 个术语最近答错过。复习不会解锁路径。</p>
          : <p className="sub">还没有错题。先用第 1 单元练手。复习不会解锁路径。</p>}
        <button className="btn btn-gold" onClick={onStart}>开始 {PRACTICE_ROUND} 题复习</button>
      </div>
    </>
  );
}

function Glossary({ state, query, onQuery }: { state: LearnerState; query: string; onQuery: (value: string) => void }) {
  const q = query.trim().toLowerCase();
  const matches = (concept: Concept) =>
    !q || `${concept.term} ${concept.definition} ${concept.mixUp} ${localizedTerm(concept.id).termZh} ${localizedTerm(concept.id).definitionZh}`.toLowerCase().includes(q);
  let total = 0;
  return (
    <>
      <header className="top">
        <div className="brand">词汇表</div>
        <StatsBar state={state} />
      </header>
      <div className="g-search">
        <input type="search" placeholder="搜索术语，如 hedge、put" value={query} onChange={(event) => onQuery(event.target.value)} autoComplete="off" aria-label="搜索术语" />
      </div>
      <div className="g-list">
        {course.units.map((unit) => {
          const terms = course.concepts.filter((concept) => concept.unit === unit.id && matches(concept));
          if (!terms.length) return null;
          total += terms.length;
          return (
            <section key={unit.id}>
              <div className={`unit-banner mini u${unit.id}`}>
                <div className="kicker">单元 {unit.id}</div>
                <h2>{unit.title}</h2>
              </div>
              {terms.map((concept) => {
                const zh = localizedTerm(concept.id);
                const seen = state.seenConceptIds.includes(concept.id);
                return (
                  <article className="g-card" key={concept.id}>
                    <h3>{concept.term}<span className="zh">{zh.termZh}</span>{seen && <span className="seen" title="已在课程中见过">✓</span>}</h3>
                    <p className="def">{zh.definitionZh}</p>
                    <p className="def-en">{concept.definition}</p>
                    <p className="ex">e.g. {concept.example}</p>
                    <p className="mu">混淆：<strong>{concept.mixUp}</strong> — {zh.mixUpWhyZh}</p>
                  </article>
                );
              })}
            </section>
          );
        })}
        {total === 0 && <div className="g-empty">没有匹配「{query.trim()}」的术语。<br />试试 hedge、put、swap、margin call。</div>}
      </div>
      <p className="fine">不构成投资建议。只讲词语，不作推荐。</p>
    </>
  );
}

function Settings({ onExport, onImport }: { onExport: () => void; onImport: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return (
    <>
      <header className="top">
        <div className="brand">设置</div>
      </header>
      <div className="prac-hero">
        <h1>数据归你。</h1>
        <p className="sub">学习记录只保存在这台设备的浏览器里：没有账号、没有广告、没有第三方分析。可随时导出成文件，或导入到其他设备。</p>
        <button className="btn btn-green" onClick={onExport}>导出学习数据</button>
        <label className="file-button">导入学习数据<input type="file" accept="application/json" onChange={onImport} /></label>
        <p className="fine">课程以 Git 内容包发布；涉及税务、法规与金融工具的条目会标注适用范围与复核状态。</p>
      </div>
    </>
  );
}

function LessonScreen(props: {
  lessonTitle: string;
  phase: Phase;
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
  const { phase, presented } = props;
  if (phase === "teach") {
    const recap = props.teachMode === "recap";
    const termId = props.teachTerms[props.teachIndex];
    const last = recap || props.teachIndex >= props.teachTerms.length - 1;
    return (
      <main className="lesson">
        <div className="l-top">
          <button className="xbtn" aria-label="退出课程" onClick={props.onClose}>×</button>
          <div className="learn-tag">学习</div>
          {!recap && (
            <div className="pips dim">
              {props.teachTerms.map((_, index) => (
                <div key={index} className={"pip" + (index < props.teachIndex ? " on" : index === props.teachIndex ? " now" : "")} />
              ))}
            </div>
          )}
        </div>
        <div className="prompt teach">
          {recap ? <RecapCard terms={props.teachTerms} /> : termId && <TeachCard termId={termId} />}
        </div>
        <div className="foot">
          <button className="btn btn-gold" onClick={props.onTeachContinue}>{recap ? "该你了" : last ? "开始练习" : "继续"}</button>
        </div>
      </main>
    );
  }

  return (
    <main className="lesson">
      <div className="l-top">
        <button className="xbtn" aria-label="退出课程" onClick={props.onClose}>×</button>
        <div className="pips">
          {Array.from({ length: props.total }, (_, index) => (
            <div key={index} className={"pip" + (index < props.questionIndex ? " on" : index === props.questionIndex ? " now" : "")} />
          ))}
        </div>
        <HeartRow n={props.hearts} popped={phase === "feedback" && !props.lastCorrect} />
      </div>
      <div className="prompt">{presented && <PromptBody presented={presented} selection={props.selection} locked={phase === "feedback"} selL={props.selL} selR={props.selR} lockedIds={props.locked} onPick={props.onPick} onMatch={props.onMatch} />}</div>
      {phase === "question" && presented?.type !== "match" && (
        <div className="foot">
          <button className="btn btn-gold" disabled={props.selection === null} onClick={props.onSubmit}>检查</button>
        </div>
      )}
      {phase === "feedback" && presented && (
        <div className={"sheet " + (props.lastCorrect ? "ok" : "no")} role="status">
          <h3>{pick(props.lastCorrect ? NICE : NOPE)}</h3>
          <p>{presented.why}</p>
          {zhMixHint(presented) && <p className="why-zh">{zhMixHint(presented)}</p>}
          <button className={"btn " + (props.lastCorrect ? "btn-green" : "btn-red")} onClick={props.onContinue}>继续</button>
        </div>
      )}
    </main>
  );
}

function TeachCard({ termId }: { termId: string }) {
  const concept = conceptById(termId);
  if (!concept) return null;
  const zh = localizedTerm(termId);
  const sibling = conceptById(concept.mixUp);
  return (
    <>
      <div className="kicker2">新术语 · {zh.termZh}</div>
      <div className="teach-art"><TermArt id={concept.id} size="hero" /></div>
      {concept.caption && <p className="teach-cap">{concept.caption}</p>}
      <div className="teach-term">{concept.term}</div>
      <p className="teach-def">{zh.definitionZh}</p>
      <p className="teach-def-en">{concept.definition}</p>
      <div className="teach-ex">{concept.example}</div>
      <div className="teach-mix">
        <TermArt id={sibling ? sibling.id : concept.mixUp} size="xs" />
        <div><strong>别混淆</strong>：{concept.mixUp}。{zh.mixUpWhyZh}</div>
      </div>
    </>
  );
}

function RecapCard({ terms }: { terms: string[] }) {
  return (
    <>
      <div className="kicker2">单元回顾</div>
      <div className="stem" style={{ textAlign: "center", marginBottom: 12 }}>这些词又见面了。</div>
      <div className="recap-strip">
        {terms.map((id) => {
          const concept = conceptById(id);
          if (!concept) return null;
          return <div className="recap-item" key={id}><TermArt id={id} size="sm" /><span>{concept.term}</span></div>;
        })}
      </div>
      <p className="teach-def" style={{ marginTop: 16 }}>本单元的简短练习，没有新词。</p>
    </>
  );
}

function PromptBody(props: {
  presented: PresentedExercise;
  selection: string | boolean | null;
  locked: boolean;
  selL: string | null;
  selR: string | null;
  lockedIds: string[];
  onPick: (value: string | boolean) => void;
  onMatch: (side: "left" | "right", id: string) => void;
}) {
  const { presented, selection, locked } = props;
  return (
    <>
      <div className="kicker2">{KICKERS[presented.type]}</div>
      {presented.type === "scenario" && presented.story && <div className="story">{presented.story}</div>}
      {presented.type === "fill" && presented.story ? <FillStory presented={presented} selection={selection} /> : presented.stem && <div className="stem">{presented.stem}</div>}

      {(presented.type === "meaning" || presented.type === "scenario") && (
        <div className="opts">
          {presented.options?.map((option, index) => {
            let cls = "opt tile";
            if (option.text.length > 42) cls += " longcap";
            if (selection === option.text) cls += " sel";
            if (locked) {
              if (option.text === presented.correctText) cls += " good";
              else if (selection === option.text) cls += " bad";
            }
            return (
              <button key={option.text} className={cls} disabled={locked} onClick={() => props.onPick(option.text)}>
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
              <button key={String(value)} className={cls} disabled={locked} onClick={() => props.onPick(value)}>
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
              <button key={word} className={cls} disabled={locked} onClick={() => props.onPick(word)}>
                <TermArt id={artIdForLabel(word)} size="sm" />
                <span>{word}</span>
              </button>
            );
          })}
        </div>
      )}

      {presented.type === "match" && (
        <>
          <div className="stem">先点术语，再点解释。</div>
          <div className="match">
            <div>
              {presented.left.map((chip) => (
                <MatchChip key={chip.id} chip={chip} side="left" lockedIds={props.lockedIds} selected={props.selL === chip.id} disabled={locked} onMatch={props.onMatch} />
              ))}
            </div>
            <div>
              {presented.right.map((chip) => (
                <MatchChip key={chip.id} chip={chip} side="right" lockedIds={props.lockedIds} selected={props.selR === chip.id} disabled={locked} onMatch={props.onMatch} />
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}

function FillStory({ presented, selection }: { presented: PresentedExercise; selection: string | boolean | null }) {
  const filled = typeof selection === "string" ? selection : "";
  const story = presented.story ?? "";
  const blank = <span className="blank">{filled || " "}</span>;
  const parts = story.split("____");
  return (
    <div className="story">
      {parts.length > 1
        ? <>{parts[0]}{blank}{parts.slice(1).join("____")}</>
        : <>{story} {blank}</>}
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
  const cls = "mchip" + (isLocked ? " good" : props.selected ? " sel" : "");
  return (
    <button
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
  onStart: (id: string) => void;
  onPractice: (focus?: string[]) => void;
  onPath: () => void;
}) {
  const { summary } = props;
  const acc = summary.total ? Math.round((summary.correct / summary.total) * 100) : 0;
  const lessonIndex = course.lessons.findIndex((lesson) => lesson.id === props.lessonId);
  const next = props.isPractice ? undefined : course.lessons[lessonIndex + 1];
  return (
    <main className="hero">
      <Confetti />
      <div className="mascot"><Hedgehog /></div>
      <h1>{summary.xpPerfect ? "完美。" : props.isPractice ? "这轮复习完成。" : "课程完成。"}</h1>
      <p className="sub">{acc}% 正确率 · {summary.correct}/{summary.total}</p>
      <div className="xp-card">
        {props.isPractice ? (
          <>
            <div className="xp-row"><span>答对的题</span><span>+{summary.xpHit} XP</span></div>
          </>
        ) : (
          <>
            <div className="xp-row"><span>答对的题</span><span>+{summary.xpHit} XP</span></div>
            <div className="xp-row"><span>完成课程</span><span>+{summary.xpDone} XP</span></div>
            {summary.xpPerfect > 0 && <div className="xp-row"><span>全对奖励</span><span>+{summary.xpPerfect} XP</span></div>}
          </>
        )}
        <div className="xp-row total"><span>合计</span><span>+{summary.gained} XP</span></div>
      </div>
      {summary.mix.length > 0 && (
        <>
          <p className="sub" style={{ marginBottom: 8 }}>你容易混淆</p>
          <div className="chips">
            {summary.mix.map((id) => {
              const concept = conceptById(id);
              if (!concept) return null;
              return <span className="chip" key={id}>{concept.term} vs {concept.mixUp}</span>;
            })}
          </div>
        </>
      )}
      {props.isPractice ? (
        <>
          <button className="btn btn-gold" onClick={() => props.onPractice()}>再来一轮</button>
          <button className="btn btn-ghost" onClick={props.onPath}>回到路径</button>
        </>
      ) : next ? (
        <>
          <button className="btn btn-gold" onClick={() => props.onStart(next.id)}>下一课：{next.title}</button>
          {summary.mix.length > 0 && <button className="btn btn-green" onClick={() => props.onPractice(summary.mix)}>练一练这些</button>}
          <button className="btn btn-ghost" onClick={props.onPath}>回到路径</button>
        </>
      ) : (
        <>
          {summary.mix.length > 0 && <button className="btn btn-green" onClick={() => props.onPractice(summary.mix)}>练一练这些</button>}
          <button className="btn btn-ghost" onClick={props.onPath}>回到路径</button>
        </>
      )}
    </main>
  );
}

function FailScreen(props: {
  isPractice: boolean;
  lessonId: string;
  onRetryLesson: (id: string) => void;
  onRetryPractice: () => void;
  onPath: () => void;
}) {
  return (
    <main className="hero">
      <div className="mascot">💔</div>
      <h1>爱心用完了。</h1>
      <p className="sub">这一课的混淆坑了你。重试——爱心立刻补满，不用等。</p>
      {props.isPractice
        ? <button className="btn btn-gold" onClick={props.onRetryPractice}>再来一轮</button>
        : <button className="btn btn-gold" onClick={() => props.onRetryLesson(props.lessonId)}>重试本课</button>}
      <button className="btn btn-ghost" onClick={props.onPath}>回到路径</button>
    </main>
  );
}

export default App;
