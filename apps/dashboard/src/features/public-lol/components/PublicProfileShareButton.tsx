import { useEffect, useRef, useState } from "react";
import { Button } from "../../../shared/ui/Button";

export type PublicProfileShareButtonProps = {
  copiedLabel: string;
  copyFailedLabel: string;
  label: string;
  text: string;
  title: string;
  url: string;
};

type ShareStatus = "idle" | "copied" | "failed";

export function PublicProfileShareButton({
  copiedLabel,
  copyFailedLabel,
  label,
  text,
  title,
  url,
}: PublicProfileShareButtonProps) {
  const [status, setStatus] = useState<ShareStatus>("idle");
  const resetTimer = useRef<number | undefined>(undefined);

  useEffect(() => () => {
    if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
  }, []);

  const updateStatus = (next: ShareStatus) => {
    setStatus(next);
    if (resetTimer.current !== undefined) window.clearTimeout(resetTimer.current);
    resetTimer.current = window.setTimeout(() => setStatus("idle"), 2_500);
  };

  const copyCanonicalUrl = async () => {
    try {
      if (typeof navigator.clipboard?.writeText !== "function") throw new Error("클립보드 API를 사용할 수 없습니다.");
      await navigator.clipboard.writeText(url);
      updateStatus("copied");
    } catch {
      updateStatus("failed");
    }
  };

  const onShare = async () => {
    if (typeof navigator.share !== "function") {
      await copyCanonicalUrl();
      return;
    }
    try {
      await navigator.share({ title, text, url });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyCanonicalUrl();
    }
  };

  const statusLabel = status === "copied"
    ? copiedLabel
    : status === "failed"
      ? copyFailedLabel
      : "";

  return (
    <span className="public-profile-share-action">
      <Button
        type="button"
        className="public-secondary-action public-profile-share-button"
        data-share-url={url}
        onClick={() => void onShare()}
        size="md"
        variant="tertiary"
      >
        <span aria-hidden="true">↗</span>
        <strong>{status === "copied" ? copiedLabel : label}</strong>
      </Button>
      <span className="public-profile-share-status" role={status === "failed" ? "alert" : "status"} aria-live="polite">
        {statusLabel}
      </span>
    </span>
  );
}
