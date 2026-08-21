import { useEffect, useMemo, useState } from "react";
import { parseAramAugmentCatalog, type AramAugmentCatalog, type AramAugmentRarity } from "@streamops/shared";
import { NorigaeMark, TailUnderline } from "../../public-home/components/HomeMarks";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardHeader } from "../../../shared/ui/Card";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { Input } from "../../../shared/ui/Form";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { publicIntlLocale, activePublicLocale, t } from "../i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../utils/public-locale-path";
import { PUBLIC_LOL_HOME_PATH } from "../utils/routes";

type LoadState = "loading" | "ready" | "error";

/* 준비 중 아이콘 — ◇ 글리프는 폰트마다 모양·정렬이 달라 stroke SVG 로(전환 §2-6). */
function CrystalIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="24" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 24 24" width="24">
      <path d="M12 2 L 19 7 V 15 L 12 22 L 5 15 V 7 Z" />
      <path d="M12 6 L 15.5 8.6 V 13.6 L 12 17.4 L 8.5 13.6 V 8.6 Z" opacity=".55" strokeWidth="1" />
    </svg>
  );
}

/* 「이 증강 쓴 경기」 화살표 — → 글리프 대신 stroke SVG(전환 §2-6). */
function JumpArrowIcon() {
  return (
    <svg aria-hidden="true" fill="none" height="10" stroke="currentColor" strokeWidth="1.2" viewBox="0 0 12 12" width="10">
      <path d="M1.5 6 H 10" />
      <path d="M6.5 2.5 L 10 6 L 6.5 9.5" />
    </svg>
  );
}

/* 등급 배지에 "silver" 같은 원문 값이 그대로 보이고 있었습니다. */
function rarityLabel(value: AramAugmentRarity): string {
  if (value === "gold") return t().aramRarityGold;
  if (value === "prismatic") return t().aramRarityPrismatic;
  if (value === "legend") return t().aramRarityLegend;
  return t().aramRaritySilver;
}

/* 이 페이지에서 나갈 곳이 개인정보·약관·문의뿐이었습니다.
   증강을 보러 온 사람이 다른 기능을 만날 경로를 둡니다. */
function AramExits() {
  return (
    <nav aria-labelledby="public-aram-exits-title" className="yoro-aram-exits-block">
      <p className="yoro-aram-exits-title" id="public-aram-exits-title">{t().aramExitsTitle}</p>
      <ul className="yoro-aram-exits">
        <li>
          <a className="yoro-aram-exit" href={localizedPublicUrlForCurrentLocale(PUBLIC_LOL_HOME_PATH)}>
            <b>{t().aramExitMatchTitle}</b>
            <small>{t().aramExitMatchDescription}</small>
          </a>
        </li>
        <li>
          <a className="yoro-aram-exit" href={localizedPublicUrlForCurrentLocale("/participation")}>
            <b>{t().aramExitParticipationTitle}</b>
            <small>{t().aramExitParticipationDescription}</small>
          </a>
        </li>
        <li>
          <a className="yoro-aram-exit" href={localizedPublicUrlForCurrentLocale("/follow")}>
            <b>{t().aramExitStreamerTitle}</b>
            <small>{t().aramExitStreamerDescription}</small>
          </a>
        </li>
      </ul>
    </nav>
  );
}

async function requestCatalog(signal: AbortSignal): Promise<AramAugmentCatalog> {
  const response = await fetch("/api/public/aram/augments", {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
    signal
  });
  if (!response.ok) throw new Error(t().aramLoadFailed);
  const catalog = parseAramAugmentCatalog(await response.json());
  if (!catalog) throw new Error(t().aramInvalidData);
  return catalog;
}

export function PublicAramPage({ augmentStats, onFilterAugment }: {
  /** 결합 ② — 검색된 소환사의 증강별 픽·승(숫자 cdragonId 키). 없으면 배지 생략. */
  augmentStats?: Map<number, { picks: number; wins: number }>;
  /** 결합 ③ — "이 증강 쓴 경기" 클릭 시 전적 화면에 증강 필터를 적용합니다. */
  onFilterAugment?: (augmentId: number) => void;
} = {}) {
  const [state, setState] = useState<LoadState>("loading");
  const [catalog, setCatalog] = useState<AramAugmentCatalog>();
  const [error, setError] = useState("");
  /* 전적 카드의 증강 아이콘 딥링크(?augment=이름) 수신 — 도감이 해당 증강으로 필터된 채 열립니다. */
  const [query, setQuery] = useState(() =>
    new URLSearchParams(window.location.search).get("augment")?.trim() ?? "");
  const [rarity, setRarity] = useState<AramAugmentRarity | "all">("all");

  function load(): AbortController {
    const controller = new AbortController();
    setState("loading");
    setError("");
    void requestCatalog(controller.signal)
      .then((nextCatalog) => {
        if (controller.signal.aborted) return;
        setCatalog(nextCatalog);
        setState("ready");
      })
      .catch((requestError) => {
        if (controller.signal.aborted) return;
        setError(requestError instanceof Error ? requestError.message : t().aramLoadFailed);
        setState("error");
      });
    return controller;
  }

  useEffect(() => {
    const controller = load();
    return () => controller.abort();
  }, []);

  const visibleAugments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase(publicIntlLocale());
    return (catalog?.augments ?? []).filter((augment) => {
      if (rarity !== "all" && augment.rarity !== rarity) return false;
      if (!normalizedQuery) return true;
      return [augment.id, augment.nameKo, augment.nameJa, augment.descriptionKo, augment.descriptionJa]
        .some((value) => value.toLocaleLowerCase(publicIntlLocale()).includes(normalizedQuery));
    });
  }, [catalog, query, rarity]);

  return (
    <section className="public-aram-page" aria-labelledby="public-aram-title">
      {/* 페이지 머리 — 노리개 + 명조 제목 + 붓 밑줄(목업 LolAram · 전환 §2-4).
          공유 PageHeader 를 재스타일하면 다른 화면이 함께 바뀌므로 전용 마크업
          (패치 노트 .yoro-pn-head 와 같은 방식). 마크는 HomeMarks 재사용. */}
      <header className="yoro-aram-head">
        <NorigaeMark className="yoro-aram-head-norigae" height={34} width={16} />
        <div className="yoro-aram-head-copy">
          <p className="yoro-aram-head-eyebrow">{t().aramEyebrow}</p>
          <h1 className="yoro-aram-head-title" id="public-aram-title">
            <span className="yoro-aram-head-title-word">
              {t().aramTitle}
              <TailUnderline className="yoro-aram-head-tail" height={9} width={118} />
            </span>
          </h1>
          <p className="yoro-aram-head-desc">{t().aramDescription}</p>
        </div>
        <div className="yoro-aram-head-status">
          <Badge tone={catalog?.status === "ready" ? "success" : "neutral"}>
            {catalog?.status === "ready" ? t().aramReady : t().aramPreparing}
          </Badge>
        </div>
      </header>

      {state === "loading" ? (
        <div className="public-aram-loading" role="status" aria-label={t().aramLoading} aria-busy="true">
          <SkeletonCard loadingLabel={t().aramLoading} />
          <SkeletonCard loadingLabel={t().aramLoading} />
        </div>
      ) : null}

      {state === "error" ? (
        <EmptyState variant="error" as="div" role="alert">
          <EmptyStateIcon>!</EmptyStateIcon>
          <EmptyStateTitle as="h2">{t().aramLoadFailed}</EmptyStateTitle>
          <EmptyStateDescription>{error}</EmptyStateDescription>
          <EmptyStateActions>
            <Button type="button" variant="secondary" onClick={() => load()}>{t().aramRetry}</Button>
          </EmptyStateActions>
        </EmptyState>
      ) : null}

      {state === "ready" && catalog?.status === "preparing" ? (
        <EmptyState variant="default" as="div">
          <EmptyStateIcon aria-hidden="true"><CrystalIcon /></EmptyStateIcon>
          <EmptyStateTitle as="h2">{t().aramPreparingTitle}</EmptyStateTitle>
          <EmptyStateDescription>{t().aramPreparingDescription}</EmptyStateDescription>
        </EmptyState>
      ) : null}

      {state === "ready" && catalog?.status === "preparing" ? <AramExits /> : null}

      {state === "ready" && catalog?.status === "ready" ? (
        <>
          <div className="public-aram-toolbar">
            <Input
              value={query}
              maxLength={80}
              aria-label={t().aramSearchLabel}
              placeholder={t().aramSearchPlaceholder}
              onChange={(event) => setQuery(event.currentTarget.value)}
            />
            <div className="public-aram-rarity" role="group" aria-label={t().aramRarityLabel}>
              {(["all", "silver", "gold", "prismatic", "legend"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  /* 채운(primary 보라) 버튼 금지 — 활성은 CSS 가 aria-pressed 로
                     진한 테두리 + 700 만 줍니다(전환 §2-2, 목업 qchip 문법). */
                  variant="tertiary"
                  aria-pressed={rarity === value}
                  onClick={() => setRarity(value)}
                >
                  {value === "all" ? t().aramRarityAll : rarityLabel(value)}
                </Button>
              ))}
            </div>
          </div>
          <div className="public-aram-grid" aria-live="polite">
            {visibleAugments.map((augment) => (
              <Card className={`public-aram-card rarity-${augment.rarity}`} key={augment.id}>
                <CardHeader>
                  <div className="public-aram-card-heading">
                    {augment.iconUrl ? (
                      <img
                        className="public-aram-card-icon"
                        src={augment.iconUrl}
                        alt=""
                        width="48"
                        height="48"
                        loading="lazy"
                        decoding="async"
                        aria-hidden="true"
                      />
                    ) : null}
                    <div className="public-aram-card-heading-copy">
                      <Badge tone="neutral">{rarityLabel(augment.rarity)}</Badge>
                      {/* CardTitle 도 04-followers.css:671 의 !important 에 걸립니다. */}
                      <h2 className="yoro-aram-name">
                        {activePublicLocale === "ja" ? augment.nameJa : augment.nameKo}
                      </h2>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* CardDescription 을 쓰면 04-followers.css 의
                      `.public-dashboard-shell .yoro-card__description { color: ... !important }`
                      에 걸려 카드 배경과 같은 밝기가 됩니다(실측 1.03:1).
                      legacy !important 는 pages layer 로 이길 수 없어 새 이름을 씁니다. */}
                  <p className="yoro-aram-desc">
                    {activePublicLocale === "ja" ? augment.descriptionJa : augment.descriptionKo}
                  </p>
                  {/* 결합 ② — 카탈로그 cdragonId 와 전적의 숫자 id 가 정확히 조인될 때만 표시(추측 매칭 금지) */}
                  {(() => {
                    const stat = augment.cdragonId !== undefined ? augmentStats?.get(augment.cdragonId) : undefined;
                    if (!stat) return null;
                    return (
                      <p className="yoro-aram-mine" data-testid="aram-augment-mine">
                        {t().aramMineStat
                          .replace("{picks}", String(stat.picks))
                          .replace("{rate}", String(Math.round((stat.wins / stat.picks) * 100)))}
                        {onFilterAugment && augment.cdragonId !== undefined ? (
                          <button
                            className="yoro-aram-mine-jump"
                            onClick={() => onFilterAugment(augment.cdragonId as number)}
                            type="button"
                          >
                            {t().aramMineJump.replace("{count}", String(stat.picks))}
                            <JumpArrowIcon />
                          </button>
                        ) : null}
                      </p>
                    );
                  })()}
                </CardContent>
              </Card>
            ))}
          </div>
          {visibleAugments.length === 0 ? (
            <EmptyState variant="search" as="div">
              <EmptyStateTitle as="h2">{t().aramNoResults}</EmptyStateTitle>
              <EmptyStateDescription>{t().aramNoResultsDescription}</EmptyStateDescription>
            </EmptyState>
          ) : null}
          <AramExits />
        </>
      ) : null}
    </section>
  );
}
