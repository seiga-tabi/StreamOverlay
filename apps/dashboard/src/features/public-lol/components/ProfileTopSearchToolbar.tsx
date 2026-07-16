import type { ReactElement } from "react";
import { Badge } from "../../../shared/ui/Status";

export type ProfileTopSearchToolbarLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type ProfileTopSearchToolbarSearchRenderer = () => ReactElement | null;

export type ProfileTopSearchToolbarViewModel = {
  ariaLabel: string;
  cachedRanking: ProfileTopSearchToolbarLocalizedText;
  liveDataNotice: ProfileTopSearchToolbarLocalizedText;
  serverLabel: string;
  renderSearchForm: ProfileTopSearchToolbarSearchRenderer;
};

export type ProfileTopSearchToolbarProps = {
  toolbar: ProfileTopSearchToolbarViewModel;
};

export function ProfileTopSearchToolbar({
  toolbar,
}: ProfileTopSearchToolbarProps) {
  return (
    <div className="public-ranking-shared-toolbar" aria-label={toolbar.ariaLabel}>
      <div className="public-ranking-shared-toolbar-head">
        <div>
          <strong  >{toolbar.cachedRanking.label}</strong>
          <span className="public-ranking-shared-toolbar-note"  >{toolbar.liveDataNotice.label}</span>
        </div>
        <Badge size="sm" tone="info">{toolbar.serverLabel}</Badge>
      </div>
      {toolbar.renderSearchForm()}
    </div>
  );
}
