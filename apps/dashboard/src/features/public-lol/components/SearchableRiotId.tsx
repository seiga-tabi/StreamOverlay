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
  /* 새 탭으로 열 전적 페이지 경로(사용자 요청 2026-08-24). 있으면 button 대신
     진짜 링크로 그립니다 — 가운데 클릭·⌘클릭·「새 탭에서 열기」·링크 주소 복사가
     그대로 동작해야 하고, window.open 으로는 그중 어느 것도 얻지 못합니다.
     없으면(예: 현재 게임 패널) 지금처럼 화면 안에서 검색합니다. */
  href?: string;
  title?: string;
  badges: SearchableRiotIdBadgeViewModel[];
};

export type SearchableRiotIdProps = {
  viewModel: SearchableRiotIdViewModel;
  onSearch?: (riotId: string) => void;
};

export function SearchableRiotId({ viewModel, onSearch }: SearchableRiotIdProps) {
  const displayRiotId = viewModel.tag
    ? `${viewModel.name}#${viewModel.tag.replace(/^#/, "")}`
    : viewModel.name;

  if (viewModel.kind === "static" || !viewModel.riotId) {
    return (
      <strong className={viewModel.className}>
        <span className="public-riot-name">{displayRiotId}</span>
        <SearchableRiotIdBadges badges={viewModel.badges} />
      </strong>
    );
  }

  const riotId = viewModel.riotId;

  if (viewModel.href) {
    return (
      <a
        className={viewModel.className}
        href={viewModel.href}
        rel="noopener noreferrer"
        target="_blank"
        title={viewModel.title}
        /* 전적 행은 요약 전체가 펼침 토글이라 전파를 끊습니다(다시보기 링크와 같은 처리). */
        onClick={(event) => event.stopPropagation()}
      >
        <span className="public-riot-name">{displayRiotId}</span>
        <SearchableRiotIdBadges badges={viewModel.badges} />
      </a>
    );
  }

  return (
    <button
      className={viewModel.className}
      type="button"
      onClick={() => onSearch?.(riotId)}
      title={viewModel.title}
    >
      <span className="public-riot-name">{displayRiotId}</span>
      <SearchableRiotIdBadges badges={viewModel.badges} />
    </button>
  );
}

function SearchableRiotIdBadges({ badges }: { badges: SearchableRiotIdBadgeViewModel[] }) {
  if (badges.length === 0) return null;
  return (
    <span className="public-riot-award-badges">
      {badges.map((badge) => (
        <span className={badge.className} key={badge.key}  >
          {badge.label}
        </span>
      ))}
    </span>
  );
}
