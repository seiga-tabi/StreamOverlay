import { useEffect, useMemo, useState, type MouseEvent } from "react";
import type { LolChampionSummary } from "@streamops/shared";
import { NorigaeMark, TailUnderline } from "../../public-home/components/HomeMarks";
import { Button } from "../../../shared/ui/Button";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { Input } from "../../../shared/ui/Form";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { getPublicLolChampions } from "../api/lol";
import { publicIntlLocale, t } from "../i18n/public-lol-i18n";
import { championName } from "../utils/champion";
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
 * 정렬은 현재 언어 기준 이름순(가나다·五十音)을 유지합니다. */

const CHAMPION_LIST_SKELETON_CARDS = 8;

type LoadState = "loading" | "ready" | "error";

function fill(template: string, values: Record<string, string | number>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.split(`{${key}}`).join(String(value)), template);
}

/* 카드는 <a> 라 새 탭 열기·주소 복사가 그대로 됩니다(목업 §04). 평범한 좌클릭만
   가로채 SPA 이동으로 바꿉니다 — 수식키가 눌렸으면 브라우저 기본 동작에 맡깁니다. */
function isPlainLeftClick(event: MouseEvent<HTMLAnchorElement>): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function PublicChampionListPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [champions, setChampions] = useState<LolChampionSummary[]>([]);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");

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

  /* 이름순 정렬은 현재 언어의 Collator 로 합니다 — ko 는 가나다, ja 는 五十音 순입니다. */
  const sortedChampions = useMemo(() => {
    const collator = new Intl.Collator(publicIntlLocale());
    return [...champions].sort((a, b) => collator.compare(championName(a), championName(b)));
  }, [champions]);

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
            {visibleChampions.map((champion) => {
              const name = championName(champion);
              const detailPath = publicChampionDetailPath(champion.championId);
              return (
                <a
                  aria-label={fill(t().championListCardHint, { name })}
                  className="public-champion-card"
                  href={localizedPublicUrlForCurrentLocale(detailPath)}
                  key={champion.championId}
                  onClick={(event) => {
                    if (!isPlainLeftClick(event)) return;
                    event.preventDefault();
                    setPublicPath(detailPath);
                  }}
                >
                  <span aria-hidden="true" className="public-champion-card-icon">
                    {champion.iconUrl ? (
                      <img alt="" decoding="async" height="64" loading="lazy" src={champion.iconUrl} width="64" />
                    ) : (
                      <span>{name.slice(0, 1)}</span>
                    )}
                  </span>
                  <span className="public-champion-card-copy">
                    <span className="public-champion-card-name">{name}</span>
                  </span>
                </a>
              );
            })}
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
