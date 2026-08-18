import { Button } from "../../../shared/ui/Button";

export type PublicProfileShareNotice = {
  message: string;
  tone: "success" | "danger";
};

export type PublicProfileShareButtonProps = {
  copiedLabel: string;
  copyFailedLabel: string;
  label: string;
  onNotice: (notice: PublicProfileShareNotice) => void;
  url: string;
};

function CopyLinkIcon() {
  return (
    <svg
      aria-hidden="true"
      className="public-profile-share-icon"
      fill="none"
      focusable="false"
      viewBox="0 0 24 24"
    >
      <rect height="11" rx="2" width="11" x="8" y="8" />
      <path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3" />
    </svg>
  );
}

export function PublicProfileShareButton({
  copiedLabel,
  copyFailedLabel,
  label,
  onNotice,
  url,
}: PublicProfileShareButtonProps) {
  const copyCanonicalUrl = async () => {
    try {
      if (typeof navigator.clipboard?.writeText !== "function") throw new Error("클립보드 API를 사용할 수 없습니다.");
      await navigator.clipboard.writeText(url);
      onNotice({ message: copiedLabel, tone: "success" });
    } catch {
      onNotice({ message: copyFailedLabel, tone: "danger" });
    }
  };

  return (
    <span className="public-profile-share-action">
      <Button
        aria-label={label}
        type="button"
        className="public-secondary-action public-profile-share-button"
        data-share-url={url}
        onClick={() => void copyCanonicalUrl()}
        size="md"
        title={label}
        variant="tertiary"
      >
        <CopyLinkIcon />
      </Button>
    </span>
  );
}
