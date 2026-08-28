import { ChangeEvent, useEffect, useMemo, useState } from "react";
import type { AttemptEvent, Exercise, LearnerState, SessionState } from "@kachi/domain";
import {
  applyAnswer,
  currentExercise,
  duePairIds,
  emptyLearnerState,
  isLessonUnlocked,
  startPracticeSession,
  startSession
} from "@kachi/learning-engine";
import { course } from "./course";
import { localizedTerm } from "./localization";
import { exportLearnerData, importLearnerData, loadLearnerState, saveLearnerState } from "./storage";

type Tab = "learn" | "practice" | "glossary" | "settings";
type LessonPhase = "teach" | "question" | "feedback" | "complete";

const deviceId = crypto.randomUUID();
let eventCounter = 0;
const environment = {
  now: () => new Date(),
  random: () => Math.random(),
  deviceId,
  eventId: () => `${deviceId}-${Date.now()}-${++eventCounter}`
};

function uniqueTermIds(lessonId: string): string[] {
  const lesson = course.lessons.find((item) => item.id === lessonId);
  if (!lesson) return [];
  return Array.from(new Set(lesson.prompts.map((prompt) => prompt.termId).filter(Boolean))) as string[];
}

function displayPromptTitle(prompt: Exercise): string {
  return {
    meaning: "词义辨析",
    truefalse: "判断正误",
    fill: "补全句子",
    scenario: "真实情境",
    match: "配对练习"
  }[prompt.type];
}

function App() {
  const [state, setState] = useState<LearnerState>(emptyLearnerState());
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<Tab>("learn");
  const [session, setSession] = useState<SessionState | null>(null);
  const [phase, setPhase] = useState<LessonPhase>("teach");
  const [teachIndex, setTeachIndex] = useState(0);
  const [answer, setAnswer] = useState<string | boolean | null>(null);
  const [feedback, setFeedback] = useState<AttemptEvent | null>(null);
  const [feedbackPrompt, setFeedbackPrompt] = useState<Exercise | null>(null);
  const [glossaryQuery, setGlossaryQuery] = useState("");
  const [matchLeft, setMatchLeft] = useState<string | null>(null);
  const [matchedIds, setMatchedIds] = useState<string[]>([]);
  const [matchNotice, setMatchNotice] = useState("");
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

  const current = session ? currentExercise(course, session) : undefined;
  const activeLesson = session?.mode === "lesson" ? course.lessons.find((item) => item.id === session.lessonId) : undefined;
  const teachingTerms = activeLesson ? uniqueTermIds(activeLesson.id) : [];
  const dueCount = duePairIds(state, new Date()).length;

  const persist = (next: LearnerState) => {
    setState(next);
    void saveLearnerState(next);
  };

  const beginLesson = (lessonId: string) => {
    if (!isLessonUnlocked(state, course, lessonId)) return;
    setSession(startSession(course, lessonId, environment));
    setTeachIndex(0);
    setPhase("teach");
    setAnswer(null);
    setFeedback(null);
    setFeedbackPrompt(null);
  };

  const beginPractice = () => {
    const due = new Set(duePairIds(state, new Date()));
    const unlocked = course.lessons.filter((lesson) => isLessonUnlocked(state, course, lesson.id));
    const prompts = unlocked.flatMap((lesson) => lesson.prompts);
    const ranked = [...prompts].sort((left, right) => {
      const leftPair = course.concepts.find((concept) => concept.id === left.termId);
      const rightPair = course.concepts.find((concept) => concept.id === right.termId);
      return Number(due.has(rightPair ? [rightPair.id, rightPair.mixUp].sort().join("::") : "")) - Number(due.has(leftPair ? [leftPair.id, leftPair.mixUp].sort().join("::") : ""));
    });
    const promptIds = ranked.slice(0, 10).map((prompt) => prompt.id);
    setSession(startPracticeSession(promptIds, environment));
    setPhase("question");
    setAnswer(null);
    setFeedback(null);
    setFeedbackPrompt(null);
  };

  const submit = (value: string | boolean) => {
    if (!session || !current) return;
    const result = applyAnswer(course, state, session, value, environment);
    persist(result.state);
    setSession(result.session);
    setFeedback(result.attempt);
    setFeedbackPrompt(current);
    setPhase("feedback");
    setAnswer(null);
    setMatchLeft(null);
    setMatchedIds([]);
    setMatchNotice("");
  };

  const continueLesson = () => {
    if (!session) return;
    if (session.index >= session.promptIds.length) {
      setPhase("complete");
      return;
    }
    setPhase("question");
    setAnswer(null);
    setFeedbackPrompt(null);
  };

  const closeLesson = () => {
    setSession(null);
    setFeedback(null);
    setFeedbackPrompt(null);
    setTab("learn");
  };

  const onMatch = (side: "left" | "right", id: string) => {
    if (!current?.pairs) return;
    if (side === "left") {
      setMatchLeft(id);
      setMatchNotice("");
      return;
    }
    if (!matchLeft) {
      setMatchNotice("先选择左侧术语，再选择右侧解释。");
      return;
    }
    if (matchLeft !== id) {
      setMatchNotice("这不是同一对。看看中文提示后再试一次。错配不会终止课程。");
      setMatchLeft(null);
      return;
    }
    const next = [...matchedIds, id];
    setMatchedIds(next);
    setMatchLeft(null);
    setMatchNotice("");
    if (next.length === current.pairs.length) submit("matched");
  };

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

  const visibleConcepts = useMemo(() => course.concepts.filter((concept) => {
    const query = glossaryQuery.trim().toLowerCase();
    return !query || `${concept.term} ${concept.definition} ${concept.mixUp} ${localizedTerm(concept.id).termZh}`.toLowerCase().includes(query);
  }), [glossaryQuery]);

  if (!ready) return <main className="loading">正在准备离线学习空间…</main>;

  if (session && current) {
    return (
      <LessonScreen
        lessonTitle={session.mode === "practice" ? "今日复习" : activeLesson?.title ?? "课程"}
        prompt={phase === "feedback" && feedbackPrompt ? feedbackPrompt : current}
        phase={phase}
        termId={teachingTerms[teachIndex]}
        feedback={feedback}
        questionIndex={phase === "feedback" ? Math.max(session.index - 1, 0) : session.index}
        total={session.promptIds.length}
        answer={answer}
        matchLeft={matchLeft}
        matchedIds={matchedIds}
        matchNotice={matchNotice}
        onAnswer={setAnswer}
        onSubmit={() => answer !== null && submit(answer)}
        onMatch={onMatch}
        onTeachContinue={() => {
          if (teachIndex + 1 >= teachingTerms.length) setPhase("question");
          else setTeachIndex((value) => value + 1);
        }}
        onContinue={continueLesson}
        onClose={closeLesson}
        onPractice={beginPractice}
      />
    );
  }

  return (
    <main className="shell">
      {updateReady && <button className="update" onClick={() => window.location.reload()}>新版本已准备好，完成当前学习后可更新</button>}
      <header className="topbar">
        <div><strong>Kachi</strong><span>财经英语学习</span></div>
        <div className="stats" aria-label={`经验 ${state.xp}，连续学习 ${state.streak} 天`}><span>◆ {state.xp}</span><span>🔥 {state.streak}</span></div>
      </header>

      {tab === "learn" && <LearnHome state={state} dueCount={dueCount} onStart={beginLesson} onPractice={beginPractice} />}
      {tab === "practice" && <PracticeHome dueCount={dueCount} onStart={beginPractice} />}
      {tab === "glossary" && <Glossary concepts={visibleConcepts} query={glossaryQuery} onQuery={setGlossaryQuery} state={state} />}
      {tab === "settings" && <Settings onExport={downloadExport} onImport={onImport} />}

      <nav aria-label="主导航">
        <button className={tab === "learn" ? "active" : ""} onClick={() => setTab("learn")}>学习</button>
        <button className={tab === "practice" ? "active" : ""} onClick={() => setTab("practice")}>复习</button>
        <button className={tab === "glossary" ? "active" : ""} onClick={() => setTab("glossary")}>词汇</button>
        <button className={tab === "settings" ? "active" : ""} onClick={() => setTab("settings")}>设置</button>
      </nav>
    </main>
  );
}

function LearnHome({ state, dueCount, onStart, onPractice }: { state: LearnerState; dueCount: number; onStart: (id: string) => void; onPractice: () => void }) {
  return <section className="scroll"><div className="hero-copy"><p className="eyebrow">Hedge or Pledge</p><h1>读懂财经英语，先分清容易混淆的词。</h1><p>每次只用几分钟。你学的是新闻中的机制，不是投资建议。</p>{dueCount > 0 && <button className="primary" onClick={onPractice}>今天有 {dueCount} 个到期辨析要复习</button>}</div>{course.units.map((unit) => <section className="unit" key={unit.id}><p className="eyebrow">单元 {unit.id}</p><h2>{unit.title}</h2><p>{unit.blurb}</p><div className="lesson-list">{course.lessons.filter((lesson) => lesson.unit === unit.id).map((lesson) => { const done = state.completedLessonIds.includes(lesson.id); const unlocked = isLessonUnlocked(state, course, lesson.id); return <button key={lesson.id} className={`lesson-card ${done ? "done" : ""}`} disabled={!unlocked} onClick={() => onStart(lesson.id)}><span>{done ? "✓" : unlocked ? lesson.icon : "🔒"}</span><div><strong>{lesson.title}</strong><small>{lesson.review ? "单元回顾" : unlocked ? "开始学习" : "完成上一课后解锁"}</small></div></button>; })}</div></section>)}</section>;
}

function PracticeHome({ dueCount, onStart }: { dueCount: number; onStart: () => void }) {
  return <section className="centered"><div className="mascot">🦔</div><p className="eyebrow">今日复习</p><h1>{dueCount ? `${dueCount} 组辨析正在等待你` : "先巩固已经见过的词"}</h1><p>答错会带来解释和重现，不会耗尽爱心或中断课程。</p><button className="primary" onClick={onStart}>开始 10 题复习</button></section>;
}

function Glossary({ concepts, query, onQuery, state }: { concepts: typeof course.concepts; query: string; onQuery: (value: string) => void; state: LearnerState }) {
  return <section className="scroll glossary"><label>搜索术语<input type="search" value={query} onChange={(event) => onQuery(event.target.value)} placeholder="hedge、put、margin call" /></label>{concepts.map((concept) => { const zh = localizedTerm(concept.id); return <article className="glossary-card" key={concept.id}><div><p className="eyebrow">{zh.termZh}{state.seenConceptIds.includes(concept.id) ? " · 已学习" : ""}</p><h2>{concept.term}</h2></div><p>{zh.definitionZh}</p><p className="english">{concept.definition}</p><p className="mix">容易混淆：<strong>{concept.mixUp}</strong> · {zh.mixUpWhyZh}</p></article>; })}</section>;
}

function Settings({ onExport, onImport }: { onExport: () => void; onImport: (event: ChangeEvent<HTMLInputElement>) => void }) {
  return <section className="scroll settings"><p className="eyebrow">本地优先</p><h1>你的学习数据留在此设备。</h1><p>当前版本没有官方账号、广告或第三方分析。之后可选择连接自托管实例同步。</p><button className="secondary" onClick={onExport}>导出学习数据</button><label className="file-button">导入学习数据<input type="file" accept="application/json" onChange={onImport} /></label><hr /><h2>关于内容</h2><p>课程以 Git 内容包发布。涉及税务、法规和金融工具的条目会标注适用范围和复核状态。</p></section>;
}

function LessonScreen(props: {
  lessonTitle: string; prompt: Exercise; phase: LessonPhase; termId?: string; feedback: AttemptEvent | null; questionIndex: number; total: number; answer: string | boolean | null; matchLeft: string | null; matchedIds: string[]; matchNotice: string; onAnswer: (value: string | boolean) => void; onSubmit: () => void; onMatch: (side: "left" | "right", id: string) => void; onTeachContinue: () => void; onContinue: () => void; onClose: () => void; onPractice: () => void;
}) {
  const { lessonTitle, prompt, phase, termId, feedback, questionIndex, total, answer, matchLeft, matchedIds, matchNotice } = props;
  if (phase === "complete") {
    return <main className="lesson-shell complete"><div className="mascot">🎉</div><p className="eyebrow">已完成</p><h1>这一轮完成了。</h1><p>错误已经记入下一次复习；完成不等于掌握，间隔复测才会影响 Kachi Score。</p><button className="primary" onClick={props.onPractice}>继续复习</button><button className="secondary" onClick={props.onClose}>回到学习路径</button></main>;
  }
  if (phase === "teach" && termId) {
    const concept = course.concepts.find((item) => item.id === termId);
    if (concept) {
      const zh = localizedTerm(termId);
      return <main className="lesson-shell"><LessonHeader title={lessonTitle} index={0} total={1} onClose={props.onClose} /><section className="teach-card"><p className="eyebrow">新术语 · {zh.termZh}</p><h1>{concept.term}</h1><p className="definition-zh">{zh.definitionZh}</p><p className="english">{concept.definition}</p><div className="example">{concept.example}</div><div className="mix"><strong>别混淆：</strong>{concept.mixUp}。{zh.mixUpWhyZh}</div></section><button className="primary lesson-action" onClick={props.onTeachContinue}>继续</button></main>;
    }
  }

  return <main className="lesson-shell"><LessonHeader title={lessonTitle} index={questionIndex} total={total} onClose={props.onClose} /><section className="question-card"><p className="eyebrow">{displayPromptTitle(prompt)}</p>{prompt.story && <p className="story">{prompt.story}</p>}<h1>{prompt.stem ?? "找到正确配对"}</h1>{prompt.type === "match" ? <MatchExercise prompt={prompt} matchLeft={matchLeft} matchedIds={matchedIds} notice={matchNotice} onMatch={props.onMatch} /> : <AnswerExercise prompt={prompt} answer={answer} disabled={phase === "feedback"} onAnswer={props.onAnswer} />}</section>{phase === "question" && prompt.type !== "match" && <button className="primary lesson-action" disabled={answer === null} onClick={props.onSubmit}>检查答案</button>}{phase === "feedback" && <section className={`feedback ${feedback?.correct ? "correct" : "wrong"}`} role="status"><h2>{feedback?.correct ? "答对了。" : "先别急，这正是要分清的地方。"}</h2><p>{prompt.why}</p><button className="primary" onClick={props.onContinue}>继续</button></section>}</main>;
}

function LessonHeader({ title, index, total, onClose }: { title: string; index: number; total: number; onClose: () => void }) {
  return <header className="lesson-header"><button aria-label="退出课程" onClick={onClose}>×</button><div><strong>{title}</strong><progress value={index} max={Math.max(total, 1)} aria-label={`课程进度 ${index}/${total}`} /></div></header>;
}

function AnswerExercise({ prompt, answer, disabled, onAnswer }: { prompt: Exercise; answer: string | boolean | null; disabled: boolean; onAnswer: (value: string | boolean) => void }) {
  if (prompt.type === "truefalse") return <div className="answer-grid two"><button className={answer === true ? "selected" : ""} disabled={disabled} onClick={() => onAnswer(true)}>True</button><button className={answer === false ? "selected" : ""} disabled={disabled} onClick={() => onAnswer(false)}>False</button></div>;
  if (prompt.type === "fill") return <div className="answer-grid">{prompt.bank?.map((item) => <button key={item} className={answer === item ? "selected" : ""} disabled={disabled} onClick={() => onAnswer(item)}>{item}</button>)}</div>;
  return <div className="answer-grid">{prompt.options?.map((option) => <button key={option.text} className={answer === option.text ? "selected" : ""} disabled={disabled} onClick={() => onAnswer(option.text)}>{option.text}</button>)}</div>;
}

function MatchExercise({ prompt, matchLeft, matchedIds, notice, onMatch }: { prompt: Exercise; matchLeft: string | null; matchedIds: string[]; notice: string; onMatch: (side: "left" | "right", id: string) => void }) {
  return <div><div className="match-grid"><div>{prompt.pairs?.map((pair) => <button key={pair.id} className={`${matchLeft === pair.id ? "selected" : ""} ${matchedIds.includes(pair.id) ? "matched" : ""}`} disabled={matchedIds.includes(pair.id)} onClick={() => onMatch("left", pair.id)}>{pair.left}</button>)}</div><div>{prompt.pairs?.map((pair) => <button key={pair.id} className={matchedIds.includes(pair.id) ? "matched" : ""} disabled={matchedIds.includes(pair.id)} onClick={() => onMatch("right", pair.id)}>{pair.right}</button>)}</div></div>{notice && <p className="notice">{notice}</p>}</div>;
}

export default App;
