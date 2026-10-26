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
  const firstLesson = course.lessons[0];
  const activeLesson = upNext ?? firstLesson;
  const completed = state.completedLessonIds.length;
  const total = course.lessons.length;
  // The hero names the course's first confusion pair. Hardcoding HEDGE/PLEDGE
  // meant every pack advertised the legacy course's opening pair.
  const openingPair = (() => {
    const first = course.concepts[0];
    if (!first) return null;
    const twin = course.concepts.find((concept) => concept.id === first.mixUp);
    return { left: first.term.toUpperCase(), right: (twin?.term ?? first.mixUp).toUpperCase() };
  })();
  const heroUnit = course.units[0];

  return (
    <>
      <header className="top lab-top">
        <div className="brand">
          Kachi<span aria-hidden="true">✳</span>
        </div>
        <StatsBar state={state} />
      </header>
      <div className="scroll lab-scroll">
        <section className="lab-hero" aria-labelledby="lab-course-title">
          <div className="lab-hero-meta">
            <span>{isZh ? "概念对照实验室" : "THE CONTRAST LAB"}</span>
            <span>COURSE / 01</span>
          </div>
          <p className="lab-overline">
            {isZh ? `第一组：${heroUnit?.blurb ?? ""}` : `PAIR 01 / ${(heroUnit?.blurb ?? "").toUpperCase()}`}
          </p>
          <h1 id="lab-course-title" className="lab-hero-title">
            {openingPair?.left} <span aria-hidden="true">/</span>
            <br />
            {openingPair?.right}
            <span className="lab-period">.</span>
          </h1>
          <p className="lab-hero-copy">{t.home.tagline}</p>
          <div className="lab-hero-progress">
            <div>
              <span>{isZh ? "课程进度" : "YOUR PROGRESS"}</span>
              <strong>
                {String(completed).padStart(2, "0")} <i>/</i> {String(total).padStart(2, "0")}
              </strong>
            </div>
            <div
              className="lab-progress-track"
              role="progressbar"
              aria-valuenow={completed}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-label={isZh ? "课程进度" : "Course progress"}
            >
              <span style={{ width: `${total ? (completed / total) * 100 : 0}%` }} />
            </div>
          </div>
          {activeLesson && (
            <button type="button" className="lab-hero-cta" onClick={() => onStart(activeLesson.id)}>
              <span>
                {isZh ? (upNext ? "继续学习" : "重新学习") : upNext ? "Continue learning" : "Study again"}
              </span>
              <span aria-hidden="true">↗</span>
            </button>
          )}
        </section>

        <section className="lab-curriculum" aria-labelledby="lab-curriculum-title">
          <div className="lab-section-head">
            <div>
              <span>FIELD NOTES / 01—{String(course.units.length).padStart(2, "0")}</span>
              <h2 id="lab-curriculum-title">{isZh ? "学习路径" : "Learning path"}</h2>
            </div>
            <span>
              {course.concepts.length} {isZh ? "个概念" : "concepts"}
            </span>
          </div>

          {course.units.map((unit) => {
            const lessons = course.lessons.filter((lesson) => lesson.unit === unit.id);
            const doneCount = lessons.filter((lesson) => state.completedLessonIds.includes(lesson.id)).length;
            const currentUnit = lessons.some((lesson) => lesson.id === upNext?.id);
            return (
              <section key={unit.id} className={`lab-unit${currentUnit ? " lab-unit-current" : ""}`}>
                <div className="lab-unit-head">
                  <div className="lab-unit-number">{String(unit.id).padStart(2, "0")}</div>
                  <div className="lab-unit-heading">
                    <span>
                      {t.home.unit(unit.id)} / {doneCount}—{lessons.length}
                    </span>
                    <h3>{unit.title}</h3>
                    <p>{unit.blurb}</p>
                  </div>
                </div>
                <ol className="lab-lessons">
                  {lessons.map((lesson, index) => {
                    const done = state.completedLessonIds.includes(lesson.id);
                    const unlocked = isLessonUnlocked(state, course, lesson.id);
                    const isNext = upNext?.id === lesson.id;
                    return (
                      <li key={lesson.id}>
                        <button
                          type="button"
                          className={`lab-lesson${done ? " is-done" : ""}${isNext ? " is-next" : ""}`}
                          aria-label={unlocked ? lesson.title : t.home.lockedLesson(lesson.title)}
                          disabled={!unlocked}
                          onClick={() => onStart(lesson.id)}
                        >
                          <span className="lab-lesson-index">{String(index + 1).padStart(2, "0")}</span>
                          <span className="lab-lesson-name">{lesson.title}</span>
                          <span className="lab-lesson-status" aria-hidden="true">
                            {done ? (
                              "✓"
                            ) : isNext ? (
                              "↗"
                            ) : unlocked ? (
                              "→"
                            ) : (
                              /* 未解锁的课用一个锁，不是中间点 —— 中间点读起来像半个标点，
                                 而且这一行已经有 aria-label 说了"未解锁"。
                                 锁形本身在 26px 的圆里比一个字更清楚。 */
                              <svg
                                className="lab-lock"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.4"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                aria-hidden="true"
                                focusable="false"
                              >
                                <rect x="5" y="11" width="14" height="9" rx="2" />
                                <path d="M8 11V8a4 4 0 0 1 8 0v3" />
                              </svg>
                            )}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            );
          })}
          {missedCount > 0 && <p className="lab-note">{t.home.missedNote(missedCount)}</p>}
          <p className="lab-note">{t.home.unitNote}</p>
        </section>
      </div>
    </>
  );
}
