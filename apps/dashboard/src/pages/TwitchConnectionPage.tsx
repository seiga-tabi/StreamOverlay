import { EventSubStatusCard } from "../components/EventSubStatusCard";
import { TwitchConnectionCard } from "../components/TwitchConnectionCard";
import { uiText } from "../i18n";
import { AppShell, AppShellHeader, AppShellMain, AppShellSidebar } from "../shared/ui/AppShell";
import { Badge, StatusPill } from "../shared/ui/Status";
import { Navigation, NavigationBadge, NavigationItem, NavigationSection } from "../shared/ui/Navigation";
import { PageHeader, PageHeaderActions, PageHeaderDescription, PageHeaderEyebrow, PageHeaderStatus, PageHeaderTitle } from "../shared/ui/PageHeader";

export function TwitchConnectionPage() {
  const t = uiText.twitchPage;

  return (
    <AppShell
      as="section"
      className="settings-shared-shell"
      mainId="twitch-settings-shared-main"
      skipLinkLabel={t.title}
      variant="streamer"
    >
      <AppShellHeader className="settings-shared-header">
        <PageHeader className="settings-shared-page-header" layout="split">
          <PageHeaderEyebrow>Twitch Studio</PageHeaderEyebrow>
          <PageHeaderTitle>{t.title}</PageHeaderTitle>
          <PageHeaderDescription>{t.description}</PageHeaderDescription>
          <PageHeaderStatus>
            <StatusPill tone="streamer">OAuth</StatusPill>
          </PageHeaderStatus>
          <PageHeaderActions>
            <Badge tone="info">EventSub</Badge>
          </PageHeaderActions>
        </PageHeader>
      </AppShellHeader>

      <AppShellSidebar as="nav" className="settings-shared-sidebar">
        <Navigation aria-label={t.title} variant="streamer">
          <NavigationSection title="Twitch">
            <NavigationItem as="a" href="#twitch-settings-account" badge={<NavigationBadge>OAuth</NavigationBadge>}>
              Account
            </NavigationItem>
            <NavigationItem as="a" href="#twitch-settings-eventsub" badge={<NavigationBadge>WS</NavigationBadge>}>
              EventSub
            </NavigationItem>
          </NavigationSection>
        </Navigation>
      </AppShellSidebar>

      <AppShellMain className="settings-shared-main" id="twitch-settings-shared-main">
        <div className="settings-shared-grid settings-shared-grid--two">
          <section id="twitch-settings-account">
            <TwitchConnectionCard />
          </section>
          <section id="twitch-settings-eventsub">
            <EventSubStatusCard />
          </section>
        </div>
      </AppShellMain>
    </AppShell>
  );
}
