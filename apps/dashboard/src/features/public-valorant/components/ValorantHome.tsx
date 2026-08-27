import { valorantI18n, type ValorantLocale } from "../i18n/valorant-i18n";

/* 발로란트 공개 홈 — 준비 단계의 정직한 소개 화면.
 *
 * 데이터 화면(요원·무기·맵·랭킹)은 /api/valorant/* contract 와 Riot 프로덕션
 * 승인이 준비되기 전이라, 여기서는 실제로 확정된 사실만 보여줍니다:
 * 전적 3단 모델(스트리머 opt-in · 내 전적 · 리더보드)과 RSO 정책 경계.
 * 가짜 표본 데이터·동작하지 않는 CTA 는 두지 않습니다(AI_WORKFLOW §2.6).
 * 근거: docs/mockups/valorant-page-design.html §02·§05
 */
export function ValorantHome({ locale }: { locale: ValorantLocale }) {
  const text = valorantI18n[locale];
  const models = [
    { key: "streamer", badge: text.modelStreamerBadge, title: text.modelStreamerTitle, description: text.modelStreamerDescription },
    { key: "mine", badge: text.modelMineBadge, title: text.modelMineTitle, description: text.modelMineDescription },
    { key: "leaderboard", badge: text.modelLeaderboardBadge, title: text.modelLeaderboardTitle, description: text.modelLeaderboardDescription },
  ] as const;

  return (
    <div className="valorant-home">
      <section aria-labelledby="valorant-hero-title" className="valorant-hero">
        <span aria-hidden="true" className="valorant-hero__kicker">{text.heroKicker}</span>
        <h1
          className="valorant-hero__title"
          data-ja={valorantI18n.ja.heroTitle}
          data-ko={valorantI18n.ko.heroTitle}
          id="valorant-hero-title"
        >
          {text.heroTitle}
        </h1>
        <p data-ja={valorantI18n.ja.heroDescription} data-ko={valorantI18n.ko.heroDescription}>
          {text.heroDescription}
        </p>
        <span
          className="valorant-hero__status"
          data-ja={valorantI18n.ja.heroStatus}
          data-ko={valorantI18n.ko.heroStatus}
        >
          {text.heroStatus}
        </span>
      </section>

      <section aria-labelledby="valorant-model-title" className="valorant-models">
        <h2 data-ja={valorantI18n.ja.modelTitle} data-ko={valorantI18n.ko.modelTitle} id="valorant-model-title">
          {text.modelTitle}
        </h2>
        <div className="valorant-models__grid">
          {models.map((model) => (
            <article className="valorant-model-card" key={model.key}>
              {/* 세 모델은 병렬 제공 방식이라 순번 대신 접근 조건을 라벨로 보여줍니다. */}
              <span className="valorant-model-card__badge">{model.badge}</span>
              <h3>{model.title}</h3>
              <p>{model.description}</p>
            </article>
          ))}
        </div>
        <p className="valorant-policy-note" data-ja={valorantI18n.ja.policyNote} data-ko={valorantI18n.ko.policyNote}>
          {text.policyNote}
        </p>
      </section>

      {/* 준비 단계의 빈 화면을 확정 사실 기반 FAQ 로 채웁니다 — 가짜 데이터·일정 약속 금지 */}
      <section aria-labelledby="valorant-faq-title" className="valorant-faq">
        <h2 data-ja={valorantI18n.ja.faqTitle} data-ko={valorantI18n.ko.faqTitle} id="valorant-faq-title">
          {text.faqTitle}
        </h2>
        {([
          { key: "release", question: text.faqReleaseQuestion, answer: text.faqReleaseAnswer },
          { key: "search", question: text.faqSearchQuestion, answer: text.faqSearchAnswer },
          { key: "privacy", question: text.faqPrivacyQuestion, answer: text.faqPrivacyAnswer },
        ] as const).map((entry) => (
          <details className="valorant-faq__item" key={entry.key}>
            <summary>{entry.question}</summary>
            <p>{entry.answer}</p>
          </details>
        ))}
      </section>
    </div>
  );
}
