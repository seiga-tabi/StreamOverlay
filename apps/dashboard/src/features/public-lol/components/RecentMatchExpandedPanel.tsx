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
  replayAction?: ReactNode;
  /* 다시보기가 없을 때 같은 자리에 서는 라인 표식(툴바로 그대로 넘깁니다). */
  laneMark?: ReactNode;
  content: ReactNode;
  text: RecentMatchExpandedPanelText;
  onRecord: () => void;
  onBuild: () => void;
  onToggleMask: () => void;
};

export function RecentMatchExpandedPanel({
  activeView,
  hideRiotIds,
  replayAction,
  laneMark,
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
        laneMark={laneMark}
        replayAction={replayAction}
        onBuild={onBuild}
        onRecord={onRecord}
        onToggleMask={onToggleMask}
        text={text}
      />
      {content}
    </div>
  );
}
