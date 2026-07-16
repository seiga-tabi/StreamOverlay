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
  text: RecentMatchExpandedToolbarText;
  onRecord: () => void;
  onBuild: () => void;
  onToggleMask: () => void;
};

export function RecentMatchExpandedToolbar({
  activeView,
  hideRiotIds,
  text,
  onRecord,
  onBuild,
  onToggleMask
}: RecentMatchExpandedToolbarProps) {
  return (
    <div className="public-match-expanded-toolbar">
      <div className="public-match-expanded-tabs" role="tablist" aria-label={text.matchDetails}>
        <button
          type="button"
          className={activeView === "record" ? "active" : ""}
          role="tab"
          aria-selected={activeView === "record"}
          onClick={onRecord}


        >
          {text.recordTab.label}
        </button>
        <button
          type="button"
          className={activeView === "build" ? "active" : ""}
          role="tab"
          aria-selected={activeView === "build"}
          onClick={onBuild}


        >
          {text.buildTab.label}
        </button>
      </div>
      <button
        type="button"
        className={`public-match-id-mask-toggle ${hideRiotIds ? "active" : ""}`}
        aria-pressed={hideRiotIds}
        onClick={onToggleMask}


      >
        {text.maskToggle.label}
      </button>
    </div>
  );
}
