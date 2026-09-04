import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  LOL_CHAMPION_BUILD_STATS_MIN_TOTAL_GAMES,
  LOL_CHAMPION_BUILD_STATS_POSITIONS,
  isLolChampionBuildStatsPosition,
  type LolChampionBuildStatsAsset,
  type LolChampionBuildStatsPosition,
  type LolChampionBuildStatsReadyResponse,
  type LolChampionBuildStatsResponse,
  type LolChampionSummary
} from "@streamops/shared";
import { fetchChampionBuildStats } from "../api/lol";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import type { PublicLolProfile } from "../types/public-lol";
import { formatPercent } from "../utils/format";
import { championAnalysisRows } from "../utils/match";

/* 챔피언 글로벌 빌드 통계 — 전체 유저 누적(/api/lol/champion-build-stats).
 *
 * 시그니처 빌드(프로필 주인 개인의 최근 매치)와 데이터 원천이 다르므로 상태·로직을
 * 완전히 분리합니다. 마크업은 .public-champ-* / .public-sig-* 를 빌려 쓰고 신규
 * 선택자는 .public-gbs-* 만 씁니다(43-global-build-stats.css).
 *
 * 진입 경로: 패널 상단 챔피언 칩(숙련도 순 상위 + 최근 성과 챔피언)에서 고르고,
 * 포지션 탭은 5개 라인을 항상 보여주되 포지션 비중(%)을 함께 적어 어느 라인이 주
 * 라인인지 누르기 전에 보이게 합니다.
 * 기본 포지션은 이 프로필이 그 챔피언을 가장 많이 플레이한 라인입니다. */

export const GLOBAL_BUILD_STATS_MAX_CANDIDATES = 6;
export const GLOBAL_BUILD_STATS_ITEM_SLOTS = 6;

/* 라인 아이콘 — 전적 행에서 이미 쓰는 서비스 자산 그대로입니다(새로 그리지 않았고
   무채화는 CSS 의 grayscale 필터가 맡습니다). 라인 이름 텍스트가 접근성 이름을
   맡으므로 아이콘은 alt="" 장식입니다. */
const POSITION_ICON_URLS: Record<LolChampionBuildStatsPosition, string> = {
  TOP: "/images/roles/position-top.svg",
  JUNGLE: "/images/roles/position-jungle.svg",
  MIDDLE: "/images/roles/position-middle.svg",
  BOTTOM: "/images/roles/position-bottom.svg",
  UTILITY: "/images/roles/position-utility.svg"
};

const POSITION_ALIASES: Record<string, LolChampionBuildStatsPosition> = {
  TOP: "TOP",
  JUNGLE: "JUNGLE",
  MIDDLE: "MIDDLE",
  MID: "MIDDLE",
  BOTTOM: "BOTTOM",
  BOT: "BOTTOM",
  ADC: "BOTTOM",
  UTILITY: "UTILITY",
  SUPPORT: "UTILITY"
};

export type GlobalBuildStatsHelpers = {
  championName(champion: LolChampionSummary): string;
  positionLabel(position: string): string;
  assetUrl(url: string | undefined): string | undefined;
  spellIconUrl(spellId: number, dataDragonVersion?: string): string | undefined;
};

export type GlobalBuildStatsCandidate = {
  champion: LolChampionSummary;
  /** 이 프로필의 최근 게임 수(칩 보조 문구용, 없으면 생략). */
  games?: number;
};

export type GlobalBuildStatsState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: LolChampionBuildStatsResponse };

export function normalizeBuildStatsPosition(value: string | undefined): LolChampionBuildStatsPosition | undefined {
  if (!value) return undefined;
  return POSITION_ALIASES[value.toUpperCase()];
}

/** 칩 후보 — 숙련도 순(championAnalysisRows) 상위 N. 없으면 최근 매치 챔피언으로 보강. */
export function globalBuildStatsCandidates(profile: PublicLolProfile): GlobalBuildStatsCandidate[] {
  const candidates: GlobalBuildStatsCandidate[] = championAnalysisRows(profile).map((row) => ({
    champion: row.champion,
    ...(row.performance ? { games: row.performance.games } : {})
  }));
  const covered = new Set(candidates.map((candidate) => candidate.champion.championId));
  const gamesByChampion = new Map<number, { champion: LolChampionSummary; games: number }>();
  for (const match of profile.recentMatches) {
    const championId = match.champion.championId;
    if (covered.has(championId)) continue;
    const existing = gamesByChampion.get(championId) ?? { champion: match.champion, games: 0 };
    existing.games += 1;
    gamesByChampion.set(championId, existing);
  }
  const matchOnly = [...gamesByChampion.values()].sort((a, b) => b.games - a.games);
  return [...candidates, ...matchOnly].slice(0, GLOBAL_BUILD_STATS_MAX_CANDIDATES);
}

/** 기본 포지션 — 이 프로필이 그 챔피언을 가장 많이 한 라인 → 주 포지션 → 미드. */
export function defaultBuildStatsPosition(profile: PublicLolProfile, championId: number): LolChampionBuildStatsPosition {
  const counts = new Map<LolChampionBuildStatsPosition, number>();
  for (const match of profile.recentMatches) {
    if (match.champion.championId !== championId) continue;
    const position = normalizeBuildStatsPosition(match.position);
    if (!position) continue;
    counts.set(position, (counts.get(position) ?? 0) + 1);
  }
  const mostPlayed = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
  if (mostPlayed) return mostPlayed;
  const mainRole = profile.roleAnalysis?.mainRole;
  if (isLolChampionBuildStatsPosition(mainRole)) return mainRole;
  return "MIDDLE";
}

export function buildStatsAssetName(asset: LolChampionBuildStatsAsset | undefined, fallback: string): string {
  if (!asset) return fallback;
  if (activePublicLocale === "ja") return asset.nameJa ?? asset.nameKo ?? asset.nameEn ?? fallback;
  if (activePublicLocale === "en") return asset.nameEn ?? asset.nameKo ?? asset.nameJa ?? fallback;
  return asset.nameKo ?? asset.nameJa ?? asset.nameEn ?? fallback;
}

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

/* 서버가 소수 1자리로 내리므로 정수면 "55", 아니면 "56.3" 그대로 보여줍니다. */
function rateText(rate: number): string {
  return formatPercent(rate, rate % 1 === 0 ? 0 : 1).replace("%", "");
}

/* 문구 템플릿을 "{rate}%" 기준으로 갈라 숫자만 <em> 으로 감쌉니다. 로케일마다 라벨
   위치가 달라서(ko "채용률 {rate}%" · en "{rate}% pick rate") 앞뒤 조각을 그대로
   두고 강조만 숫자에 붙입니다 — 색·크기가 라벨까지 번지면 위계가 사라집니다. */
function splitRateTemplate(template: string): [string, string] {
  const [before = "", after = ""] = template.split("{rate}%");
  return [before, after];
}

/* 채용률·포지션 비중 3단(승인 목업 §08) — 카드에 뜨는 구간 10~100% 를
   40% 이상(사실상 표준) / 20~40%(유력한 대안) / 그 미만(소수 선택)으로 끊습니다.
   색은 CSS 의 --metric-tone 이 맡고 여기서는 단계 클래스만 정합니다. */
function metricToneClass(rate: number): string {
  if (rate >= 40) return "public-gbs-pick-hi";
  if (rate >= 20) return "public-gbs-pick-mid";
  return "public-gbs-pick-lo";
}

/** 승률만 승패색(50% 경계). 채용률은 빈도라 승패색을 쓰지 않습니다. */
function winToneClass(winRate: number): string {
  return winRate >= 50 ? "public-gbs-win" : "public-gbs-loss";
}

function WinRateText({ winRate }: { winRate: number | undefined }) {
  if (winRate === undefined) return <>{t().globalBuildStatsWinRateHidden}</>;
  const [before, after] = splitRateTemplate(t().globalBuildStatsWinRate);
  return (
    <>
      {before}
      <em className={winToneClass(winRate)}>{rateText(winRate)}%</em>
      {after}
    </>
  );
}

function PickRateText({ pickRate }: { pickRate: number }) {
  const [before, after] = splitRateTemplate(t().globalBuildStatsPickRate);
  return (
    <>
      {before ? <span className="public-gbs-pick-label">{before}</span> : null}
      <em>{rateText(pickRate)}%</em>
      {after ? <span className="public-gbs-pick-label">{after}</span> : null}
    </>
  );
}

/** 카드 클래스 — 단계 클래스를 카드에 직접 붙여 숫자(em)와 바(i)가 같은 단을 봅니다. */
function buildCardClassName(index: number, pickRate: number): string {
  return `public-sig-build public-gbs-build ${metricToneClass(pickRate)}${index > 0 ? " is-alt" : ""}`;
}

/* 화면에 노출되는 게임 수 절대값은 전부 뺐습니다(목업 §08) — 카드 표본("· 190게임"),
   "그 외 N게임", 탭 보조 줄, 포지션 표 세 번째 칸, 상단 요약 앞머리. 표본 수는 탭
   aria-label 에 남고, "20게임 미만 → 승률 표본 부족" 상태 문구도 그대로 둡니다. */
function BuildCardHead({ index, children, pickRate, winRate }: {
  index: number;
  children: ReactNode;
  pickRate: number;
  winRate: number | undefined;
}) {
  return (
    <>
      <div className="public-sig-build-head public-gbs-build-head">
        <span className="public-sig-build-no">{fill(t().globalBuildStatsRank, { n: index + 1 })}</span>
        {children}
        <span className="public-sig-build-pick public-gbs-pick">
          <b><PickRateText pickRate={pickRate} /></b>
          <small><WinRateText winRate={winRate} /></small>
        </span>
      </div>
      <span aria-hidden="true" className="public-sig-build-bar public-gbs-bar"><i style={{ width: `${Math.min(100, Math.max(0, pickRate))}%` }} /></span>
    </>
  );
}

/** 라인 아이콘 한 칸(장식) — 라인 이름 텍스트가 접근성 이름을 맡습니다. */
function PositionIcon({ position }: { position: LolChampionBuildStatsPosition | undefined }) {
  if (!position) return null;
  return <img alt="" className="public-gbs-pos-icon" decoding="async" src={POSITION_ICON_URLS[position]} />;
}

function ReadyColumns({ data, helpers }: { data: LolChampionBuildStatsReadyResponse; helpers: GlobalBuildStatsHelpers }) {
  return (
    <>
      <div className="public-gbs-summary">
        <small>{t().globalBuildStatsSummaryLabel}</small>
        <b>{rateText(data.winRate)}%</b>
      </div>
      <div className="public-gbs-grid">
        <section className="public-gbs-col" aria-labelledby="public-gbs-runes-title">
          <h3 className="public-gbs-col-title" id="public-gbs-runes-title">{t().globalBuildStatsRunesTitle}</h3>
          {data.runeGroups.length === 0 ? <p className="public-gbs-col-empty">{t().globalBuildStatsColumnEmpty}</p> : null}
          {data.runeGroups.map((group, index) => {
            const keystoneName = buildStatsAssetName(group.keystone, `#${group.keystonePerkId}`);
            /* 응답은 keystone 말고도 주·보조 룬트리 에셋을 들고 옵니다 — 예전 마크업은
               키스톤 원 하나만 그려 둘의 아이콘 자리를 통째로 버리고 있었습니다.
               아이콘 URL 이 없으면 URL 을 지어내지 않고 이름 한 글자 약칭만 둡니다. */
            const styles = [
              { id: group.primaryStyleId, asset: group.primaryStyle },
              { id: group.subStyleId, asset: group.subStyle }
            ].filter((style) => style.id > 0);
            const styleNames = styles
              .map((style) => buildStatsAssetName(style.asset, `#${style.id}`))
              .join(" + ");
            return (
              <div className={buildCardClassName(index, group.pickRate)} key={group.key}>
                <BuildCardHead index={index} pickRate={group.pickRate} winRate={group.winRate}>
                  <span className="public-sig-rune">
                    <span aria-hidden="true" className="public-gbs-rune-icons">
                      <span className="public-sig-keystone public-gbs-keystone">
                        {group.keystone?.iconUrl ? <img alt="" src={helpers.assetUrl(group.keystone.iconUrl)} /> : <span>{keystoneName.slice(0, 2)}</span>}
                      </span>
                      {styles.length > 0 ? (
                        <span className="public-gbs-styles">
                          {styles.map((style) => (
                            <i className="public-gbs-style" key={style.id}>
                              {style.asset?.iconUrl
                                ? <img alt="" src={helpers.assetUrl(style.asset.iconUrl)} />
                                : buildStatsAssetName(style.asset, "").slice(0, 1)}
                            </i>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    <span className="public-sig-rune-names">
                      <b>{keystoneName}</b>
                      {styleNames ? <small>{styleNames}</small> : null}
                    </span>
                  </span>
                </BuildCardHead>
              </div>
            );
          })}
        </section>

        <section className="public-gbs-col" aria-labelledby="public-gbs-items-title">
          <h3 className="public-gbs-col-title" id="public-gbs-items-title">{t().globalBuildStatsItemsTitle}</h3>
          {data.itemGroups.length === 0 ? <p className="public-gbs-col-empty">{t().globalBuildStatsColumnEmpty}</p> : null}
          {data.itemGroups.map((group, index) => {
            const items = group.itemIds.map((itemId) => group.items?.find((item) => item.id === itemId) ?? { id: itemId });
            return (
              <div className={buildCardClassName(index, group.pickRate)} key={group.key}>
                <BuildCardHead index={index} pickRate={group.pickRate} winRate={group.winRate}>
                  <span className="public-sig-rune" />
                </BuildCardHead>
                <div className="public-sig-items">
                  {items.map((item) => (
                    <span className="public-sig-item public-gbs-item" key={item.id} title={buildStatsAssetName(item, `#${item.id}`)}>
                      {/* 아이콘이 오면 그림, 못 풀면 이름 앞 두 글자 — 22px 칸(내부 20.6px)에
                          8.5px 글자 세 자 이상은 줄바꿈·잘림이 납니다. */}
                      <i>{item.iconUrl ? <img alt={buildStatsAssetName(item, `#${item.id}`)} src={helpers.assetUrl(item.iconUrl)} /> : buildStatsAssetName(item, `#${item.id}`).slice(0, 2)}</i>
                    </span>
                  ))}
                  {Array.from({ length: Math.max(0, GLOBAL_BUILD_STATS_ITEM_SLOTS - items.length) }, (_, slot) => (
                    <span aria-hidden="true" className="public-sig-item public-gbs-item is-empty" key={`empty:${slot}`}>
                      <i />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </section>

        <section className="public-gbs-col" aria-labelledby="public-gbs-spells-title">
          <h3 className="public-gbs-col-title" id="public-gbs-spells-title">{t().globalBuildStatsSpellsTitle}</h3>
          {data.spellGroups.length === 0 ? <p className="public-gbs-col-empty">{t().globalBuildStatsColumnEmpty}</p> : null}
          {data.spellGroups.map((group, index) => (
            <div className={buildCardClassName(index, group.pickRate)} key={group.key}>
              <BuildCardHead index={index} pickRate={group.pickRate} winRate={group.winRate}>
                <span className="public-gbs-spells">
                  {[group.summonerSpell1, group.summonerSpell2].map((spellId) => {
                    const iconUrl = helpers.spellIconUrl(spellId, data.dataDragonVersion);
                    return (
                      <span className="public-gbs-spell" key={spellId}>
                        {iconUrl ? <img alt="" src={iconUrl} /> : <span>{spellId}</span>}
                      </span>
                    );
                  })}
                </span>
              </BuildCardHead>
            </div>
          ))}

          <h3 className="public-gbs-col-title" id="public-gbs-positions-title">{t().globalBuildStatsPositionsTitle}</h3>
          <div className="public-gbs-positions" aria-labelledby="public-gbs-positions-title" role="list">
            {data.positions.map((entry) => (
              <div className="public-champ-role-cell" key={entry.teamPosition} role="listitem">
                <span className="public-champ-role-name">
                  <PositionIcon position={normalizeBuildStatsPosition(entry.teamPosition)} />
                  <b>{helpers.positionLabel(entry.teamPosition)}</b>
                  {entry.teamPosition === data.teamPosition ? <i aria-hidden="true">●</i> : null}
                </span>
                <span className="public-champ-role-stat">
                  {entry.winRate === undefined ? t().globalBuildStatsWinRateHidden : <b>{formatPercent(entry.winRate)}</b>}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

/* ── 아래 둘은 프로필 패널과 단독 챔피언 화면(PublicChampionBuildPage)이 공유합니다.
      챔피언 칩(프로필 후보 목록)만 패널 쪽에 남습니다 — 단독 화면에는 프로필이
      없어 후보를 만들 근거가 없습니다. ─────────────────────────────────────── */

/** 포지션 탭 5개. `positionGames` 가 없으면(아직 로딩) 비중을 적지 않습니다.
 *
 * 화면에 적는 수치는 다섯 포지션 games 합계 대비 비중(%) 하나입니다 — 절대값
 * 하나로는 판단이 안 되기 때문입니다(1284 이 많은 수인지 알려면 나머지 네 탭을 다
 * 읽어야 하지만, 70.2% 는 한 칸만 봐도 "사실상 정글"이 읽힙니다). 새 API 필드는
 * 필요 없고 이미 오는 positions[].games 를 나누기만 합니다. 표본 크기는 화면에서
 * 사라지지만 aria-label 에는 게임 수가 그대로 남습니다(목업 §08). */
export function GlobalBuildStatsPositionTabs({ position, positionGames, helpers, onPositionChange }: {
  position: LolChampionBuildStatsPosition;
  positionGames: Map<string, number> | undefined;
  helpers: Pick<GlobalBuildStatsHelpers, "positionLabel">;
  onPositionChange: (position: LolChampionBuildStatsPosition) => void;
}) {
  const totalGames = positionGames
    ? LOL_CHAMPION_BUILD_STATS_POSITIONS.reduce((sum, entry) => sum + (positionGames.get(entry) ?? 0), 0)
    : 0;
  return (
    <div aria-label={t().globalBuildStatsPositionTabs} className="public-gbs-tabs" role="tablist">
      {LOL_CHAMPION_BUILD_STATS_POSITIONS.map((entry) => {
        const games = positionGames?.get(entry) ?? 0;
        /* 반올림 합이 99.9% 가 되는 것은 자리올림 잔차이고 보정하지 않습니다. */
        const share = totalGames > 0 ? (games * 100) / totalGames : 0;
        const shareText = share.toFixed(1);
        const label = helpers.positionLabel(entry);
        const ariaLabel = games === 0
          ? fill(t().globalBuildStatsPositionNoGames, { position: label, share: shareText })
          : fill(t().globalBuildStatsPositionGames, { position: label, share: shareText, count: games });
        return (
          <button
            aria-controls="public-gbs-body"
            aria-label={positionGames ? ariaLabel : label}
            aria-selected={entry === position}
            className="public-gbs-tab"
            key={entry}
            onClick={() => onPositionChange(entry)}
            role="tab"
            type="button"
          >
            <PositionIcon position={entry} />
            {label}
            {positionGames ? (
              <span aria-hidden="true" className="public-gbs-tab-share">
                <b className={metricToneClass(share)}>{shareText}%</b>
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}

/** 로딩·오류·표본 부족·정상 네 상태의 본문(챔피언 선택 UI 는 포함하지 않습니다). */
export function GlobalBuildStatsBody({ state, championLabel, helpers, onRetry }: {
  state: GlobalBuildStatsState;
  /** 표본 부족 문구에 넣을 챔피언 표시 이름. */
  championLabel: string;
  helpers: GlobalBuildStatsHelpers;
  onRetry: () => void;
}) {
  if (state.status === "loading") {
    return (
      <div aria-busy="true" className="public-champ-empty public-gbs-loading" role="status">
        <strong>{t().globalBuildStatsLoading}</strong>
      </div>
    );
  }
  if (state.status === "error") {
    return (
      <div className="public-champ-empty public-gbs-error" role="alert">
        <strong>{t().globalBuildStatsErrorTitle}</strong>
        <span>{state.message}</span>
        <button className="public-sig-view public-gbs-retry" onClick={onRetry} type="button">{t().globalBuildStatsRetry}</button>
      </div>
    );
  }
  if (state.data.sampleInsufficient) {
    return (
      <div className="public-champ-empty public-gbs-insufficient" role="status">
        <strong>{t().globalBuildStatsInsufficientTitle}</strong>
        <span>
          {fill(t().globalBuildStatsInsufficientDescription, {
            position: helpers.positionLabel(state.data.teamPosition),
            name: championLabel,
            count: state.data.totalGames,
            min: LOL_CHAMPION_BUILD_STATS_MIN_TOTAL_GAMES
          })}
        </span>
      </div>
    );
  }
  return <ReadyColumns data={state.data} helpers={helpers} />;
}

/** 상단 알약 문구("전체 유저 · 패치 X · 솔로랭크") — 패치가 확인되기 전에는 축약형. */
export function globalBuildStatsPillText(data: LolChampionBuildStatsResponse | undefined): string {
  return data ? fill(t().globalBuildStatsPill, { patch: data.patch }) : t().globalBuildStatsPillPending;
}

export type GlobalBuildStatsViewProps = {
  candidates: GlobalBuildStatsCandidate[];
  selectedChampion: LolChampionSummary | undefined;
  position: LolChampionBuildStatsPosition;
  state: GlobalBuildStatsState;
  helpers: GlobalBuildStatsHelpers;
  onChampionChange: (championId: number) => void;
  onPositionChange: (position: LolChampionBuildStatsPosition) => void;
  onRetry: () => void;
};

/** 순수 표시 컴포넌트 — 상태를 props 로 받아 로딩/오류/표본부족/정상을 그립니다. */
export function GlobalBuildStatsView({
  candidates,
  selectedChampion,
  position,
  state,
  helpers,
  onChampionChange,
  onPositionChange,
  onRetry
}: GlobalBuildStatsViewProps) {
  const ready = state.status === "ready" ? state.data : undefined;
  const positionGames = ready
    ? new Map(ready.positions.map((entry) => [entry.teamPosition, entry.games]))
    : undefined;

  const head = (
    <div className="public-champ-head">
      <h2>{t().globalBuildStatsTitle}</h2>
      <span className="public-champ-pill">{globalBuildStatsPillText(ready)}</span>
    </div>
  );

  if (candidates.length === 0 || !selectedChampion) {
    return (
      <section className="public-champ-panel public-gbs-panel" id="public-global-build-stats">
        {head}
        <div className="public-champ-empty">
          <strong>{t().globalBuildStatsNoChampionTitle}</strong>
          <span>{t().globalBuildStatsNoChampionDescription}</span>
        </div>
      </section>
    );
  }

  return (
    <section className="public-champ-panel public-gbs-panel" id="public-global-build-stats">
      {head}
      <div className="public-gbs-controls">
        <div aria-label={t().globalBuildStatsChampionPicker} className="public-gbs-champs" role="group">
          {candidates.map((candidate) => {
            const name = helpers.championName(candidate.champion);
            const selected = candidate.champion.championId === selectedChampion.championId;
            return (
              <button
                aria-pressed={selected}
                className="public-gbs-champ"
                key={candidate.champion.championId}
                onClick={() => onChampionChange(candidate.champion.championId)}
                type="button"
              >
                <span className="public-gbs-champ-ava">
                  {candidate.champion.iconUrl ? <img alt="" src={helpers.assetUrl(candidate.champion.iconUrl)} /> : <span>{name.slice(0, 1)}</span>}
                </span>
                <b>{name}</b>
              </button>
            );
          })}
        </div>
        <GlobalBuildStatsPositionTabs
          helpers={helpers}
          onPositionChange={onPositionChange}
          position={position}
          positionGames={positionGames}
        />
      </div>
      <div id="public-gbs-body" role="tabpanel">
        <GlobalBuildStatsBody
          championLabel={helpers.championName(selectedChampion)}
          helpers={helpers}
          onRetry={onRetry}
          state={state}
        />
      </div>
      <p className="public-sig-foot">{t().globalBuildStatsFoot}</p>
    </section>
  );
}

/** 데이터 컨테이너 — 챔피언/포지션 선택 상태와 fetch(취소 포함)를 소유합니다. */
export function GlobalBuildStatsPanel({ profile, helpers }: { profile: PublicLolProfile; helpers: GlobalBuildStatsHelpers }) {
  const candidates = useMemo(() => globalBuildStatsCandidates(profile), [profile]);
  const [championId, setChampionId] = useState<number | undefined>(candidates[0]?.champion.championId);
  const [position, setPosition] = useState<LolChampionBuildStatsPosition>(() =>
    candidates[0] ? defaultBuildStatsPosition(profile, candidates[0].champion.championId) : "MIDDLE"
  );
  const [state, setState] = useState<GlobalBuildStatsState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  /* 프로필이 바뀌어 후보에 없는 챔피언이 남아 있으면 첫 후보로 되돌립니다. */
  const selectedChampion = candidates.find((candidate) => candidate.champion.championId === championId)?.champion;
  useEffect(() => {
    if (selectedChampion || candidates.length === 0) return;
    const first = candidates[0]!.champion.championId;
    setChampionId(first);
    setPosition(defaultBuildStatsPosition(profile, first));
  }, [candidates, profile, selectedChampion]);

  /* 의존성은 id 로 둡니다 — 전적 추가 로드·라이브 상태 갱신으로 profile 객체가 바뀌어도
     같은 챔피언·포지션이면 다시 요청하지 않습니다. */
  const selectedChampionId = selectedChampion?.championId;
  useEffect(() => {
    if (selectedChampionId === undefined) return;
    const controller = new AbortController();
    setState({ status: "loading" });
    fetchChampionBuildStats(selectedChampionId, position, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ status: "ready", data });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        setState({ status: "error", message: error instanceof Error && error.message ? error.message : t().globalBuildStatsErrorTitle });
      });
    return () => controller.abort();
  }, [selectedChampionId, position, attempt]);

  return (
    <GlobalBuildStatsView
      candidates={candidates}
      helpers={helpers}
      onChampionChange={(nextChampionId) => {
        if (nextChampionId === championId) return;
        setChampionId(nextChampionId);
        setPosition(defaultBuildStatsPosition(profile, nextChampionId));
      }}
      onPositionChange={setPosition}
      onRetry={() => setAttempt((value) => value + 1)}
      position={position}
      selectedChampion={selectedChampion}
      state={state}
    />
  );
}
