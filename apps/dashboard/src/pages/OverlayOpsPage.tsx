import type { DashboardStreamerInfo } from "../api/client";
import { AlertAssetPanel } from "../components/AlertAssetPanel";
import { OverlayClientStatusCard } from "../components/OverlayClientStatusCard";
import { OverlayTestPanel } from "../components/OverlayTestPanel";
import { RewardMappingPanel } from "../components/RewardMappingPanel";
import { createDashboardLocaleProxy, uiText } from "../i18n";
import {
  AppShell,
  AppShellHeader,
  AppShellMain,
} from "../shared/ui/AppShell";
import {
  PageHeader,
  PageHeaderActions,
  PageHeaderDescription,
  PageHeaderEyebrow,
  PageHeaderStatus,
  PageHeaderTitle,
} from "../shared/ui/PageHeader";
import { Badge, StatusPill } from "../shared/ui/Status";

type OverlayOpsView = "status" | "test" | "rewards" | "alerts";

const overlayStudioNavigation = {
  ko: {
    alerts: "알림 GIF",
    browserSource: "OBS Source",
    copyFlow: "URL 복사",
    current: "현재",
    rewards: "Reward",
    skipLink: "Overlay Studio 본문으로 이동",
    studio: "Overlay Studio",
    test: "테스트",
  },
  ja: {
    alerts: "通知 GIF",
    browserSource: "OBS Source",
    copyFlow: "URL コピー",
    current: "現在",
    rewards: "Reward",
    skipLink: "Overlay Studio 本文へ移動",
    studio: "Overlay Studio",
    test: "テスト",
  },
} as const;

const overlayStudioText = createDashboardLocaleProxy(overlayStudioNavigation);

function viewLabel(view: OverlayOpsView): string {
  if (view === "status") return overlayStudioText.browserSource;
  if (view === "test") return overlayStudioText.test;
  if (view === "rewards") return overlayStudioText.rewards;
  return overlayStudioText.alerts;
}

export function OverlayOpsPage({ view, streamer }: { view: OverlayOpsView; streamer?: DashboardStreamerInfo }) {
  const t = uiText.overlayOpsPage;
  const pageText = t.views[view];

  return (
    <AppShell
      as="section"
      className="overlay-studio-shell"
      mainId="overlay-studio-main"
      skipLinkLabel={overlayStudioText.skipLink}
      variant="streamer"
    >
      <AppShellHeader className="overlay-studio-header">
        <PageHeader className="overlay-studio-page-header" layout="split">
          <PageHeaderEyebrow>{overlayStudioText.studio}</PageHeaderEyebrow>
          <PageHeaderTitle>{pageText.title}</PageHeaderTitle>
          <PageHeaderDescription>{pageText.description}</PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone="streamer">{viewLabel(view)}</StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            <Badge tone="info">{overlayStudioText.current}</Badge>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellMain className="overlay-studio-main" id="overlay-studio-main">
        <div className="overlay-studio-grid" id="overlay-studio-panel">
          {view === "status" ? <OverlayClientStatusCard streamer={streamer} /> : null}
          {view === "test" ? <OverlayTestPanel /> : null}
          {view === "rewards" ? <RewardMappingPanel /> : null}
          {view === "alerts" ? <AlertAssetPanel /> : null}
        </div>
      </AppShellMain>
    </AppShell>
  );
}
