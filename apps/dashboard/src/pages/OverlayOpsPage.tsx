import type { DashboardStreamerInfo } from "../api/client";
import { AlertAssetPanel } from "../components/AlertAssetPanel";
import { OverlayClientStatusCard } from "../components/OverlayClientStatusCard";
import { OverlayTestPanel } from "../components/OverlayTestPanel";
import { RewardMappingPanel } from "../components/RewardMappingPanel";
import { uiText } from "../i18n";

type OverlayOpsView = "status" | "test" | "rewards" | "alerts";

export function OverlayOpsPage({ view, streamer }: { view: OverlayOpsView; streamer?: DashboardStreamerInfo }) {
  const t = uiText.overlayOpsPage;
  const pageText = t.views[view];

  return (
    <>
      <header className="page-header compact">
        <div>
          <h1>{pageText.title}</h1>
          <p className="muted">{pageText.description}</p>
        </div>
      </header>
      <div className="ops-grid">
        {view === "status" ? <OverlayClientStatusCard streamer={streamer} /> : null}
        {view === "test" ? <OverlayTestPanel /> : null}
        {view === "rewards" ? <RewardMappingPanel /> : null}
        {view === "alerts" ? <AlertAssetPanel /> : null}
      </div>
    </>
  );
}
