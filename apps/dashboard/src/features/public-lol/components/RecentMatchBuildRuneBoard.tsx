export type RecentMatchBuildRuneBoardLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type RecentMatchBuildRuneSlotViewModel = {
  key: string;
  className: string;
  title: string;
  iconUrl?: string;
  fallbackLabel: string;
};

export type RecentMatchBuildRuneRowViewModel = {
  key: string;
  className: string;
  slots: RecentMatchBuildRuneSlotViewModel[];
};

export type RecentMatchBuildRuneTitleIconViewModel = {
  className: string;
  title: string;
  iconUrl?: string;
  fallbackLabel: string;
};

export type RecentMatchBuildRuneColumnViewModel = {
  key: string;
  className: string;
  titleClassName: string;
  title: string;
  titleIcon?: RecentMatchBuildRuneTitleIconViewModel;
  rows: RecentMatchBuildRuneRowViewModel[];
};

export type RecentMatchBuildRuneBoardProps = {
  label: RecentMatchBuildRuneBoardLocalizedText;
  runeColumns: RecentMatchBuildRuneColumnViewModel[];
  noDataLabel: string;
};

export function RecentMatchBuildRuneBoard({
  label,
  runeColumns,
  noDataLabel
}: RecentMatchBuildRuneBoardProps) {
  return (
    <>
      <span data-ko={label.ko} data-ja={label.ja}>{label.label}</span>
      {runeColumns.length > 0 ? (
        <div className="public-match-rune-board">
          {runeColumns.map((column) => (
            <div className={column.className} key={column.key}>
              <strong className={column.titleClassName}>
                {column.titleIcon ? (
                  <span className={column.titleIcon.className} title={column.titleIcon.title}>
                    {column.titleIcon.iconUrl ? <img src={column.titleIcon.iconUrl} alt="" /> : <i>{column.titleIcon.fallbackLabel}</i>}
                  </span>
                ) : null}
                <em>{column.title}</em>
              </strong>
              {column.rows.map((row) => (
                <div className={row.className} key={row.key}>
                  {row.slots.map((slot) => (
                    <span className={slot.className} title={slot.title} key={slot.key}>
                      {slot.iconUrl ? <img src={slot.iconUrl} alt="" /> : <i>{slot.fallbackLabel}</i>}
                    </span>
                  ))}
                </div>
              ))}
            </div>
          ))}
        </div>
      ) : (
        <p className="public-empty">{noDataLabel}</p>
      )}
    </>
  );
}
