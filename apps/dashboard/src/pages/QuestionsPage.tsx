import { QuestionQueue } from "../components/QuestionQueue";
import { uiText } from "../i18n";

export function QuestionsPage({ snapshot }: { snapshot: any }) {
  const t = uiText.questionsPage;

  return (
    <>
      <header className="page-header compact">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{t.description}</p>
        </div>
      </header>
      <QuestionQueue questions={snapshot.questions ?? []} />
    </>
  );
}
