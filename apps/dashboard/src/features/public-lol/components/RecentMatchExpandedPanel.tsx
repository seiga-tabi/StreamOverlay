import type { ReactNode } from "react";
import {
  RecentMatchExpandedToolbar,
  type RecentMatchExpandedToolbarLocalizedText,
  type RecentMatchExpandedToolbarText,
  type RecentMatchExpandedToolbarView
} from "./RecentMatchExpandedToolbar";

export type RecentMatchExpandedPanelLocalizedText = RecentMatchExpandedToolbarLocalizedText;

export type RecentMatchExpandedPanelView = RecentMatchExpandedToolbarView;

export type RecentMatchExpandedPanelText = RecentMatchExpandedToolbarText;

export type RecentMatchExpandedPanelProps = {
  activeView: RecentMatchExpandedPanelView;
  hideRiotIds: boolean;
  content: ReactNode;
  text: RecentMatchExpandedPanelText;
  onRecord: () => void;
  onBuild: () => void;
  onToggleMask: () => void;
};

export function RecentMatchExpandedPanel({
  activeView,
  hideRiotIds,
  content,
  text,
  onRecord,
  onBuild,
  onToggleMask
}: RecentMatchExpandedPanelProps) {
  return (
    <div className="public-match-expanded">
      <RecentMatchExpandedToolbar
        activeView={activeView}
        hideRiotIds={hideRiotIds}
        onBuild={onBuild}
        onRecord={onRecord}
        onToggleMask={onToggleMask}
        text={text}
      />
      {content}
    </div>
  );
}
