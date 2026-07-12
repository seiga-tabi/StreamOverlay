import { apiBase } from "../api/client";
import { RiotApiKeyCard } from "../components/RiotApiKeyCard";
import { TwitchConnectionCard } from "../components/TwitchConnectionCard";
import { uiText } from "../i18n";
import { AppShell, AppShellHeader, AppShellMain, AppShellSidebar } from "../shared/ui/AppShell";
import { Badge, Metric, StatusPill } from "../shared/ui/Status";
import { Card, CardContent, CardHeader, CardTitle } from "../shared/ui/Card";
import { Navigation, NavigationBadge, NavigationItem, NavigationSection } from "../shared/ui/Navigation";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../shared/ui/PageHeader";

export function SettingsPage() {
  const t = uiText.settingsPage;

  return (
    <AppShell
      as="section"
      className="settings-shared-shell"
      mainId="settings-shared-main"
      skipLinkLabel={t.title}
      variant="streamer"
    >
      <AppShellHeader className="settings-shared-header">
        <PageHeader className="settings-shared-page-header" layout="split">
          <PageHeaderEyebrow>Settings Studio</PageHeaderEyebrow>
          <PageHeaderTitle>{t.title}</PageHeaderTitle>
          <PageHeaderDescription>{t.description}</PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone="info">OBS</StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            <Badge tone="streamer">{t.browserSource}</Badge>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellSidebar as="nav" className="settings-shared-sidebar">
        <Navigation aria-label={t.title} variant="streamer">
          <NavigationSection title={t.title}>
            <NavigationItem as="a" href="#settings-shared-twitch" badge={<NavigationBadge>OAuth</NavigationBadge>}>
              Twitch
            </NavigationItem>
            <NavigationItem as="a" href="#settings-shared-riot" badge={<NavigationBadge>Riot</NavigationBadge>}>
              Riot ID
            </NavigationItem>
            <NavigationItem as="a" href="#settings-shared-runtime">
              OBS URL
            </NavigationItem>
            <NavigationItem as="a" href="#settings-shared-safety" badge={<NavigationBadge>{t.warnings.length}</NavigationBadge>}>
              Safety
            </NavigationItem>
          </NavigationSection>
        </Navigation>
      </AppShellSidebar>

      <AppShellMain className="settings-shared-main" id="settings-shared-main">
        <div className="settings-shared-grid">
          <section id="settings-shared-twitch">
            <TwitchConnectionCard />
          </section>

          <section id="settings-shared-riot">
            <RiotApiKeyCard />
          </section>

          <Card as="section" className="settings-shared-card" id="settings-shared-runtime" padding="lg" variant="glass">
            <CardHeader className="settings-shared-card-header">
              <CardTitle as="h2">{t.browserSource}</CardTitle>
              <StatusPill tone="neutral">runtime</StatusPill>
            </CardHeader>
            <CardContent className="settings-shared-runtime-grid">
              <Metric label={t.overlayUrl} value="http://localhost:5174" tone="info" size="sm" />
              <Metric label={t.serverApi} value={apiBase} tone="streamer" size="sm" />
            </CardContent>
          </Card>

          <Card as="section" className="settings-shared-card settings-shared-safety" id="settings-shared-safety" padding="lg" variant="danger">
            <CardHeader className="settings-shared-card-header">
              <CardTitle as="h2">{t.safetyTitle}</CardTitle>
              <StatusPill tone="danger">{t.warnings.length}</StatusPill>
            </CardHeader>
            <CardContent>
              <ul className="settings-shared-note-list">
                {t.warnings.map((warning) => <li key={warning}>{warning}</li>)}
              </ul>
            </CardContent>
          </Card>
        </div>
      </AppShellMain>
    </AppShell>
  );
}
