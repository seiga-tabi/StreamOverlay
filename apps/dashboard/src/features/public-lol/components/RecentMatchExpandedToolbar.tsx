import type { ReactNode } from "react";

export type RecentMatchExpandedToolbarLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type RecentMatchExpandedToolbarView = "record" | "build";

export type RecentMatchExpandedToolbarText = {
  matchDetails: string;
  recordTab: RecentMatchExpandedToolbarLocalizedText;
  buildTab: RecentMatchExpandedToolbarLocalizedText;
  maskToggle: RecentMatchExpandedToolbarLocalizedText;
};

export type RecentMatchExpandedToolbarProps = {
  activeView: RecentMatchExpandedToolbarView;
  hideRiotIds: boolean;
  /* 다시보기 링크 — 모바일은 행의 액션 열이 접히므로 여기가 유일한 진입점입니다. */
  replayAction?: ReactNode;
  text: RecentMatchExpandedToolbarText;
  onRecord: () => void;
  onBuild: () => void;
  onToggleMask: () => void;
};

export function RecentMatchExpandedToolbar({
  activeView,
  hideRiotIds,
  replayAction,
  text,
  onRecord,
  onBuild,
  onToggleMask
}: RecentMatchExpandedToolbarProps) {
  return (
    <div className="public-md-toolbar">
      <div className="public-md-tabs" role="tablist" aria-label={text.matchDetails}>
        <button
          type="button"
          className={`public-md-tab ${activeView === "record" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeView === "record"}
          onClick={onRecord}


        >
          {text.recordTab.label}
        </button>
        <button
          type="button"
          className={`public-md-tab ${activeView === "build" ? "is-active" : ""}`}
          role="tab"
          aria-selected={activeView === "build"}
          onClick={onBuild}


        >
          {text.buildTab.label}
        </button>
      </div>
      {replayAction}
      <button
        type="button"
        className={`public-md-mask ${hideRiotIds ? "is-active" : ""}`}
        aria-pressed={hideRiotIds}
        onClick={onToggleMask}


      >
        {text.maskToggle.label}
        {/* 26×14 스위치 — 상태는 aria-pressed 가, 시각은 is-active 가 말합니다(목업 §2-5). */}
        <span className="public-md-mask-switch" aria-hidden="true">
          <i />
        </span>
      </button>
    </div>
  );
}
