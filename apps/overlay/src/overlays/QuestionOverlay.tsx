import type { QuestionShowMessage } from "@streamops/shared";

export function QuestionOverlay({ question }: { question?: QuestionShowMessage }) {
  if (!question) return null;
  return (
    <div className="question-card">
      <div className="label">시청자 질문</div>
      <div className="question-user">{question.userName}</div>
      <div className="question-text">{question.question}</div>
      {question.translatedQuestion ? <div className="question-translation">{question.translatedQuestion}</div> : null}
    </div>
  );
}
