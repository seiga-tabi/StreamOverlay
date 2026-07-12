import { isValidElement, type ReactNode } from "react";
import { Card } from "../../../shared/ui/Card";
import { type StatusTone } from "../../../shared/ui/Status";
import { TwitchStreamOverviewRow, type TwitchStreamOverviewRowLocalizedText } from "./TwitchStreamOverviewRow";

export type TwitchStreamOverviewCardProps = {
  isLive: boolean;
  profileImageUrl?: string;
  label: ReactNode;
  value: ReactNode;
  metricTone: StatusTone;
  statusLabel: ReactNode;
  statusTone: StatusTone;
  categoryLabel?: string;
  viewerLabel?: string;
  offlineLabel?: string;
};

function textFromReactNode(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map((child) => textFromReactNode(child)).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textFromReactNode(node.props.children);
  return "";
}

function localizedTextFromReactNode(node: ReactNode): TwitchStreamOverviewRowLocalizedText {
  if (isValidElement<{ children?: ReactNode; "data-ko"?: unknown; "data-ja"?: unknown }>(node)) {
    const ko = node.props["data-ko"];
    const ja = node.props["data-ja"];
    return {
      label: textFromReactNode(node.props.children),
      ko: typeof ko === "string" ? ko : undefined,
      ja: typeof ja === "string" ? ja : undefined,
    };
  }
  return { label: textFromReactNode(node) };
}

export function TwitchStreamOverviewCard({
  categoryLabel,
  isLive,
  label,
  metricTone,
  offlineLabel,
  profileImageUrl,
  statusLabel,
  statusTone,
  value,
  viewerLabel,
}: TwitchStreamOverviewCardProps) {
  return (
    <Card as="article" className={`public-rank-overview-card public-stream-overview-card public-profile-shared-rank-card ${isLive ? "live" : "offline"}`} padding="md" variant="elevated">
      <TwitchStreamOverviewRow
        stream={{
          categoryLabel,
          fallbackLabel: "TV",
          isLive,
          label: localizedTextFromReactNode(label),
          metricTone,
          offlineLabel,
          profileImageUrl,
          statusLabel: textFromReactNode(statusLabel),
          statusTone,
          value: localizedTextFromReactNode(value),
          viewerLabel,
        }}
      />
    </Card>
  );
}
