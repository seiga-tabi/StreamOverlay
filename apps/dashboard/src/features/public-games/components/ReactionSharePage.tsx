import { useEffect, useMemo, useState } from "react";
import { fetchSharedReactionRecord, type ReactionSharedRecord } from "../api";
import { gamesI18n, type GamesLocale } from "../i18n/games-i18n";
import { readMiniGameBest, reactionTierForAverage, reactionTierLabel, REACTION_TIER_TABLE } from "../registry";
import { TierDot } from "./ReactionTest";
import { setGamesUrl } from "../utils/routes";

/* 공유 페이지 /games/reaction/r/<shareId> — 목업 reaction-test.html v5 §④-5.
 * 기록 카드 + "나도 도전하기" CTA. 방문자의 로컬 기록이 있으면 즉석 비교 문구로
 * 재도전을 유도합니다. 크롤러용 OG 메타(기록 표시)는 서버 렌더가 담당(Codex handoff). */

function formatTemplate(template: string, values: Record<string, string>): string {
  return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, value), template);
}

export function ReactionSharePage({ locale, shareId }: { locale: GamesLocale; shareId: string }) {
  const text = gamesI18n[locale];
  const [record, setRecord] = useState<ReactionSharedRecord | null | undefined>(undefined);
  const myBest = useMemo(() => readMiniGameBest("reaction"), []);

  useEffect(() => {
    let cancelled = false;
    void fetchSharedReactionRecord(shareId).then((result) => {
      if (!cancelled) setRecord(result);
    });
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  if (record === undefined) return null;

  if (record === null) {
    return (
      <div className="games-notfound" data-testid="reaction-share-notfound">
        <strong>{text.shareNotFoundTitle}</strong>
        <p>{text.shareNotFoundBody}</p>
        <button className="games-btn" onClick={() => setGamesUrl("/games/reaction")} type="button">{text.shareChallenge}</button>
      </div>
    );
  }

  const average = Math.round(record.averageMs);
  const tier = record.tierKey
    ? REACTION_TIER_TABLE.find((entry) => entry.key === record.tierKey) ?? reactionTierForAverage(average)
    : reactionTierForAverage(average);
  const byLine = record.displayName
    ? formatTemplate(text.shareRecordBy, { name: record.displayName })
    : text.shareRecordAnonymousBy;
  const metaParts = [
    byLine,
    record.percentile !== undefined ? formatTemplate(text.sharePercentile, { value: String(record.percentile) }) : "",
    record.at ? new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : "ko-KR", { dateStyle: "medium" }).format(new Date(record.at)) : ""
  ].filter(Boolean);
  const myBestMs = myBest ? Math.round(myBest.score) : undefined;
  const compareLine = myBestMs === undefined || myBestMs === average
    ? undefined
    : myBestMs < average
      ? formatTemplate(text.shareCompareFaster, { mine: String(myBestMs), diff: String(average - myBestMs) })
      : formatTemplate(text.shareCompareSlower, { mine: String(myBestMs), diff: String(myBestMs - average) });

  return (
    <div className="games-share" data-testid="reaction-share-page">
      <div className="games-share-card">
        <div className="games-share-record">
          <b>{average}<small>ms</small></b>
          <span className="games-tier-chip"><TierDot tier={tier} />{reactionTierLabel(tier, locale)}</span>
        </div>
        <p className="games-share-meta">{metaParts.join(" · ")}</p>
        <button className="games-btn games-share-cta" onClick={() => setGamesUrl("/games/reaction")} type="button">
          {text.shareChallenge}
        </button>
        {compareLine ? <p className="games-share-compare">{compareLine}</p> : null}
      </div>
    </div>
  );
}
