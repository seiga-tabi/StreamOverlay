export type SearchableRiotIdBadgeViewModel = {
  key: string;
  className: string;
  label: string;
  ko: string;
  ja: string;
};

export type SearchableRiotIdViewModel = {
  kind: "static" | "button";
  className: string;
  name: string;
  tag?: string;
  riotId?: string;
  title?: string;
  badges: SearchableRiotIdBadgeViewModel[];
};

export type SearchableRiotIdProps = {
  viewModel: SearchableRiotIdViewModel;
  onSearch?: (riotId: string) => void;
};

export function SearchableRiotId({ viewModel, onSearch }: SearchableRiotIdProps) {
  if (viewModel.kind === "static" || !viewModel.riotId) {
    return (
      <strong className={viewModel.className}>
        <span className="public-riot-name">{viewModel.name}</span>
        <SearchableRiotIdBadges badges={viewModel.badges} />
      </strong>
    );
  }

  const riotId = viewModel.riotId;
  return (
    <button
      className={viewModel.className}
      type="button"
      onClick={() => onSearch?.(riotId)}
      title={viewModel.title}
    >
      <span className="public-riot-name">{viewModel.name}</span>
      {viewModel.tag ? <span className="public-riot-tag-badge">{viewModel.tag}</span> : null}
      <SearchableRiotIdBadges badges={viewModel.badges} />
    </button>
  );
}

function SearchableRiotIdBadges({ badges }: { badges: SearchableRiotIdBadgeViewModel[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="public-riot-award-badges">
      {badges.map((badge) => (
        <span className={badge.className} key={badge.key} data-ko={badge.ko} data-ja={badge.ja}>
          {badge.label}
        </span>
      ))}
    </span>
  );
}
