export type RecentMatchBuildItemsTimelineLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type RecentMatchBuildItemSlotViewModel = {
  key: string;
  iconUrl?: string;
  label: string;
  minuteLabel: string;
};

export type RecentMatchBuildItemsTimelineProps = {
  label: RecentMatchBuildItemsTimelineLocalizedText;
  itemSlots: RecentMatchBuildItemSlotViewModel[];
  noDataLabel: string;
};

export function RecentMatchBuildItemsTimeline({
  label,
  itemSlots,
  noDataLabel
}: RecentMatchBuildItemsTimelineProps) {
  return (
    <div className="public-match-build-group items">
      <span  >{label.label}</span>
      <div className="public-match-build-timeline">
        {itemSlots.length > 0 ? itemSlots.map((item) => (
          <div key={item.key}>
            <span>{item.iconUrl ? <img src={item.iconUrl} alt="" /> : item.label}</span>
            <small>{item.minuteLabel}</small>
          </div>
        )) : <p className="public-empty">{noDataLabel}</p>}
      </div>
    </div>
  );
}
