import { useEffect, useRef, useState } from "react";
import type { PatchNote, PatchPlayRecord } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { activePublicLocale, t } from "../i18n/public-lol-i18n";
import { riotLocaleUrl } from "../pages/PublicPatchNotesPage";
import { patchStatLabel, type PatchChangeSummary, type PatchChampionChange, type PatchStatLabelLocale } from "../types/patch-change-summary";
import { createPatchSummaryShareBlob, type PatchSummaryShareText } from "../utils/patch-summary-share";

/* 패치 변경 요약 패널 — 목업 docs/mockups/lol-patch-summary-share.html v1.2 §②.
 *
 * 순서: Riot 한 줄 요약(인용) → 시스템 변경 → 버프/너프 챔피언 → 아이템 → 내 전적.
 * 우측 상단 "요약 공유"가 같은 데이터로 1080px 카드를 만듭니다(§③).
 *
 * 이 패널이 말하는 것은 Riot 본문 요약이 아니라 **우리가 계산한 기본 스탯·아이템
 * 변경**입니다. champion.json 에 스킬 수치가 없으므로 스킬 변경은 포함되지 않고,
 * 그 사실을 푸터가 항상 밝히며 원문 링크를 함께 답니다 — 이 표기가 빠지면 이
 * 기능은 사용자를 오도합니다(목업 §①).
 */

/** 이 패치 최다 사용 챔피언(목업 §⑤).
 *
 * shared 의 parsePatchPlaySummary 는 아는 필드만 남기고 새 필드를 버리므로,
 * 서버가 topChampions 를 보내도 PatchPlayRecord 로는 들어오지 않습니다
 * (2026-08-18 확인). 계약이 shared 에 반영되기 전까지는 이 prop 이 비어 있고,
 * 패널은 해당 칸만 접습니다 — 승률·게이지는 그대로 나옵니다. */
export type PatchTopChampion = {
  championId: number;
  name?: string;
  iconUrl?: string;
  games: number;
  wins: number;
};

export type PatchChangeSummaryPanelProps = {
  note: PatchNote;
  summary: PatchChangeSummary;
  /** 이 패치의 내 전적. 없으면 전적 블록을 그리지 않습니다. */
  record?: PatchPlayRecord;
  /** 직전 패치 기록 — 있으면 승률 델타(▲/▼)를 붙입니다. */
  previousRecord?: PatchPlayRecord;
  /** 최다 사용 챔피언. shared 계약 확장 전까지는 비어 있습니다. */
  topChampions?: readonly PatchTopChampion[];
};

/** 패널·카드가 함께 쓰는 표시 상한(목업 §⑤). */
const PANEL_CHAMPION_LIMIT = 5;
const PANEL_ITEM_LIMIT = 4;

/* 스탯 라벨의 언어 열쇠. 화면 언어를 그대로 씁니다 — 세 언어 모두 라벨이 있습니다.
   (챔피언·아이템 이름은 서버가 Data Dragon 언어로 보내므로 여기 대상이 아닙니다.) */
function localeKey(): PatchStatLabelLocale {
  if (activePublicLocale === "ja") return "ja";
  if (activePublicLocale === "en") return "en";
  return "ko";
}

function directionLabel(direction: PatchChampionChange["direction"]): string {
  if (direction === "buff") return t().patchSummaryBuff;
  if (direction === "nerf") return t().patchSummaryNerf;
  return t().patchSummaryAdjust;
}

function statLine(change: { stat: string; from: number; to: number }): string {
  return `${patchStatLabel(change.stat, localeKey())} ${change.from}→${change.to}`;
}

export function PatchChangeSummaryPanel({ note, summary, record, previousRecord, topChampions }: PatchChangeSummaryPanelProps) {
  const [status, setStatus] = useState<"idle" | "preparing" | "saved" | "shared" | "failed">("idle");
  const mountedRef = useRef(false);
  const inFlightRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const buffs = summary.championChanges.filter((champion) => champion.direction === "buff");
  const nerfs = summary.championChanges.filter((champion) => champion.direction === "nerf");
  const adjusts = summary.championChanges.filter((champion) => champion.direction === "adjust");
  const visibleChampions = [...buffs, ...nerfs, ...adjusts].slice(0, PANEL_CHAMPION_LIMIT);
  const hiddenChampions = summary.championChanges.length - visibleChampions.length;
  const visibleItems = summary.itemChanges.slice(0, PANEL_ITEM_LIMIT);
  const hiddenItems = summary.itemChanges.length - visibleItems.length;

  const losses = record ? Math.max(0, record.games - record.wins) : 0;
  const delta = record && previousRecord
    ? Math.round((record.winRate - previousRecord.winRate) * 10) / 10
    : undefined;

  const shareText: PatchSummaryShareText = {
    eyebrow: t().patchSummaryShareEyebrow,
    scope: t().patchSummaryScope,
    system: t().patchSummarySystem,
    buff: t().patchSummaryBuff,
    nerf: t().patchSummaryNerf,
    adjust: t().patchSummaryAdjust,
    items: t().patchSummaryItems,
    championCount: t().patchSummaryChampionCount,
    winRate: t().patchSummaryMyWinRate,
    topChampions: t().patchSummaryTopChampions,
    games: t().games,
    source: t().patchSummarySource,
    itemNew: t().patchSummaryItemNew,
    itemRemoved: t().patchSummaryItemRemoved,
  };

  const runShare = async (mode: "download" | "share") => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    if (mountedRef.current) setStatus("preparing");
    try {
      const blob = await createPatchSummaryShareBlob({
        note,
        summary,
        ...(record ? { record } : {}),
        ...(topChampions && topChampions.length > 0 ? { topChampions } : {}),
        ...(delta !== undefined ? { delta } : {}),
        locale: localeKey(),
        text: shareText,
      });
      const fileName = `yoro-lol-patch-${summary.patchVersion.replace(/\./g, "-")}.png`;
      const file = new File([blob], fileName, { type: "image/png" });
      if (mode === "share"
        && typeof navigator.share === "function"
        && typeof navigator.canShare === "function"
        && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file] });
        if (mountedRef.current) setStatus("shared");
        return;
      }
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.download = fileName;
      anchor.href = url;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      if (mountedRef.current) setStatus("saved");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        if (mountedRef.current) setStatus("idle");
        return;
      }
      if (mountedRef.current) setStatus("failed");
    } finally {
      inFlightRef.current = false;
    }
  };

  const statusText = status === "preparing"
    ? t().patchSummarySharePreparing
    : status === "saved"
      ? t().patchSummaryShareSaved
      : status === "shared"
        ? t().patchSummaryShareShared
        : status === "failed"
          ? t().patchSummaryShareFailed
          : "";

  return (
    <section aria-labelledby="patch-change-summary-title" className="yoro-pn-summary" data-testid="patch-change-summary">
      <header className="yoro-pn-summary-head">
        <h3 id="patch-change-summary-title">{t().patchSummaryTitle}</h3>
        <span className="yoro-pn-summary-ver">{summary.patchVersion}</span>
        <div className="yoro-pn-summary-actions">
          <Button
            disabled={status === "preparing"}
            loading={status === "preparing"}
            onClick={() => void runShare("share")}
            size="sm"
            type="button"
          >
            <span aria-hidden="true">🖼</span>
            {t().patchSummaryShare}
          </Button>
        </div>
      </header>

      <div className="yoro-pn-summary-body">
        {note.summary ? (
          <p className="yoro-pn-summary-quote">
            <b>{t().patchSummaryRiotQuote}</b>
            {note.summary}
          </p>
        ) : null}

        <p aria-hidden="true" className="yoro-pn-summary-legend">
          <span data-direction="buff">{t().patchSummaryBuff}</span>
          <span data-direction="nerf">{t().patchSummaryNerf}</span>
          <span data-direction="adjust">{t().patchSummaryAdjust}</span>
          <small>{t().patchSummaryColorLegend}</small>
        </p>

        {summary.systemChanges.length > 0 ? (
          <div className="yoro-pn-summary-group">
            <h4>{t().patchSummarySystem}</h4>
            {summary.systemChanges.map((change) => (
              <p className="yoro-pn-summary-sys" key={`${change.stat}:${change.from}:${change.to}`}>
                <b>{patchStatLabel(change.stat, localeKey())}</b>
                {/* 시스템 변경에는 서버 판정이 없습니다 — 증감으로 유추해 칠하면
                    절반이 뒤집힙니다(마법 저항력 26→33 은 너프). 무채로 둡니다(보강 §2). */}
                <span className="yoro-pn-summary-delta">
                  {change.from} → <em>{change.to}</em>
                </span>
                <small>{t().patchSummaryChampionCount.replace("{n}", String(change.championCount))}</small>
              </p>
            ))}
          </div>
        ) : null}

        {visibleChampions.length > 0 ? (
          <div className="yoro-pn-summary-group">
            <h4>
              {t().patchSummaryChampions}
              <small>{t().patchSummaryScope}</small>
            </h4>
            {visibleChampions.map((champion) => (
              <div className="yoro-pn-summary-chg" key={champion.championId}>
                {champion.iconUrl
                  ? <img alt="" decoding="async" loading="lazy" src={champion.iconUrl} />
                  : <i aria-hidden="true">{champion.name.slice(0, 1)}</i>}
                <b>{champion.name}</b>
                <span className="yoro-pn-summary-tag" data-direction={champion.direction}>
                  {directionLabel(champion.direction)}
                </span>
                <small className="yoro-pn-summary-stats">
                  {champion.changes.slice(0, 3).map((change, index) => (
                    <span key={change.stat}>
                      {index > 0 ? " · " : ""}
                      {patchStatLabel(change.stat, localeKey())}
                      {" "}
                      <span className="yoro-pn-num-from">{change.from}</span>
                      {" → "}
                      {/* 스탯별 개별 판정은 응답에 없어 행 판정(direction) 색을 씁니다. */}
                      <em className="yoro-pn-num-to" data-direction={champion.direction}>{change.to}</em>
                    </span>
                  ))}
                </small>
              </div>
            ))}
            {hiddenChampions > 0 ? (
              <p className="yoro-pn-summary-more">{t().patchSummaryMore.replace("{n}", String(hiddenChampions))}</p>
            ) : null}
          </div>
        ) : null}

        {visibleItems.length > 0 ? (
          <div className="yoro-pn-summary-group">
            <h4>{t().patchSummaryItems}</h4>
            {visibleItems.map((item) => (
              <div className="yoro-pn-summary-chg" key={item.itemId}>
                {item.iconUrl
                  ? <img alt="" decoding="async" loading="lazy" src={item.iconUrl} />
                  : <i aria-hidden="true">{item.name.slice(0, 1)}</i>}
                <b>{item.name}</b>
                <span className="yoro-pn-summary-tag">
                  {item.kind === "new" ? t().patchSummaryItemNew : item.kind === "removed" ? t().patchSummaryItemRemoved : t().patchSummaryItemPrice}
                </span>
                {item.kind === "price" && item.from !== undefined && item.to !== undefined ? (
                  <small className="yoro-pn-summary-stats">
                    <span className="yoro-pn-num-from">{item.from}</span>
                    {" → "}
                    <em className="yoro-pn-num-to" data-direction={item.to > item.from ? "nerf" : "buff"}>{item.to}</em>
                    {" G"}
                  </small>
                ) : null}
              </div>
            ))}
            {hiddenItems > 0 ? (
              <p className="yoro-pn-summary-more">{t().patchSummaryMore.replace("{n}", String(hiddenItems))}</p>
            ) : null}
          </div>
        ) : null}

        {record ? (
          <div className="yoro-pn-summary-group">
            <h4>{t().patchSummaryMyRecord}</h4>
            <div className="yoro-pn-summary-mine">
              <div className="yoro-pn-summary-figure">
                <b data-tone={record.winRate >= 50 ? "good" : "bad"}>{`${record.winRate.toFixed(1)}%`}</b>
                {delta === undefined || delta === 0 ? null : (
                  <span className="yoro-pn-summary-delta-badge" data-tone={delta > 0 ? "good" : "bad"}>
                    {`${delta > 0 ? "▲" : "▼"} ${Math.abs(delta).toFixed(1)}%p`}
                  </span>
                )}
                <small>
                  {t().patchNotesRecordLabel
                    .replace("{wins}", String(record.wins))
                    .replace("{losses}", String(losses))
                    .replace("{games}", String(record.games))}
                </small>
                <span aria-hidden="true" className="yoro-pn-summary-gauge">
                  <i style={{ flexGrow: Math.max(record.wins, 0.001) }} />
                  <b style={{ flexGrow: Math.max(losses, 0.001) }} />
                </span>
              </div>
              {/* 최다 사용 챔피언 — 서버가 topChampions 를 아직 안 주는 배포에서는
                  이 칸만 비우고 승률·게이지는 그대로 둡니다(목업 §⑤ fail-soft). */}
              {topChampions && topChampions.length > 0 ? (
                <div className="yoro-pn-summary-tops">
                  <p className="yoro-pn-summary-tops-label">{t().patchSummaryTopChampions}</p>
                  <div className="yoro-pn-summary-tops-list">
                    {topChampions.slice(0, 3).map((champion, index) => {
                      const rate = champion.games > 0 ? Math.round((champion.wins / champion.games) * 100) : 0;
                      return (
                        <span
                          className={index === 0 ? "yoro-pn-summary-top is-most" : "yoro-pn-summary-top"}
                          key={champion.championId}
                        >
                          {champion.iconUrl
                            ? <img alt="" decoding="async" loading="lazy" src={champion.iconUrl} />
                            : <i aria-hidden="true">{(champion.name ?? "?").slice(0, 1)}</i>}
                          <span className="yoro-pn-summary-top-copy">
                            <b>{champion.name ?? `#${champion.championId}`}</b>
                            <small>
                              {`${champion.games}${t().games} · `}
                              <em data-tone={rate >= 50 ? "good" : "bad"}>{`${rate}%`}</em>
                            </small>
                          </span>
                        </span>
                      );
                    })}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <p className="yoro-pn-summary-foot">
          {t().patchSummaryFoot
            .replace("{from}", summary.comparedVersions[0])
            .replace("{to}", summary.comparedVersions[1])}
          {" "}
          {/* .yoro-pn-link 는 카드 전체를 덮는 stretched-link(::after inset:0)라
              패널 안에서 쓰면 공유 버튼을 가려 누를 수 없게 됩니다(2026-08-18 실측). */}
          <a className="yoro-pn-summary-link" href={riotLocaleUrl(note.url)} rel="noopener noreferrer" target="_blank">
            {t().patchSummaryOriginalLink}
          </a>
        </p>
        <span aria-live="polite" className="yoro-pn-summary-status" role={status === "failed" ? "alert" : "status"}>
          {statusText}
        </span>
      </div>
    </section>
  );
}
