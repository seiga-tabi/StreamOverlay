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
 * 포지션 탭은 5개 라인을 항상 보여주되 표본 수를 함께 적어 빈 탭을 예고합니다.
 * 기본 포지션은 이 프로필이 그 챔피언을 가장 많이 플레이한 라인입니다. */

export const GLOBAL_BUILD_STATS_MAX_CANDIDATES = 6;
export const GLOBAL_BUILD_STATS_ITEM_SLOTS = 6;

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

function rateLine(winRate: number | undefined): string {
  return winRate === undefined ? t().globalBuildStatsWinRateHidden : fill(t().globalBuildStatsWinRate, { rate: rateText(winRate) });
}

function pickLine(pickRate: number, games: number): string {
  return `${fill(t().globalBuildStatsPickRate, { rate: rateText(pickRate) })} · ${fill(t().globalBuildStatsGamesCount, { count: games })}`;
}

function BuildCardHead({ index, children, pickRate, games, winRate }: {
  index: number;
  children: ReactNode;
  pickRate: number;
  games: number;
  winRate: number | undefined;
}) {
  return (
    <>
      <div className="public-sig-build-head">
        <span className="public-sig-build-no">{fill(t().globalBuildStatsRank, { n: index + 1 })}</span>
        {children}
        <span className="public-sig-build-pick">
          <b>{pickLine(pickRate, games)}</b>
          <small>{rateLine(winRate)}</small>
        </span>
      </div>
      <span aria-hidden="true" className="public-sig-build-bar"><i style={{ width: `${Math.min(100, Math.max(0, pickRate))}%` }} /></span>
    </>
  );
}

function ColumnOther({ games }: { games: number }) {
  if (games <= 0) return null;
  return <span className="public-sig-other">{fill(t().globalBuildStatsOther, { count: games })}</span>;
}

function ReadyColumns({ data, helpers }: { data: LolChampionBuildStatsReadyResponse; helpers: GlobalBuildStatsHelpers }) {
  return (
    <>
      <div className="public-gbs-summary">
        <b>{rateText(data.winRate)}%</b>
        <small>{fill(t().globalBuildStatsSummary, { count: data.totalGames, rate: rateText(data.winRate) })}</small>
      </div>
      <div className="public-gbs-grid">
        <section className="public-gbs-col" aria-labelledby="public-gbs-runes-title">
          <h3 className="public-gbs-col-title" id="public-gbs-runes-title">{t().globalBuildStatsRunesTitle}</h3>
          {data.runeGroups.length === 0 ? <p className="public-gbs-col-empty">{t().globalBuildStatsColumnEmpty}</p> : null}
          {data.runeGroups.map((group, index) => {
            const keystoneName = buildStatsAssetName(group.keystone, `#${group.keystonePerkId}`);
            const styleNames = [
              group.primaryStyleId > 0 ? buildStatsAssetName(group.primaryStyle, `#${group.primaryStyleId}`) : "",
              group.subStyleId > 0 ? buildStatsAssetName(group.subStyle, `#${group.subStyleId}`) : ""
            ].filter(Boolean).join(" + ");
            return (
              <div className={`public-sig-build${index > 0 ? " is-alt" : ""}`} key={group.key}>
                <BuildCardHead games={group.games} index={index} pickRate={group.pickRate} winRate={group.winRate}>
                  <span className="public-sig-rune">
                    <span className="public-sig-keystone">
                      {group.keystone?.iconUrl ? <img alt="" src={helpers.assetUrl(group.keystone.iconUrl)} /> : <span>{keystoneName.slice(0, 2)}</span>}
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
          <ColumnOther games={data.otherRuneGames} />
        </section>

        <section className="public-gbs-col" aria-labelledby="public-gbs-items-title">
          <h3 className="public-gbs-col-title" id="public-gbs-items-title">{t().globalBuildStatsItemsTitle}</h3>
          {data.itemGroups.length === 0 ? <p className="public-gbs-col-empty">{t().globalBuildStatsColumnEmpty}</p> : null}
          {data.itemGroups.map((group, index) => {
            const items = group.itemIds.map((itemId) => group.items?.find((item) => item.id === itemId) ?? { id: itemId });
            return (
              <div className={`public-sig-build${index > 0 ? " is-alt" : ""}`} key={group.key}>
                <BuildCardHead games={group.games} index={index} pickRate={group.pickRate} winRate={group.winRate}>
                  <span className="public-sig-rune" />
                </BuildCardHead>
                <div className="public-sig-items">
                  {items.map((item) => (
                    <span className="public-sig-item" key={item.id} title={buildStatsAssetName(item, `#${item.id}`)}>
                      <i>{item.iconUrl ? <img alt={buildStatsAssetName(item, `#${item.id}`)} src={helpers.assetUrl(item.iconUrl)} /> : buildStatsAssetName(item, `#${item.id}`).slice(0, 4)}</i>
                    </span>
                  ))}
                  {Array.from({ length: Math.max(0, GLOBAL_BUILD_STATS_ITEM_SLOTS - items.length) }, (_, slot) => (
                    <span aria-hidden="true" className="public-sig-item is-empty" key={`empty:${slot}`}>
                      <i />
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
          <ColumnOther games={data.otherItemGames} />
        </section>

        <section className="public-gbs-col" aria-labelledby="public-gbs-spells-title">
          <h3 className="public-gbs-col-title" id="public-gbs-spells-title">{t().globalBuildStatsSpellsTitle}</h3>
          {data.spellGroups.length === 0 ? <p className="public-gbs-col-empty">{t().globalBuildStatsColumnEmpty}</p> : null}
          {data.spellGroups.map((group, index) => (
            <div className={`public-sig-build${index > 0 ? " is-alt" : ""}`} key={group.key}>
              <BuildCardHead games={group.games} index={index} pickRate={group.pickRate} winRate={group.winRate}>
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
          <ColumnOther games={data.otherSpellGames} />

          <h3 className="public-gbs-col-title" id="public-gbs-positions-title">{t().globalBuildStatsPositionsTitle}</h3>
          <div className="public-gbs-positions" aria-labelledby="public-gbs-positions-title" role="list">
            {data.positions.map((entry) => (
              <div className="public-champ-role-cell" key={entry.teamPosition} role="listitem">
                <span className="public-champ-role-name">
                  <b>{helpers.positionLabel(entry.teamPosition)}</b>
                  {entry.teamPosition === data.teamPosition ? <i aria-hidden="true">●</i> : null}
                </span>
                <span className="public-champ-role-stat">
                  {entry.winRate === undefined ? t().globalBuildStatsWinRateHidden : <b>{formatPercent(entry.winRate)}</b>}
                  {" · "}{fill(t().globalBuildStatsGamesCount, { count: entry.games })}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </>
  );
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
  const positionGames = new Map((ready?.positions ?? []).map((entry) => [entry.teamPosition, entry.games]));
  const pill = ready
    ? fill(t().globalBuildStatsPill, { patch: ready.patch })
    : t().globalBuildStatsPillPending;

  const head = (
    <div className="public-champ-head">
      <h2>{t().globalBuildStatsTitle}</h2>
      <span className="public-champ-pill">{pill}</span>
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

  let body: ReactNode;
  if (state.status === "loading") {
    body = (
      <div aria-busy="true" className="public-champ-empty public-gbs-loading" role="status">
        <strong>{t().globalBuildStatsLoading}</strong>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <div className="public-champ-empty public-gbs-error" role="alert">
        <strong>{t().globalBuildStatsErrorTitle}</strong>
        <span>{state.message}</span>
        <button className="public-sig-view public-gbs-retry" onClick={onRetry} type="button">{t().globalBuildStatsRetry}</button>
      </div>
    );
  } else if (state.data.sampleInsufficient) {
    body = (
      <div className="public-champ-empty public-gbs-insufficient" role="status">
        <strong>{t().globalBuildStatsInsufficientTitle}</strong>
        <span>
          {fill(t().globalBuildStatsInsufficientDescription, {
            position: helpers.positionLabel(state.data.teamPosition),
            name: helpers.championName(selectedChampion),
            count: state.data.totalGames,
            min: LOL_CHAMPION_BUILD_STATS_MIN_TOTAL_GAMES
          })}
        </span>
      </div>
    );
  } else {
    body = <ReadyColumns data={state.data} helpers={helpers} />;
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
        <div aria-label={t().globalBuildStatsPositionTabs} className="public-gbs-tabs" role="tablist">
          {LOL_CHAMPION_BUILD_STATS_POSITIONS.map((entry) => {
            const games = positionGames.get(entry);
            const label = helpers.positionLabel(entry);
            const ariaLabel = games === undefined || games === 0
              ? fill(t().globalBuildStatsPositionNoGames, { position: label })
              : fill(t().globalBuildStatsPositionGames, { position: label, count: games });
            return (
              <button
                aria-controls="public-gbs-body"
                aria-label={ready ? ariaLabel : label}
                aria-selected={entry === position}
                className="public-gbs-tab"
                key={entry}
                onClick={() => onPositionChange(entry)}
                role="tab"
                type="button"
              >
                {label}
                {ready ? <small aria-hidden="true">{games ?? 0}</small> : null}
              </button>
            );
          })}
        </div>
      </div>
      <div id="public-gbs-body" role="tabpanel">{body}</div>
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
