import { useEffect, useMemo, useState } from "react";
import { parseAramAugmentCatalog, type AramAugmentCatalog, type AramAugmentRarity } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../../../shared/ui/Card";
import { EmptyState, EmptyStateActions, EmptyStateDescription, EmptyStateIcon, EmptyStateTitle } from "../../../shared/ui/EmptyState";
import { Input } from "../../../shared/ui/Form";
import { PageHeader, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../../../shared/ui/PageHeader";
import { SkeletonCard } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";

type LoadState = "loading" | "ready" | "error";

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
              {(["all", "silver", "gold", "prismatic"] as const).map((value) => (
                <Button
                  key={value}
                  type="button"
                  size="sm"
                  variant={rarity === value ? "primary" : "secondary"}
                  aria-pressed={rarity === value}
                  onClick={() => setRarity(value)}
                >
                  {value === "all" ? t().aramRarityAll : value === "silver" ? t().aramRaritySilver : value === "gold" ? t().aramRarityGold : t().aramRarityPrismatic}
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
                      <Badge tone="neutral">{augment.rarity}</Badge>
                      <CardTitle as="h2">{activePublicLocale === "ja" ? augment.nameJa : augment.nameKo}</CardTitle>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <CardDescription>{activePublicLocale === "ja" ? augment.descriptionJa : augment.descriptionKo}</CardDescription>
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
        </>
      ) : null}
    </section>
  );
}
