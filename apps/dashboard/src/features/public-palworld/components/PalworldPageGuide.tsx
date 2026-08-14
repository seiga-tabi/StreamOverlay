import { palworldGuideI18n, type PalworldGuidePage } from "../i18n/palworld-guide-i18n";
import type { PalworldLocale } from "../i18n/palworld-i18n";

/* 콘텐츠 중심 구성 — 검색·필터 도구만 있는 화면이 되지 않도록
 * 페이지 위에는 짧은 소개(lead), 아래에는 사용법·데이터 해석·출처·FAQ(deep)를 둡니다.
 * 광고 슬롯처럼 보이는 빈 컨테이너를 만들지 않고 항상 실제 텍스트만 렌더합니다. */
export function PalworldPageGuide({ locale, page, section }: {
  locale: PalworldLocale;
  page: PalworldGuidePage;
  section: "lead" | "deep";
}) {
  const copy = palworldGuideI18n[locale][page];
  const koCopy = palworldGuideI18n.ko[page];
  const jaCopy = palworldGuideI18n.ja[page];

  if (section === "lead") {
    return (
      <section aria-labelledby={`palworld-guide-lead-${page}`} className="palworld-guide palworld-guide--lead">
        <h2 data-ja={jaCopy.leadTitle} data-ko={koCopy.leadTitle} id={`palworld-guide-lead-${page}`}>
          {copy.leadTitle}
        </h2>
        <p data-ja={jaCopy.lead} data-ko={koCopy.lead}>{copy.lead}</p>
      </section>
    );
  }

  return (
    <section
      aria-labelledby={`palworld-guide-deep-${page}`}
      className="palworld-guide palworld-guide--deep"
      data-testid={`palworld-guide-${page}`}
    >
      <h2 className="yoro-u-sr-only" id={`palworld-guide-deep-${page}`}>{copy.howTitle}</h2>

      <div className="palworld-guide__column">
        <h3 data-ja={jaCopy.howTitle} data-ko={koCopy.howTitle}>{copy.howTitle}</h3>
        <ol className="palworld-guide__steps">
          {copy.how.map((step, index) => <li key={index}>{step}</li>)}
        </ol>
        <h3 data-ja={jaCopy.dataTitle} data-ko={koCopy.dataTitle}>{copy.dataTitle}</h3>
        <p className="palworld-guide__data">{copy.data}</p>
      </div>

      <div className="palworld-guide__column">
        <h3 data-ja={jaCopy.readTitle} data-ko={koCopy.readTitle}>{copy.readTitle}</h3>
        <dl className="palworld-guide__read">
          {copy.read.map((entry) => (
            <div key={entry.term}>
              <dt>{entry.term}</dt>
              <dd>{entry.description}</dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="palworld-guide__column">
        <h3 data-ja={jaCopy.faqTitle} data-ko={koCopy.faqTitle}>{copy.faqTitle}</h3>
        {copy.faq.map((entry) => (
          <details className="palworld-guide__faq" key={entry.question}>
            <summary>{entry.question}</summary>
            <p>{entry.answer}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
