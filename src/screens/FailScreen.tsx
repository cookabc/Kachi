import type { UiText } from "../ui";

export function FailScreen(props: {
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
