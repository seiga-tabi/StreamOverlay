import { useEffect, useState } from "react";
import type { RewardMappingSummary } from "@streamops/shared";
import { apiGet } from "../api/client";
import { createDashboardLocaleProxy } from "../i18n";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../shared/ui/Card";
import {
  EmptyState,
  EmptyStateDescription,
  EmptyStateIcon,
  EmptyStateTitle,
} from "../shared/ui/EmptyState";
import { SkeletonCard, SkeletonText } from "../shared/ui/Skeleton";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";

const i18n = {
  ko: {
    title: "Reward 매핑",
    description: "현재 channel point reward 설정을 read-only로 확인합니다.",
    empty: "등록된 reward 설정이 없습니다.",
    rewardId: "reward_id",
    titleKey: "title fallback",
    overlay: "Overlay",
    noOverlay: "Overlay 없음",
    cooldown: "cooldown",
    maxPerStream: "stream당 최대",
    fallbackWarning: "title fallback 사용 중입니다. 가능하면 reward_id로 바꾸세요.",
    loading: "Reward 설정을 불러오는 중입니다.",
    total: "등록 수"
  },
  ja: {
    title: "Reward マッピング",
    description: "現在の channel point reward 設定を read-only で確認します。",
    empty: "登録された reward 設定はありません。",
    rewardId: "reward_id",
    titleKey: "title fallback",
    overlay: "Overlay",
    noOverlay: "Overlay なし",
    cooldown: "cooldown",
    maxPerStream: "配信ごとの最大",
    fallbackWarning: "title fallback を使用中です。可能なら reward_id に変更してください。",
    loading: "Reward 設定を読み込んでいます。",
    total: "登録数"
  }
} as const;

const t = createDashboardLocaleProxy(i18n);

function formatNumber(value?: number): string {
  return value == null ? "-" : String(value);
}

export function RewardMappingPanel() {
  const [items, setItems] = useState<RewardMappingSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiGet<RewardMappingSummary[]>("/api/rewards/mappings")
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <Card as="section" className="overlay-studio-card overlay-studio-reward-panel" padding="lg" variant="glass">
      <CardHeader className="overlay-studio-card-header">
        <div>
          <CardTitle as="h2">{t.title}</CardTitle>
          <CardDescription>{t.description}</CardDescription>
        </div>
        <Metric label={t.total} size="sm" tone={items.length > 0 ? "success" : "neutral"} value={items.length} />
      </CardHeader>
      <CardContent>
      <div className="overlay-studio-reward-list">
        {loading ? (
          <SkeletonCard loadingLabel={t.loading} size="md">
            <SkeletonText lines={4} size="md" />
          </SkeletonCard>
        ) : null}
        {!loading && items.length === 0 ? (
          <EmptyState className="overlay-studio-empty" variant="streamer">
            <EmptyStateIcon>Reward</EmptyStateIcon>
            <EmptyStateTitle as="h3">{t.empty}</EmptyStateTitle>
            <EmptyStateDescription>{t.description}</EmptyStateDescription>
          </EmptyState>
        ) : null}
        {items.map((item) => (
          <Card as="article" className="overlay-studio-reward-row" key={item.key} padding="md" variant="elevated">
            <div>
              <strong>{item.name}</strong>
              <div className="overlay-studio-chip-row">
                <code>{item.keyType === "reward_id" ? `${t.rewardId}: ${item.rewardId}` : `${t.titleKey}: ${item.title}`}</code>
                <StatusPill size="sm" tone={item.hasOverlayAction ? "success" : "neutral"}>
                  {item.hasOverlayAction ? t.overlay : t.noOverlay}
                </StatusPill>
              </div>
              {item.titleFallbackWarning ? <Badge tone="warning">{t.fallbackWarning}</Badge> : null}
            </div>
            <div className="overlay-studio-reward-meta">
              <Metric label={t.cooldown} size="sm" tone="info" value={`${formatNumber(item.cooldownMs)}ms`} />
              <Metric label={t.maxPerStream} size="sm" tone="neutral" value={formatNumber(item.maxPerStream)} />
            </div>
            <div className="overlay-studio-chip-row">{item.actionTypes.map((type) => <Badge key={type} tone="streamer">{type}</Badge>)}</div>
          </Card>
        ))}
      </div>
      </CardContent>
    </Card>
  );
}
