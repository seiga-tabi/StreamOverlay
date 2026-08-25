import { useEffect, useRef, useState } from "react";
import type { PalworldElement } from "@streamops/shared";
import { parseAramAugmentCatalog, type AramAugmentRarity } from "@streamops/shared";
import type { PublicLocale } from "../../public-lol/i18n/public-lol-i18n";
import type { PublicTwitchFollowedLolChannel, PublicTwitchFollowedLolResponse } from "../../public-lol/types/public-lol";
import { localizedPublicUrlForCurrentLocale } from "../../public-lol/utils/public-locale-path";
import { rankTierLabel } from "../../public-lol/utils/rank";
import { safeTwitchStreamPreviewUrl } from "../../public-twitch/stream-preview";
import { getPalworldPals } from "../../public-palworld/api/palworld";
import { elementLabel } from "../../public-palworld/utils/labels";
import type { HomeText } from "../i18n/home-i18n";
import { NorigaeMark, SleepingTiger } from "./HomeMarks";
import {
  formatCount,
  GameCard,
  HomeChartSkeleton,
  HomeLiveCardSkeleton,
  LolCardIcon,
  PalCardIcon,
  SectionHead
} from "./HomeStaticSections";

/* 정적 섹션(교배·Bot·푸터)은 HomeStaticSections 로 옮겼습니다 — 라우트 폴백이
   lazy 청크 없이 같은 실물을 그리기 위한 분리. 기존 사용처 호환을 위해 재수출합니다. */
export { HomeBreedingSection, HomeBotSection, HomeFooter } from "./HomeStaticSections";

/* 홈 하위 섹션 — 목업 v8 HomeDark §3~§7.
 * 데이터는 전부 기존 계약을 사용합니다: 팔로우 방송(공개 Twitch 뷰어 API),
 * 증강 카탈로그(/api/public/aram/augments), 팰 속성 집계(팰 목록 응답의 facets).
 * 새 endpoint 나 mock 데이터를 만들지 않습니다. */

function fill(template: string, count: string): string {
  return template.replace("{count}", count);
}

/* ── 지금 방송 중 ─────────────────────────────────────────── */

function LiveDot() {
  return <span aria-hidden="true" className="yoro-home-live-dot" />;
}

function PlayGlyph() {
  return (
    <svg aria-hidden="true" className="yoro-home-thumb-glyph" fill="none" height="30" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 30 30" width="30">
      <circle cx="15" cy="15" r="11" />
      <path d="M12.5 10.5 L 20 15 L 12.5 19.5 Z" />
    </svg>
  );
}

/* 서브라인 = 게임 축약 · 방송 제목 (목업 "LoL · 솔로 랭크"). 축약 표가 모르는
   게임은 원문 그대로 둡니다. */
function liveGameShort(gameName: string | undefined, text: HomeText): string {
  if (!gameName) return text.liveGameLol;
  if (gameName === "League of Legends") return text.liveGameLol;
  if (gameName === "Palworld") return text.liveGamePal;
  return gameName;
}

type LiveCardVariant = "root" | "lol";

function LiveCard({ channel, text, variant }: {
  channel: PublicTwitchFollowedLolChannel;
  text: HomeText;
  variant: LiveCardVariant;
}) {
  const preview = safeTwitchStreamPreviewUrl(channel.thumbnailUrl);
  const channelUrl = channel.channelUrl ?? (channel.twitchLogin ? `https://www.twitch.tv/${channel.twitchLogin}` : undefined);
  /* LoL 홈 카드(확장형)는 LoL 전용 화면이라 게임 축약을 빼고 방송 제목만 씁니다
     (목업 page-2 §지금 방송 중). 루트 홈은 게임 축약 · 제목. */
  const gameLine = variant === "lol"
    ? channel.title ?? liveGameShort(channel.gameName, text)
    : channel.title
      ? `${liveGameShort(channel.gameName, text)} · ${channel.title}`
      : liveGameShort(channel.gameName, text);
  const card = (
    <>
      <div className="yoro-home-live-thumb">
        {preview ? (
          <img alt="" loading="lazy" src={preview} />
        ) : (
          <PlayGlyph />
        )}
        <span className="yoro-home-live-badge"><LiveDot />LIVE</span>
        {channel.viewerCount !== undefined ? (
          <span className="yoro-home-live-viewers">{fill(text.liveViewers, formatCount(channel.viewerCount))}</span>
        ) : null}
      </div>
      <div className="yoro-home-live-body">
        <div className="yoro-home-live-who">
          <span className="yoro-home-live-avatar">
            {channel.profileImageUrl ? <img alt="" loading="lazy" src={channel.profileImageUrl} /> : channel.twitchDisplayName.slice(0, 1)}
          </span>
          <span className="yoro-home-live-names">
            <span className="yoro-home-live-name">{channel.twitchDisplayName}</span>
            <span className="yoro-home-live-game">{gameLine}</span>
          </span>
        </div>
        {/* 하단 줄 — 승/패 전용색 강조(목업 §지금 방송 중). rankedStats 는 시즌
            누적이라 목업 예시의 "오늘" 라벨은 붙이지 않습니다(사실이 아닌 표기 금지). */}
        {channel.rankedStats ? (
          <div className="yoro-home-live-meta">
            {variant === "lol" ? <>{rankTierLabel(channel.rankedStats)}{" · "}</> : null}
            <span className="yoro-home-live-win">{fill(text.liveWins, formatCount(channel.rankedStats.wins))}</span>
            {" "}
            <span className="yoro-home-live-loss">{fill(text.liveLosses, formatCount(channel.rankedStats.losses))}</span>
          </div>
        ) : channel.riotId ? (
          <div className="yoro-home-live-meta">{channel.riotId}</div>
        ) : null}
      </div>
    </>
  );
  if (!channelUrl) return <div className="yoro-home-live-card">{card}</div>;
  return (
    <a
      aria-label={`${channel.twitchDisplayName} — ${text.liveWatch}`}
      className="yoro-home-live-card"
      href={channelUrl}
      rel="noreferrer noopener"
      target="_blank"
    >
      {card}
    </a>
  );
}

export function HomeLiveSection({ text, connected, followedChannels, loading = false, onLoginOpen, variant = "root" }: {
  text: HomeText;
  connected: boolean;
  followedChannels: PublicTwitchFollowedLolResponse | null;
  /** 팔로우 조회가 진행 중인 동안 true — 빈 상태 문구를 미리 보이지 않게(거짓 빈 상태 수정). */
  loading?: boolean;
  onLoginOpen: () => void;
  variant?: LiveCardVariant;
}) {
  /* twitchUserId 중복 제거 — 같은 채널이 두 번 오면 React 가 같은 key 로 두 자식을
     그려 경고를 내고(실측: "two children with the same key, `55`") 목록에도 두 번
     보입니다. 팰월드가 쓰던 rail 은 utils/streamers.ts 의 uniqueFollowedTwitchChannels
     로 걸렀는데, 2026-08-25 에 이 컴포넌트로 합치면서 그 보장이 빠졌습니다.
     먼저 온 항목을 남깁니다(기존 rail 과 같은 규칙). */
  const liveChannels = (() => {
    const unique = new Map<string, PublicTwitchFollowedLolChannel>();
    for (const channel of followedChannels?.channels ?? []) {
      if (!channel.isLive) continue;
      const id = channel.twitchUserId?.trim() || channel.twitchLogin;
      if (!id || unique.has(id)) continue;
      unique.set(id, channel);
    }
    return [...unique.values()];
  })();

  return (
    <section className="yoro-home-section">
      <SectionHead
        count={connected && followedChannels ? liveChannels.length : undefined}
        countSuffix={text.liveCountSuffix}
        title={text.liveTitle}
        viewAllHref={localizedPublicUrlForCurrentLocale("/follow")}
        viewAllLabel={text.liveViewAll}
      />
      {loading && liveChannels.length === 0 ? (
        /* 조회 중에는 스켈레톤 — 끝나기 전의 빈 배열로 "방송 중인 스트리머가
           없습니다"를 먼저 말하던 문제의 수정점(로딩 화면 프롬프트 §2-5). */
        <div className="yoro-home-live-grid">
          {[0, 1, 2, 3].map((index) => <HomeLiveCardSkeleton key={index} />)}
        </div>
      ) : liveChannels.length > 0 ? (
        <div className="yoro-home-live-grid">
          {liveChannels.slice(0, 4).map((channel) => (
            <LiveCard channel={channel} key={channel.twitchUserId || channel.twitchLogin} text={text} variant={variant} />
          ))}
        </div>
      ) : (
        <div className="yoro-home-live-empty">
          <SleepingTiger className="yoro-home-live-empty-tiger" />
          <p className="yoro-home-live-empty-title">{text.liveEmptyTitle}</p>
          <p className="yoro-home-live-empty-sub">
            {connected ? text.liveEmptyDescription : text.liveLoginDescription}
          </p>
          {connected ? (
            <a className="yoro-home-outline-button" href={localizedPublicUrlForCurrentLocale("/streamers")}>
              {text.liveEmptyCta} <span aria-hidden="true">&#8594;</span>
            </a>
          ) : (
            <button className="yoro-home-outline-button" onClick={onLoginOpen} type="button">
              {text.liveLoginCta}
            </button>
          )}
        </div>
      )}
    </section>
  );
}

/* ── 미니 바 차트 ─────────────────────────────────────────── */

type BarDatum = {
  key: string;
  label: string;
  count: number;
  /* 등급(서열)은 명도 램프 CSS 변수, 속성(범주)은 검증된 고정색. */
  color: string;
};

function MiniBarChart({ title, data }: { title: string; data: BarDatum[] }) {
  const max = Math.max(...data.map((datum) => datum.count), 1);
  return (
    <div className="yoro-home-chart">
      <div className="yoro-home-chart-title">{title}</div>
      {data.map((datum) => (
        <div className="yoro-home-bar-row" key={datum.key}>
          <span className="yoro-home-bar-name">{datum.label}</span>
          <div className="yoro-home-bar-track">
            <div className="yoro-home-bar-fill" style={{ background: datum.color, width: `${Math.round(datum.count / max * 100)}%` }} />
          </div>
          <span className="yoro-home-bar-value">{formatCount(datum.count)}</span>
        </div>
      ))}
    </div>
  );
}

/* 속성 연상색 — 목업 v7에서 색각 이상(적록·청황) 구분과 표면 대비를 검증 도구로
 * 통과시킨 5색 + 같은 명도·채도대에 맞춘 나머지 속성. 색은 속성(entity)을 따라
 * 고정되고, 막대에는 라벨·값 텍스트가 함께 붙습니다(보조 부호화). */
const ELEMENT_COLORS: Record<PalworldElement, string> = {
  water: "#4E86D0",
  grass: "#2EA07E",
  fire: "#C8542E",
  dark: "#A055C8",
  electric: "#A8841E",
  ice: "#5FA8B8",
  ground: "#B07A3C",
  dragon: "#8668D0",
  neutral: "#8B93A0"
};

/* 상위 등급부터 — 목업 차트 규칙 "밝을수록 상위 등급"(다크 기준). 색은 순서대로
   --home-g1(최상위)~g4 를 받으므로 서열 내림차순이어야 램프 방향이 맞습니다. */
const RARITY_ORDER: readonly AramAugmentRarity[] = ["legend", "prismatic", "gold", "silver"];

function rarityText(text: HomeText, rarity: AramAugmentRarity): string {
  if (rarity === "silver") return text.raritySilver;
  if (rarity === "gold") return text.rarityGold;
  if (rarity === "prismatic") return text.rarityPrismatic;
  return text.rarityLegend;
}

export function HomeGameDataSection({ text, locale }: { text: HomeText; locale: PublicLocale }) {
  const [rarityCounts, setRarityCounts] = useState<Array<{ rarity: AramAugmentRarity; count: number }> | null>(null);
  const [patchVersion, setPatchVersion] = useState<string | null>(null);
  const [elementCounts, setElementCounts] = useState<Array<{ element: PalworldElement; count: number }> | null>(null);
  /* 차트 fetch 가 끝났는지(성공·실패 무관). 끝나기 전에는 스켈레톤을, 끝난 뒤
     데이터가 없으면 빈 높이만 남깁니다 — 영원히 로딩처럼 보이지 않게(§2-6). */
  const [aramSettled, setAramSettled] = useState(false);
  const [palSettled, setPalSettled] = useState(false);

  /* 실패 시 차트만 조용히 생략합니다 — 홈의 핵심(검색)은 데이터 없이도 동작해야 합니다. */
  useEffect(() => {
    const controller = new AbortController();
    void (async () => {
      try {
        const response = await fetch("/api/public/aram/augments", {
          credentials: "same-origin",
          headers: { Accept: "application/json" },
          signal: controller.signal
        });
        if (!response.ok) return;
        const catalog = parseAramAugmentCatalog(await response.json());
        if (!catalog || catalog.augments.length === 0) return;
        if (catalog.dataVersion) setPatchVersion(catalog.dataVersion);
        const counts = new Map<AramAugmentRarity, number>();
        for (const augment of catalog.augments) {
          counts.set(augment.rarity, (counts.get(augment.rarity) ?? 0) + 1);
        }
        const data = RARITY_ORDER
          .map((rarity) => ({ rarity, count: counts.get(rarity) ?? 0 }))
          .filter((entry) => entry.count > 0);
        if (data.length > 0) setRarityCounts(data);
      } catch {
        /* 차트 생략 */
      } finally {
        if (!controller.signal.aborted) setAramSettled(true);
      }
    })();
    void (async () => {
      try {
        const response = await getPalworldPals(new URLSearchParams([["pageSize", "1"]]), controller.signal);
        const entries = [...response.facets.elements]
          .sort((a, b) => b.count - a.count)
          .slice(0, 5)
          .map((entry) => ({ element: entry.value, count: entry.count }));
        if (entries.length > 0) setElementCounts(entries);
      } catch {
        /* 차트 생략 */
      } finally {
        if (!controller.signal.aborted) setPalSettled(true);
      }
    })();
    return () => controller.abort();
  }, []);

  const palLocale = locale === "ja" ? "ja" : "ko";

  return (
    <section className="yoro-home-section">
      <SectionHead title={text.gamesTitle} />
      <div className="yoro-home-game-cards">
        <GameCard
          chart={rarityCounts ? (
            <MiniBarChart
              data={rarityCounts.map((entry, index) => ({
                key: entry.rarity,
                label: rarityText(text, entry.rarity),
                count: entry.count,
                color: `var(--home-g${Math.min(index + 1, 4)})`
              }))}
              title={text.chartLolTitle}
            />
          ) : aramSettled ? null : <HomeChartSkeleton />}
          badge={patchVersion ? text.gamePatchBadge.replace("{version}", patchVersion) : undefined}
          icon={<LolCardIcon />}
          name={text.lolCardName}
          wide
          rows={[
            { href: localizedPublicUrlForCurrentLocale("/lol"), label: text.rowLolSearch },
            { href: localizedPublicUrlForCurrentLocale("/lol/aram"), label: text.rowLolAram },
            { href: localizedPublicUrlForCurrentLocale("/patch-notes"), label: text.rowLolPatchNotes }
          ]}
        />
        <GameCard
          chart={elementCounts ? (
            <MiniBarChart
              data={elementCounts.map((entry) => ({
                key: entry.element,
                label: locale === "en"
                  ? entry.element.charAt(0).toUpperCase() + entry.element.slice(1)
                  : elementLabel(entry.element, palLocale),
                count: entry.count,
                color: ELEMENT_COLORS[entry.element]
              }))}
              title={text.chartPalTitle}
            />
          ) : palSettled ? null : <HomeChartSkeleton />}
          icon={<PalCardIcon />}
          name={text.palCardName}
          rows={[
            { href: localizedPublicUrlForCurrentLocale("/palworld/pals"), label: text.rowPalDex },
            { href: localizedPublicUrlForCurrentLocale("/palworld/items"), label: text.rowPalItems },
            { href: localizedPublicUrlForCurrentLocale("/palworld/breeding"), label: text.rowPalBreeding }
          ]}
        />
      </div>
    </section>
  );
}

/* ── 교배 빠른 이동 ───────────────────────────────────────── */

/* ── 로그인 팝업 — 목업 v8 LoginModal ─────────────────────── */

export function HomeLoginModal({ text, open, onClose, onTwitchLogin }: {
  text: HomeText;
  open: boolean;
  onClose: () => void;
  onTwitchLogin: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    dialogRef.current?.focus();
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="yoro-home-modal-backdrop" onClick={onClose} role="presentation">
      <div
        aria-label={text.loginTitle}
        aria-modal="true"
        className="yoro-home-modal"
        onClick={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
        tabIndex={-1}
      >
        <div className="yoro-home-modal-head">
          <NorigaeMark className="yoro-home-section-norigae" height={26} width={13} />
          <span className="yoro-home-modal-title">{text.loginTitle}</span>
          <button aria-label={text.closeLabel} className="yoro-home-modal-close" onClick={onClose} type="button">
            <svg aria-hidden="true" fill="none" height="16" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 16 16" width="16">
              <path d="M3 3 L 13 13" />
              <path d="M13 3 L 3 13" />
            </svg>
          </button>
        </div>
        <p className="yoro-home-modal-desc">{text.loginDescription}</p>
        <button className="yoro-home-primary-button yoro-home-modal-twitch" onClick={onTwitchLogin} type="button">
          <svg aria-hidden="true" fill="none" height="17" stroke="currentColor" strokeWidth="1.4" viewBox="0 0 20 20" width="17">
            <path d="M5 3 L 16 3 16 12 12.5 15 10 15 8 17 8 15 5 15 4 14 4 4 Z" />
            <path d="M12.5 6.5 L 12.5 10" />
            <path d="M9 6.5 L 9 10" />
          </svg>
          {text.loginTwitchCta}
        </button>
        <div className="yoro-home-modal-fine">
          <p>{text.loginFinePrint}</p>
        </div>
      </div>
    </div>
  );
}
