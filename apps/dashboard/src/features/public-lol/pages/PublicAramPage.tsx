import { useEffect, useMemo, useState } from "react";
import { parseAramAugmentCatalog, type AramAugmentCatalog, type AramAugmentRarity } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardHeader } from "../../../shared/ui/Card";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { Input } from "../../../shared/ui/Form";
import { PageHeader, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../../../shared/ui/PageHeader";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import { localizedPublicUrlForCurrentLocale } from "../utils/public-locale-path";

type LoadState = "loading" | "ready" | "error";

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
          <a className="yoro-aram-exit" href={localizedPublicUrlForCurrentLocale("/")}>
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

export function PublicAramPage() {
  const [state, setState] = useState<LoadState>("loading");
  const [catalog, setCatalog] = useState<AramAugmentCatalog>();
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
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
    const normalizedQuery = query.trim().toLocaleLowerCase(activePublicLocale === "ja" ? "ja-JP" : "ko-KR");
    return (catalog?.augments ?? []).filter((augment) => {
      if (rarity !== "all" && augment.rarity !== rarity) return false;
      if (!normalizedQuery) return true;
      return [augment.id, augment.nameKo, augment.nameJa, augment.descriptionKo, augment.descriptionJa]
        .some((value) => value.toLocaleLowerCase(activePublicLocale === "ja" ? "ja-JP" : "ko-KR").includes(normalizedQuery));
    });
  }, [catalog, query, rarity]);

  return (
    <section className="public-aram-page" aria-labelledby="public-aram-title">
      <PageHeader layout="split">
        <PageHeaderEyebrow>{t().aramEyebrow}</PageHeaderEyebrow>
        <PageHeaderTitle as="h1" id="public-aram-title">{t().aramTitle}</PageHeaderTitle>
        <PageHeaderDescription>{t().aramDescription}</PageHeaderDescription>
        <PageHeaderStatus>
          <Badge tone={catalog?.status === "ready" ? "success" : "neutral"}>
            {catalog?.status === "ready" ? t().aramReady : t().aramPreparing}
          </Badge>
        </PageHeaderStatus>
      </PageHeader>

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
          <EmptyStateIcon aria-hidden="true">◇</EmptyStateIcon>
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
                  variant={rarity === value ? "primary" : "secondary"}
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
