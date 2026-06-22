import { uiText } from "../i18n";

export function QuestionQueue({ questions }: { questions: any[] }) {
  const t = uiText.questionQueue;

  return (
    <div className="card">
      <div className="card-title-row">
        <h2>{t.title}</h2>
        <span className="count-badge">{questions.length}</span>
      </div>
      <div className="list">
        {questions.length === 0 ? <p className="muted empty-state">{t.empty}</p> : null}
        {questions.map((q) => (
          <div className="question" key={q.id}>
            <div className="muted">{q.userName} · {q.status}</div>
            <div>{q.question}</div>
            {q.translatedQuestion ? <div className="translation">{q.translatedQuestion}</div> : null}
          </div>
        ))}
      </div>
    </div>
  );
}
