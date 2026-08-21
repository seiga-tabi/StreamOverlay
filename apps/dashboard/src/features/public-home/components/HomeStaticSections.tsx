import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import type { HomeText } from "../i18n/home-i18n";
import { NorigaeMark } from "./HomeMarks";

/* 홈의 정적 섹션 — fetch·훅 의존이 없는 조각만 이 모듈에 둡니다.
 * 라우트 폴백(HomeRouteFallback)이 lazy 청크(HomeSections 537줄) 없이
 * 같은 실물을 그리기 위한 분리입니다. 데이터 섹션(방송·차트)은 계속
 * HomeSections.tsx 에 있고, 거기서 이 조각들을 import 해 씁니다. */

export function formatCount(count: number): string {
  return count.toLocaleString("en-US");
}

export function SectionHead({ title, count, viewAllHref, viewAllLabel, countSuffix }: {
  title: string;
  count?: number;
  viewAllHref?: string;
  viewAllLabel?: string;
  countSuffix?: string;
}) {
  return (
    <div className="yoro-home-section-head">
      <NorigaeMark className="yoro-home-section-norigae" height={28} width={14} />
      <h2 className="yoro-home-section-title">{title}</h2>
      {count !== undefined ? <span className="yoro-home-section-count">{formatCount(count)}{countSuffix}</span> : null}
      {viewAllHref && viewAllLabel ? (
        <a className="yoro-home-section-viewall" href={viewAllHref}>{viewAllLabel} <span aria-hidden="true">&#8594;</span></a>
      ) : null}
    </div>
  );
}

export function GameCard({ icon, name, badge, wide, chart, rows }: {
  icon: React.ReactNode;
  name: string;
  /* 목업 LoL 카드 제목 옆 패치 버전 배지. */
  badge?: string;
  /* 목업 §게임별 데이터의 좌우 비대칭 폭(LoL 쪽이 1.4). */
  wide?: boolean;
  chart: React.ReactNode;
  rows: Array<{ href: string; label: string }>;
}) {
  return (
    <div className={`yoro-home-game-card${wide ? " is-wide" : ""}`}>
      <div className="yoro-home-game-card-head">
        {icon}
        <span className="yoro-home-game-card-name">{name}</span>
        {badge ? <span className="yoro-home-game-card-badge">{badge}</span> : null}
      </div>
      {chart}
      <div className="yoro-home-game-rows">
        {rows.map((row) => (
          <a className="yoro-home-game-row" href={row.href} key={row.href}>
            <span>{row.label}</span>
            <span aria-hidden="true" className="yoro-home-game-row-arrow">&#8594;</span>
          </a>
        ))}
      </div>
    </div>
  );
}

export function LolCardIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <path d="M6 20 L 13 4 L 20 20" />
      <path d="M9 15 h8" />
      <path d="M4 22 h18" />
    </svg>
  );
}

export function PalCardIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="22" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 26 26" width="22">
      <circle cx="13" cy="12" r="7" />
      <path d="M8 7 L 5 3" />
      <path d="M18 7 L 21 3" />
      <circle cx="10.5" cy="11" fill="currentColor" r=".8" stroke="none" />
      <circle cx="15.5" cy="11" fill="currentColor" r=".8" stroke="none" />
    </svg>
  );
}

export function HomeBreedingSection({ text }: { text: HomeText }) {
  const breedingHref = localizedPublicUrlForCurrentLocale("/palworld/breeding");
  return (
    <section className="yoro-home-section">
      <SectionHead title={text.breedingTitle} />
      <p className="yoro-home-section-sub">{text.breedingSub}</p>
      <div className="yoro-home-breeding">
        <a className="yoro-home-breeding-picker" href={breedingHref}>
          <span>{text.breedingPickerPlaceholder}</span>
          <svg aria-hidden="true" fill="none" height="6" stroke="currentColor" strokeWidth="1" viewBox="0 0 8 5" width="9">
            <path d="M1 1 L 4 4 L 7 1" />
          </svg>
        </a>
        <span aria-hidden="true" className="yoro-home-breeding-times">&#215;</span>
        <a className="yoro-home-breeding-picker" href={breedingHref}>
          <span>{text.breedingPickerPlaceholder}</span>
          <svg aria-hidden="true" fill="none" height="6" stroke="currentColor" strokeWidth="1" viewBox="0 0 8 5" width="9">
            <path d="M1 1 L 4 4 L 7 1" />
          </svg>
        </a>
        <a className="yoro-home-primary-button" href={breedingHref}>
          {text.breedingCta} <span aria-hidden="true">&#8594;</span>
        </a>
      </div>
    </section>
  );
}

/* ── YORO Bot ─────────────────────────────────────────────── */

export function HomeBotSection({ text }: { text: HomeText }) {
  return (
    <section className="yoro-home-section">
      <div className="yoro-home-bot">
        <NorigaeMark className="yoro-home-section-norigae" height={28} width={14} />
        <div className="yoro-home-bot-body">
          <div className="yoro-home-bot-name">{text.botName}</div>
          <div className="yoro-home-bot-desc">{text.botDescription}</div>
        </div>
        <a className="yoro-home-outline-button yoro-home-bot-cta" href={localizedPublicUrlForCurrentLocale("/bot")}>
          {text.botCta}
        </a>
      </div>
    </section>
  );
}

/* ── 푸터 ─────────────────────────────────────────────────── */

export function HomeFooter({ text, locale, onLocale }: {
  text: HomeText;
  locale: PublicLocale;
  onLocale: (locale: PublicLocale) => void;
}) {
  return (
    <footer className="yoro-home-footer">
      <div className="yoro-home-footer-top">
        <div className="yoro-home-footer-brand">
          <div className="yoro-home-footer-wordmark">YORO<span>.GG</span></div>
          <p className="yoro-home-footer-legal">{text.footerLegal}</p>
        </div>
        <nav aria-label={text.footerContact} className="yoro-home-footer-links">
          <a href={localizedPublicUrlForCurrentLocale("/terms")}>{text.footerTerms}</a>
          <a href={localizedPublicUrlForCurrentLocale("/privacy")}>{text.footerPrivacy}</a>
          <a href={localizedPublicUrlForCurrentLocale("/contact")}>{text.footerContact}</a>
        </nav>
      </div>
      <div className="yoro-home-footer-langs">
        {([["ko", "한국어"], ["ja", "日本語"], ["en", "English"]] as Array<[PublicLocale, string]>).map(([code, label], index) => (
          <span key={code}>
            {index > 0 ? <span aria-hidden="true" className="yoro-home-footer-lang-sep">&#8202;·&#8202;</span> : null}
            <button
              aria-current={locale === code ? "true" : undefined}
              className={`yoro-home-footer-lang${locale === code ? " is-active" : ""}`}
              onClick={() => onLocale(code)}
              type="button"
            >
              {label}
            </button>
          </span>
        ))}
      </div>
    </footer>
  );
}

/* ── 스켈레톤 조각 — 라우트 폴백과 로딩 분기가 공유(목업 「홈 로딩」) ──
 * 애니메이션 없음(홈 검색 구역 무애니메이션 규칙과 같은 이유).
 * 색은 01-public-home.css 의 --home-sk / --home-sk-hi 토큰. */

export function HomeLiveCardSkeleton() {
  return (
    <div aria-hidden="true" className="yoro-home-live-card yoro-home-live-card--sk">
      <span className="yoro-home-sk yoro-home-sk-thumb" />
      <span className="yoro-home-live-card-sk-row">
        <span className="yoro-home-sk yoro-home-sk-avatar" />
        <span className="yoro-home-live-card-sk-lines">
          <span className="yoro-home-sk" style={{ width: "72%", height: 12 }} />
          <span className="yoro-home-sk" style={{ width: "46%", height: 10 }} />
        </span>
      </span>
    </div>
  );
}

export function HomeChartSkeleton() {
  return (
    <div aria-hidden="true" className="yoro-home-chart yoro-home-chart--sk">
      <span className="yoro-home-sk" style={{ width: "38%", height: 11 }} />
      {[82, 64, 48, 30].map((width) => (
        <span className="yoro-home-sk" key={width} style={{ width: `${width}%`, height: 10 }} />
      ))}
    </div>
  );
}
