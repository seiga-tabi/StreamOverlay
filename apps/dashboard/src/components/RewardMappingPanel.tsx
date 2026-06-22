import { useEffect, useState } from "react";
import type { RewardMappingSummary } from "@streamops/shared";
import { apiGet } from "../api/client";

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
    fallbackWarning: "title fallback 사용 중입니다. 가능하면 reward_id로 바꾸세요."
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
    fallbackWarning: "title fallback を使用中です。可能なら reward_id に変更してください。"
  }
} as const;

const t = i18n.ko;

function formatNumber(value?: number): string {
  return value == null ? "-" : String(value);
}

export function RewardMappingPanel() {
  const [items, setItems] = useState<RewardMappingSummary[]>([]);

  useEffect(() => {
    void apiGet<RewardMappingSummary[]>("/api/rewards/mappings").then(setItems).catch(() => setItems([]));
  }, []);

  return (
    <div className="card">
      <div className="card-title-row">
        <div>
          <h2>{t.title}</h2>
          <p className="muted">{t.description}</p>
        </div>
        <span className="count-badge">{items.length}</span>
      </div>
      <div className="reward-mapping-list">
        {items.length === 0 ? <p className="muted empty-state">{t.empty}</p> : null}
        {items.map((item) => (
          <div className="reward-mapping-row" key={item.key}>
            <div>
              <strong>{item.name}</strong>
              <div className="chips">
                <code>{item.keyType === "reward_id" ? `${t.rewardId}: ${item.rewardId}` : `${t.titleKey}: ${item.title}`}</code>
                <span className={`queue-status ${item.hasOverlayAction ? "good" : "neutral"}`}>{item.hasOverlayAction ? t.overlay : t.noOverlay}</span>
              </div>
              {item.titleFallbackWarning ? <p className="scope-warning compact-warning">{t.fallbackWarning}</p> : null}
            </div>
            <div className="reward-meta">
              <span><strong>{formatNumber(item.cooldownMs)}ms</strong><small className="muted">{t.cooldown}</small></span>
              <span><strong>{formatNumber(item.maxPerStream)}</strong><small className="muted">{t.maxPerStream}</small></span>
            </div>
            <div className="chips">{item.actionTypes.map((type) => <code key={type}>{type}</code>)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
