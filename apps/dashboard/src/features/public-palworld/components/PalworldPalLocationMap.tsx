import { useEffect, useState, type CSSProperties } from "react";
import type {
  PalworldMapMarker,
  PalworldPalSpawnPoint,
  PalworldPalSpawnResponse,
} from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { Skeleton } from "../../../shared/ui/Skeleton";
import { Badge } from "../../../shared/ui/Status";
import { getPalworldMapMarkers, getPalworldPalSpawns } from "../api/palworld";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";
import { PALWORLD_WORLD_MAP_IMAGE } from "../utils/element-images";
import { resolvePalworldName } from "../utils/localization";
import { PalworldMedia } from "./PalworldMedia";

type LocationLayerState<T> =
  | { kind: "loading" }
  | { kind: "ready"; data: T }
  | { kind: "confirmed_empty" }
  | { kind: "data_unavailable" }
  | { kind: "error" };

export function filterPalworldBossMarkers(
  markers: readonly PalworldMapMarker[],
  palId: string,
): PalworldMapMarker[] {
  return markers.filter((marker) => marker.pal.id === palId);
}

function markerSummary(marker: PalworldMapMarker, locale: PalworldLocale): string {
  const name = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
  return `${palworldI18n[locale].mapBossMarker}: ${name}, ${palworldI18n[locale].levelPrefix}${marker.level}`;
}

function markerName(marker: PalworldMapMarker, locale: PalworldLocale): string {
  const name = resolvePalworldName(marker.pal, locale).text || marker.pal.nameEn;
  return `${palworldI18n[locale].mapBossMarker}: ${name}`;
}

function spawnSummary(
  response: PalworldPalSpawnResponse,
  locale: PalworldLocale,
): string {
  return palworldI18n[locale].palWildSpawnSummary
    .replace("{placements}", response.totalPlacements.toLocaleString(locale === "ko" ? "ko-KR" : "ja-JP"))
    .replace("{areas}", response.points.length.toLocaleString(locale === "ko" ? "ko-KR" : "ja-JP"));
}

function SpawnAreaLayer({ points }: { points: readonly PalworldPalSpawnPoint[] }) {
  return (
    <svg
      aria-hidden="true"
      className="palworld-pal-location-spawn-layer"
      preserveAspectRatio="none"
      viewBox="0 0 1 1"
    >
      {points.map((point) => (
        <circle
          className="palworld-pal-location-spawn-point"
          cx={point.normalizedX}
          cy={point.normalizedY}
          key={point.id}
          r={0.009}
        />
      ))}
    </svg>
  );
}

export function PalworldPalLocationMap({
  locale,
  onOpenFullMap,
  palId,
}: {
  locale: PalworldLocale;
  onOpenFullMap: (palId: string) => void;
  palId: string;
}) {
  const text = palworldI18n[locale];
  const [revision, setRevision] = useState(0);
  const [imageRevision, setImageRevision] = useState(0);
  const [imageState, setImageState] = useState<"loading" | "ready" | "error">(
    PALWORLD_WORLD_MAP_IMAGE ? "loading" : "error",
  );
  const [bossState, setBossState] = useState<LocationLayerState<PalworldMapMarker[]>>({
    kind: "loading",
  });
  const [spawnState, setSpawnState] = useState<LocationLayerState<PalworldPalSpawnResponse>>({
    kind: "loading",
  });

  useEffect(() => {
    const controller = new AbortController();
    setBossState({ kind: "loading" });
    setSpawnState({ kind: "loading" });

    void getPalworldMapMarkers("main", controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      if (response.state === "data_unavailable") {
        setBossState({ kind: "data_unavailable" });
        return;
      }
      const markers = filterPalworldBossMarkers(response.markers, palId);
      setBossState(markers.length
        ? { kind: "ready", data: markers }
        : { kind: "confirmed_empty" });
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!controller.signal.aborted) setBossState({ kind: "error" });
    });

    void getPalworldPalSpawns(palId, "main", controller.signal).then((response) => {
      if (controller.signal.aborted) return;
      if (response.state === "ready") setSpawnState({ kind: "ready", data: response });
      else setSpawnState({ kind: response.state });
    }).catch((error: unknown) => {
      if (error instanceof DOMException && error.name === "AbortError") return;
      if (!controller.signal.aborted) setSpawnState({ kind: "error" });
    });

    return () => controller.abort();
  }, [palId, revision]);

  const bossMarkers = bossState.kind === "ready" ? bossState.data : [];
  const spawnResponse = spawnState.kind === "ready" ? spawnState.data : undefined;
  const hasLocations = bossMarkers.length > 0 || spawnResponse !== undefined;
  const isLoading = bossState.kind === "loading" || spawnState.kind === "loading";
  const hasError = bossState.kind === "error" || spawnState.kind === "error";
  const layersSettled = !isLoading;
  const bothEmpty = bossState.kind === "confirmed_empty"
    && spawnState.kind === "confirmed_empty";

  return (
    <section
      aria-labelledby="palworld-pal-location-title"
      className="palworld-pal-location-section"
      data-testid="pal-detail-location"
    >
      <div className="palworld-pal-location-heading">
        <h4
          data-ja={palworldI18n.ja.palLocationTitle}
          data-ko={palworldI18n.ko.palLocationTitle}
          id="palworld-pal-location-title"
        >
          {text.palLocationTitle}
        </h4>
        <p
          data-ja={palworldI18n.ja.palLocationDescription}
          data-ko={palworldI18n.ko.palLocationDescription}
        >
          {text.palLocationDescription}
        </p>
      </div>

      {!hasLocations && isLoading ? (
        <div
          aria-busy="true"
          aria-label={text.palLocationLoading}
          className="palworld-pal-location-loading"
          role="status"
        >
          <Skeleton rounded />
        </div>
      ) : null}

      {!hasLocations && layersSettled && bothEmpty ? (
        <p
          className="palworld-pal-location-status"
          data-ja={palworldI18n.ja.palLocationEmpty}
          data-ko={palworldI18n.ko.palLocationEmpty}
          role="status"
        >
          {text.palLocationEmpty}
        </p>
      ) : null}

      {!hasLocations && layersSettled && spawnState.kind === "data_unavailable" ? (
        <p
          className="palworld-pal-location-status"
          data-ja={palworldI18n.ja.palLocationUnavailable}
          data-ko={palworldI18n.ko.palLocationUnavailable}
          role="status"
        >
          {text.palLocationUnavailable}
        </p>
      ) : null}

      {!hasLocations && layersSettled && bossState.kind === "data_unavailable" ? (
        <p
          className="palworld-pal-location-status"
          data-ja={palworldI18n.ja.palBossLocationUnavailable}
          data-ko={palworldI18n.ko.palBossLocationUnavailable}
          role="status"
        >
          {text.palBossLocationUnavailable}
        </p>
      ) : null}

      {!hasLocations && layersSettled && hasError ? (
        <div className="palworld-pal-location-error" role="alert">
          <p>{spawnState.kind === "error" ? text.palLocationError : text.palBossLocationError}</p>
          <Button onClick={() => setRevision((value) => value + 1)} size="sm" variant="secondary">
            {text.retry}
          </Button>
        </div>
      ) : null}

      {hasLocations ? (
        <figure className="palworld-pal-location-figure">
          <div className="palworld-pal-location-preview">
            {imageState === "loading" ? (
              <div
                aria-busy="true"
                aria-label={text.mapLoading}
                className="palworld-pal-location-image-loading"
                role="status"
              >
                <Skeleton rounded />
              </div>
            ) : null}
            {PALWORLD_WORLD_MAP_IMAGE ? (
              <img
                alt={text.palLocationMapAlt}
                className={`palworld-pal-location-map-image${imageState === "loading" ? " is-loading" : ""}`}
                decoding="async"
                draggable={false}
                height={PALWORLD_WORLD_MAP_IMAGE.height}
                key={imageRevision}
                loading="lazy"
                onError={() => setImageState("error")}
                onLoad={() => setImageState("ready")}
                src={PALWORLD_WORLD_MAP_IMAGE.imageUrl}
                width={PALWORLD_WORLD_MAP_IMAGE.width}
              />
            ) : null}
            {imageState === "ready" && spawnResponse ? (
              <SpawnAreaLayer points={spawnResponse.points} />
            ) : null}
            {imageState === "ready" && bossMarkers.length > 0 ? (
              <div aria-hidden="true" className="palworld-pal-location-marker-layer">
                {bossMarkers.map((marker) => (
                  <span
                    className="palworld-pal-location-marker"
                    key={marker.id}
                    style={{
                      left: `${marker.normalizedX * 100}%`,
                      top: `${marker.normalizedY * 100}%`,
                    } as CSSProperties}
                  >
                    <span className="palworld-map-boss-marker-media">
                      <PalworldMedia
                        alt=""
                        imageUrl={marker.pal.imageUrl}
                        intrinsicHeight={marker.pal.imageHeight}
                        intrinsicWidth={marker.pal.imageWidth}
                        kind="pal"
                        locale={locale}
                      />
                    </span>
                  </span>
                ))}
              </div>
            ) : null}
            {imageState === "error" ? (
              <div className="palworld-pal-location-image-error" role="alert">
                <p>{text.mapLoadError}</p>
                {PALWORLD_WORLD_MAP_IMAGE ? (
                  <Button
                    onClick={() => {
                      setImageState("loading");
                      setImageRevision((value) => value + 1);
                    }}
                    size="sm"
                    variant="secondary"
                  >
                    {text.mapRetry}
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
          <figcaption className="palworld-pal-location-caption">
            <ul aria-label={text.palLocationTitle}>
              {spawnResponse ? (
                <li className="palworld-pal-location-spawn-summary">
                  <span className="palworld-pal-location-legend">
                    <span aria-hidden="true" className="palworld-pal-location-legend-dot" />
                    {text.palWildSpawnAreas}
                  </span>
                  <span>{spawnSummary(spawnResponse, locale)}</span>
                </li>
              ) : null}
              {bossMarkers.map((marker) => (
                <li aria-label={markerSummary(marker, locale)} key={marker.id}>
                  <span>{markerName(marker, locale)}</span>
                  <Badge size="sm" tone="danger">{text.levelPrefix}{marker.level}</Badge>
                </li>
              ))}
            </ul>
            {spawnState.kind === "error" ? (
              <p className="palworld-pal-location-inline-error" role="alert">
                {text.palLocationError}
              </p>
            ) : null}
            {spawnState.kind === "data_unavailable" ? (
              <p className="palworld-pal-location-inline-status" role="status">
                {text.palLocationUnavailable}
              </p>
            ) : null}
            {bossState.kind === "error" ? (
              <p className="palworld-pal-location-inline-error" role="alert">
                {text.palBossLocationError}
              </p>
            ) : null}
            {bossState.kind === "data_unavailable" ? (
              <p className="palworld-pal-location-inline-status" role="status">
                {text.palBossLocationUnavailable}
              </p>
            ) : null}
            <div className="palworld-pal-location-actions">
              {hasError ? (
                <Button onClick={() => setRevision((value) => value + 1)} size="sm" variant="secondary">
                  {text.retry}
                </Button>
              ) : null}
              <Button onClick={() => onOpenFullMap(palId)} size="sm" variant="secondary">
                {text.viewOnFullMap}
              </Button>
            </div>
          </figcaption>
        </figure>
      ) : null}
    </section>
  );
}
