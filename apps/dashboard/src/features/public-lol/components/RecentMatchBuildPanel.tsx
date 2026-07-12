import {
  RecentMatchBuildItemsTimeline,
  type RecentMatchBuildItemSlotViewModel,
  type RecentMatchBuildItemsTimelineLocalizedText
} from "./RecentMatchBuildItemsTimeline";
import {
  RecentMatchBuildParticipantSelector,
  type RecentMatchBuildParticipantOptionViewModel
} from "./RecentMatchBuildParticipantSelector";
import {
  RecentMatchBuildRuneBoard,
  type RecentMatchBuildRuneColumnViewModel,
  type RecentMatchBuildRuneRowViewModel,
  type RecentMatchBuildRuneSlotViewModel,
  type RecentMatchBuildRuneTitleIconViewModel
} from "./RecentMatchBuildRuneBoard";
import {
  RecentMatchBuildSkillGrid,
  type RecentMatchBuildSkillCellViewModel,
  type RecentMatchBuildSkillIconViewModel,
  type RecentMatchBuildSkillRowViewModel
} from "./RecentMatchBuildSkillGrid";
import {
  RecentMatchBuildSummary as RecentMatchBuildSummaryPresenter,
  type RecentMatchBuildSummaryBadgeViewModel,
  type RecentMatchBuildSummaryMetricSnapshotViewModel,
  type RecentMatchBuildSummaryViewModel
} from "./RecentMatchBuildSummary";

export type RecentMatchBuildLocalizedText = RecentMatchBuildItemsTimelineLocalizedText;

export type RecentMatchBuildParticipantOption = RecentMatchBuildParticipantOptionViewModel;

export type RecentMatchBuildItemSlot = RecentMatchBuildItemSlotViewModel;

export type RecentMatchBuildSkillIcon = RecentMatchBuildSkillIconViewModel;

export type RecentMatchBuildSkillCell = RecentMatchBuildSkillCellViewModel;

export type RecentMatchBuildSkillRow = RecentMatchBuildSkillRowViewModel;

export type RecentMatchBuildRuneSlot = RecentMatchBuildRuneSlotViewModel;

export type RecentMatchBuildRuneRow = RecentMatchBuildRuneRowViewModel;

export type RecentMatchBuildRuneTitleIcon = RecentMatchBuildRuneTitleIconViewModel;

export type RecentMatchBuildRuneColumn = RecentMatchBuildRuneColumnViewModel;

export type RecentMatchBuildBadge = RecentMatchBuildSummaryBadgeViewModel;

export type RecentMatchBuildMetricSnapshot = RecentMatchBuildSummaryMetricSnapshotViewModel;

export type RecentMatchBuildSummary = RecentMatchBuildSummaryViewModel;

export type RecentMatchBuildReadyViewModel = {
  state: "ready";
  ariaLabel: string;
  championAriaLabel: string;
  itemsLabel: RecentMatchBuildLocalizedText;
  skillBuildLabel: RecentMatchBuildLocalizedText;
  runesLabel: RecentMatchBuildLocalizedText;
  skillOrderLabel: string;
  noDataLabel: string;
  participants: RecentMatchBuildParticipantOption[];
  itemSlots: RecentMatchBuildItemSlot[];
  skillIcons: RecentMatchBuildSkillIcon[];
  skillRows: RecentMatchBuildSkillRow[];
  runeColumns: RecentMatchBuildRuneColumn[];
  summary: RecentMatchBuildSummary;
};

export type RecentMatchBuildMessageViewModel = {
  state: "loading" | "error" | "empty";
  message: string;
};

export type RecentMatchBuildViewModel =
  | RecentMatchBuildReadyViewModel
  | RecentMatchBuildMessageViewModel;

export type RecentMatchBuildPanelProps = {
  viewModel: RecentMatchBuildViewModel;
  onSelectParticipant: (key: string) => void;
};

export function RecentMatchBuildPanel({
  viewModel,
  onSelectParticipant,
}: RecentMatchBuildPanelProps) {
  if (viewModel.state !== "ready") {
    return (
      <div className={`public-match-build-state ${viewModel.state === "error" ? "error" : ""}`}>
        {viewModel.message}
      </div>
    );
  }

  return (
    <section className="public-match-build-panel" aria-label={viewModel.ariaLabel}>
      <RecentMatchBuildParticipantSelector
        championAriaLabel={viewModel.championAriaLabel}
        onSelectParticipant={onSelectParticipant}
        participants={viewModel.participants}
      />
      <RecentMatchBuildItemsTimeline
        itemSlots={viewModel.itemSlots}
        label={viewModel.itemsLabel}
        noDataLabel={viewModel.noDataLabel}
      />
      <RecentMatchBuildSkillGrid
        label={viewModel.skillBuildLabel}
        skillIcons={viewModel.skillIcons}
        skillOrderLabel={viewModel.skillOrderLabel}
        skillRows={viewModel.skillRows}
      />
      <div className="public-match-build-group runes">
        <RecentMatchBuildRuneBoard
          label={viewModel.runesLabel}
          noDataLabel={viewModel.noDataLabel}
          runeColumns={viewModel.runeColumns}
        />
        <RecentMatchBuildSummaryPresenter summary={viewModel.summary} />
      </div>
    </section>
  );
}
