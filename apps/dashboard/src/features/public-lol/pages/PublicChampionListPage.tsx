import { Fragment, useEffect, useMemo, useState, type MouseEvent } from "react";
import type { LolChampionSummary } from "@streamops/shared";
import { NorigaeMark, TailUnderline } from "../../public-home/components/HomeMarks";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { Input } from "../../../shared/ui/Form";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { PatchDirectionBadge, type PatchDirection } from "../components/PatchDirectionBadge";
import { getPublicLolChampions } from "../api/lol";
import { patchNoteLocale, requestPatchChangeSummary, requestPatchNotes } from "../api/patch-notes";
import { publicIntlLocale, t } from "../i18n/public-lol-i18n";
import { championName } from "../utils/champion";
import { latestPatchVersion } from "../utils/patch-version";
import { localizedPublicUrlForCurrentLocale } from "../utils/public-locale-path";
import { publicChampionDetailPath, setPublicPath } from "../utils/routes";

/* 전체 챔피언 목록(/lol/champions) — 목업 `docs/mockups/lol-champion-list.approved-spec.html`.
 *
 * 시각 문법·상태 관리는 증강 도감(PublicAramPage)을 그대로 계승합니다.
 * 목업의 역할 필터(탑·정글·미드·원딜·서포터)와 "최근 업데이트순" 정렬은 이번 범위에
 * 없습니다 — Data Dragon 챔피언 데이터에 대표 라인도 패치 반영 시각도 없어서,
 * 목업 §08 이 미리 정해 둔 대로(데이터가 없으면 필터를 이번 범위에서 뺀다) 걷어냈습니다.
 * 추정값으로 채우면 화면이 사실이 아닌 것을 말하게 됩니다. 역할 축이 필요해지면
 * 전적 집계(lol_champion_match_builds)의 포지션 분포를 내려주는 별도 계약이
 * 선행돼야 합니다.
 *
 * 정렬은 현재 언어 기준 이름순(가나다·五十音)이 기본이고, 그 앞에 "최신 패치에서
 * 버프·너프된 챔피언" 그룹 한 겹만 얹습니다 — 목업
 * `docs/mockups/lol-champion-buff-nerf.approved-spec.html` §03 배치안 1. 그룹 안 순서는
 * 지금과 똑같은 이름순이라, 변경 없는 챔피언끼리의 상대 순서는 한 칸도 달라지지 않습니다. */

const CHAMPION_LIST_SKELETON_CARDS = 8;

type LoadState = "loading" | "ready" | "error";

/* 배지를 만드는 방향은 버프·너프 둘뿐입니다 — adjust 는 이번 범위 밖이라
   배지도, 정렬 우선순위도 받지 않습니다(목업 §07). 배지 자체(18×18 삼각형)는
   챔피언 상세의 스킬 행과 공유합니다 — PatchDirectionBadge. */

type ChampionGroup = {
  key: string;
  label?: string;
  champions: LolChampionSummary[];
};

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

/* 카드는 <a> 라 새 탭 열기·주소 복사가 그대로 됩니다(목업 §04). 평범한 좌클릭만
   가로채 SPA 이동으로 바꿉니다 — 수식키가 눌렸으면 브라우저 기본 동작에 맡깁니다. */
function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PublicChampionListPage({ locale }: { locale: string }) {
  const [state, setState] = useState<LoadState>("loading");
  const [champions, setChampions] = useState<LolChampionSummary[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  /* 최신 패치의 championId → 버프·너프. 비어 있으면 배지도 그룹 정렬도 없습니다. */
  const [patchDirections, setPatchDirections] = useState<ReadonlyMap<number, PatchDirection>>(new Map());
  const [patchVersion, setPatchVersion] = useState<string>();

  function load(): AbortController {
    const controller = new AbortController();
    setState("loading");
    setError("");
    void getPublicLolChampions(controller.signal)
      .then((response) => {
        if (controller.signal.aborted) return;
        setChampions(response.champions);
        setState("ready");
      })
      .catch((requestError: unknown) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error && requestError.message ? requestError.message : t().championListErrorTitle);
        setState("error");
      });
    return controller;
  }

  useEffect(() => {
    const controller = load();
    return () => controller.abort();
  }, []);

  /* 최신 패치의 버프/너프 — 목록 자체와 완전히 분리된 부가 정보라 fail-soft 입니다.
     패치 노트 피드나 변경 요약 계약이 없는 배포에서도 오류를 화면에 올리지 않고
     배지·그룹 정렬만 조용히 사라집니다(목업 §07, requestPatchChangeSummary 계약). */
  useEffect(() => {
    const controller = new AbortController();
    const feedLocale = patchNoteLocale(locale);
    void (async () => {
      try {
        const feed = await requestPatchNotes(feedLocale, controller.signal);
        /* 피드가 최신순이라는 사실에 기대지 않고 패치 번호 자체로 최신을 고릅니다. */
        const latest = latestPatchVersion(feed.notes);
        if (!latest) return;
        const summary = await requestPatchChangeSummary(latest, feedLocale, controller.signal);
        if (!summary || controller.signal.aborted) return;
        const directions = new Map<number, PatchDirection>();
        for (const change of summary.championChanges) {
          if (change.direction === "adjust") continue;
          directions.set(change.championId, change.direction);
        }
        if (directions.size === 0) return;
        setPatchDirections(directions);
        setPatchVersion(summary.patchVersion);
      } catch {
        /* 취소·네트워크·형식 오류 모두 배지 없는 기존 화면으로 끝냅니다. */
      }
    })();
    return () => controller.abort();
  }, [locale]);

  /* 이름순 정렬은 현재 언어의 Collator 로 합니다 — ko 는 가나다, ja 는 五十音 순입니다. */
  const sortedChampions = useMemo(() => {
    const collator = new Intl.Collator(publicIntlLocale());
    return [...champions].sort((a, b) => collator.compare(championName(a), championName(b)));
  }, [champions]);

  const searching = query.trim().length > 0;

  const visibleChampions = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(publicIntlLocale());
    if (!normalizedQuery) return sortedChampions;
    /* 검색은 현재 언어 이름뿐 아니라 ko/ja/en 표기와 championKey 를 모두 봅니다 —
       한국어 화면에서 "ahri" 로도 찾을 수 있어야 합니다. */
    return sortedChampions.filter((champion) => [
      champion.nameKo,
      champion.nameJa,
      champion.nameEn,
      champion.championKey
    ].some((value) => value?.toLocaleLowerCase(publicIntlLocale()).includes(normalizedQuery)));
  }, [query, sortedChampions]);

  /* 정렬 키는 (패치 변경 여부, 이름) 튜플입니다 — 이름 순서는 그대로 두고 앞에
     그룹 한 겹만 얹으므로, 이름 정렬된 목록을 두 덩이로 가르면 같은 결과입니다(목업 §03).
     검색 중에는 이 그룹을 끕니다 — 검색 결과에 "패치 변경 우선"이 섞이면 왜 이 순서인지가
     두 겹이 되어 이름으로 찾는 흐름이 오히려 흔들립니다. */
  const championGroups = useMemo<ChampionGroup[]>(() => {
    const plain: ChampionGroup[] = [{ key: "all", champions: visibleChampions }];
    if (searching || !patchVersion || patchDirections.size === 0) return plain;
    const changed = visibleChampions.filter((champion) => patchDirections.has(champion.championId));
    const unchanged = visibleChampions.filter((champion) => !patchDirections.has(champion.championId));
    /* 한쪽이 비면 구분선이 경계가 아니라 장식이 됩니다 — 그때는 한 덩이로 둡니다. */
    if (changed.length === 0 || unchanged.length === 0) return plain;
    return [
      { key: "changed", label: fill(t().championListPatchChangedLabel, { patchVersion }), champions: changed },
      { key: "unchanged", label: t().championListPatchUnchangedLabel, champions: unchanged }
    ];
  }, [visibleChampions, searching, patchVersion, patchDirections]);

  return (
    <section aria-labelledby="public-champions-title" className="public-champions-page">
      {/* 페이지 머리 3겹 — 노리개 + 명조 제목 + 붓 밑줄(증강 도감 .yoro-aram-head 와 같은 규격). */}
      <header className="yoro-champions-head">
        <NorigaeMark className="yoro-champions-head-norigae" height={34} width={16} />
        <div className="yoro-champions-head-copy">
          <p className="yoro-champions-head-eyebrow">{t().championListEyebrow}</p>
          <h1 className="yoro-champions-head-title" id="public-champions-title">
            {t().championListTitleLead}
            <span className="yoro-champions-head-title-word">
              {t().championListTitleWord}
              <TailUnderline className="yoro-champions-head-tail" height={9} width={92} />
            </span>
          </h1>
          <p className="yoro-champions-head-desc">{t().championListDescription}</p>
        </div>
        {state === "ready" ? (
          <span className="yoro-champions-head-status">{fill(t().championListTotal, { count: champions.length })}</span>
        ) : null}
      </header>

      {state === "loading" ? (
        <div aria-busy="true" aria-label={t().championListLoading} className="public-champions-loading" role="status">
          {Array.from({ length: CHAMPION_LIST_SKELETON_CARDS }, (_, index) => (
            <SkeletonCard key={index} size="sm" />
          ))}
        </div>
      ) : null}

      {state === "error" ? (
        <EmptyState as="div" role="alert" variant="error">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h2">{t().championListErrorTitle}</EmptyStateTitle>
          <EmptyStateDescription>{error}</EmptyStateDescription>
          <EmptyStateActions>
            <Button onClick={() => load()} type="button" variant="secondary">{t().championListRetry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}

      {state === "ready" ? (
        <>
          <div className="public-champions-toolbar">
            <Input
              aria-label={t().championListSearchLabel}
              maxLength={40}
              onChange={(event) => setQuery(event.currentTarget.value)}
              placeholder={t().championListSearchPlaceholder}
              value={query}
            />
          </div>
          {/* 결과 수를 글자로도 알립니다 — 필터가 걸렸다는 사실이 격자 길이로만 보이지 않도록. */}
          <p className="public-champions-count" role="status">
            {fill(t().championListCount, { total: champions.length, shown: visibleChampions.length })}
          </p>
          {/* 격자에는 aria-live 를 걸지 않습니다 — 168칸이 통째로 읽힙니다.
              검색 결과가 바뀌었다는 사실은 위의 결과 수 줄(role="status") 하나가 말합니다. */}
          <div className="public-champions-grid">
            {championGroups.map((group) => (
              <Fragment key={group.key}>
                {/* 구분 줄은 <p> 한 줄이라 스크린리더도 그대로 읽습니다(목업 §06). */}
                {group.label ? <p className="public-champions-groupline">{group.label}</p> : null}
                {group.champions.map((champion) => {
                  const name = championName(champion);
                  const detailPath = publicChampionDetailPath(champion.championId);
                  const direction = patchDirections.get(champion.championId);
                  /* 배지는 aria-hidden 이라(§06) 판정은 카드 aria-label 이 대신 말합니다 —
                     앵커의 aria-label 이 자식 텍스트를 전부 덮기 때문입니다. */
                  const hint = direction === "buff"
                    ? t().championListCardHintBuff
                    : direction === "nerf"
                      ? t().championListCardHintNerf
                      : t().championListCardHint;
                  return (
                    <a
                      aria-label={fill(hint, { name })}
                      className="public-champion-card"
                      href={localizedPublicUrlForCurrentLocale(detailPath)}
                      key={champion.championId}
                      onClick={(event) => {
                        if (!isPlainLeftClick(event)) return;
                        event.preventDefault();
                        setPublicPath(detailPath);
                      }}
                    >
                      <span className="public-champion-card-figure">
                        <span aria-hidden="true" className="public-champion-card-icon">
                          {champion.iconUrl ? (
                            <img alt="" decoding="async" height="64" loading="lazy" src={champion.iconUrl} width="64" />
                          ) : (
                            <span>{name.slice(0, 1)}</span>
                          )}
                        </span>
                        {direction ? <PatchDirectionBadge direction={direction} /> : null}
                      </span>
                      <span className="public-champion-card-copy">
                        <span className="public-champion-card-name">{name}</span>
                      </span>
                    </a>
                  );
                })}
              </Fragment>
            ))}
          </div>
          {visibleChampions.length === 0 ? (
            <EmptyState as="div" variant="search">
              <EmptyStateTitle as="h2">{t().championListNoResults}</EmptyStateTitle>
              <EmptyStateDescription>{t().championListNoResultsDescription}</EmptyStateDescription>
            </EmptyState>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
