import { useState } from "react";
import { StatsBar } from "../chrome";
import type { Course, LearnerState } from "../domain";
import { isLessonUnlocked } from "../engine";
import type { UiText } from "../ui";

export function LearnHome({
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
  const isZh = course.locale.startsWith("zh");
  const upNext = course.lessons.find(
    (lesson) => !state.completedLessonIds.includes(lesson.id) && isLessonUnlocked(state, course, lesson.id),
  );
  const activeLesson = upNext ?? course.lessons[0];
  const completed = state.completedLessonIds.length;
  const total = course.lessons.length;
  const [answer, setAnswer] = useState<string | null>(null);
  const hedge = course.concepts.find((concept) => concept.id === "hedge");
  const pledge = course.concepts.find((concept) => concept.id === "pledge");
  return (
    <>
      <header className="top learning-top">
        <div className="brand">Kachi</div>
        <span className="learning-topic">{isZh ? "财经英语" : "Finance English"}</span>
        <StatsBar state={state} />
      </header>
      <div className="scroll learning-scroll">
        <div className="learning-layout">
          <section className="learning-start" aria-labelledby="learning-title">
            <h1 id="learning-title">{isZh ? "相近的词，不同的意思。" : "Similar words. Different moves."}</h1>
            {hedge && pledge && (
              <div className="learning-question">
                <h2>{isZh ? "这属于哪一种？" : "Which word fits?"}</h2>
                <p className="learning-example">
                  {isZh
                    ? "持有股票并买入看跌期权，以降低价格下跌带来的损失。"
                    : "Buying a put option to limit the downside on shares you already own."}
                </p>
                <fieldset className="learning-choices" aria-label={isZh ? "选择概念" : "Choose a concept"}>
                  {[hedge, pledge].map((concept) => (
                    <button
                      key={concept.id}
                      type="button"
                      aria-pressed={answer === concept.id}
                      className={
                        answer === concept.id ? (concept.id === hedge.id ? "is-correct" : "is-wrong") : ""
                      }
                      onClick={() => setAnswer(concept.id)}
                    >
                      {concept.term}
                      <span aria-hidden="true">
                        {answer === concept.id ? (concept.id === hedge.id ? "✓" : "×") : "→"}
                      </span>
                    </button>
                  ))}
                </fieldset>
                <div className="learning-feedback" role="status">
                  {answer && (
                    <>
                      <strong>
                        {answer === hedge.id
                          ? isZh
                            ? "正确"
                            : "Correct"
                          : isZh
                            ? "这里应选 Hedge"
                            : "This is a hedge"}
                      </strong>
                      <p>{hedge.mixUpWhy}</p>
                    </>
                  )}
                </div>
              </div>
            )}
            <div className="learning-continue">
              <div className="learning-progress-label">
                <span>{isZh ? "课程进度" : "Course progress"}</span>
                <span>
                  {completed} / {total}
                </span>
              </div>
              <progress max={total} value={completed} aria-label={isZh ? "课程进度" : "Course progress"} />
              {activeLesson && (
                <button
                  type="button"
                  className="learning-start-button"
                  onClick={() => onStart(activeLesson.id)}
                >
                  <span>
                    {upNext
                      ? completed
                        ? isZh
                          ? "继续学习"
                          : "Continue learning"
                        : isZh
                          ? "开始第一课"
                          : "Start the first lesson"
                      : isZh
                        ? "重新学习"
                        : "Study again"}
                  </span>
                  <span aria-hidden="true">→</span>
                </button>
              )}
              {activeLesson && <p>{activeLesson.title}</p>}
            </div>
          </section>
          <section className="learning-path" aria-labelledby="learning-path-title">
            <div className="learning-path-heading">
              <h2 id="learning-path-title">{isZh ? "学习路径" : "Learning path"}</h2>
              <span>
                {course.concepts.length} {isZh ? "个概念" : "concepts"}
              </span>
            </div>
            {course.units.map((unit) => {
              const lessons = course.lessons.filter((lesson) => lesson.unit === unit.id);
              const doneCount = lessons.filter((lesson) =>
                state.completedLessonIds.includes(lesson.id),
              ).length;
              const current = lessons.some((lesson) => lesson.id === activeLesson?.id);
              return (
                <details key={unit.id} className="learning-unit" open={current}>
                  <summary>
                    <span className="learning-unit-number">{String(unit.id).padStart(2, "0")}</span>
                    <h3>{unit.title}</h3>
                    <span>
                      {doneCount}/{lessons.length}
                    </span>
                  </summary>
                  <ol>
                    {lessons.map((lesson, index) => {
                      const done = state.completedLessonIds.includes(lesson.id);
                      const unlocked = isLessonUnlocked(state, course, lesson.id);
                      return (
                        <li key={lesson.id}>
                          <button
                            type="button"
                            className={lesson.id === upNext?.id ? "is-next" : ""}
                            disabled={!unlocked}
                            aria-label={unlocked ? lesson.title : t.home.lockedLesson(lesson.title)}
                            onClick={() => onStart(lesson.id)}
                          >
                            <span className="learning-lesson-number">{index + 1}</span>
                            <span>{lesson.title}</span>
                            <span className="learning-lesson-state">
                              {done
                                ? isZh
                                  ? "已完成"
                                  : "Done"
                                : !unlocked
                                  ? isZh
                                    ? "未解锁"
                                    : "Locked"
                                  : "→"}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                  </ol>
                </details>
              );
            })}
            {missedCount > 0 && <p className="learning-missed">{t.home.missedNote(missedCount)}</p>}
          </section>
        </div>
      </div>
    </>
  );
}
