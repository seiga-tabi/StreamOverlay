import { AppShellFooter } from "../../../shared/ui/AppShell";
import { palworldI18n, type PalworldLocale } from "../i18n/palworld-i18n";

const PALWORLD_OFFICIAL_URL = "https://www.palworldgame.com/";
const POCKETPAIR_OFFICIAL_URL = "https://www.pocketpair.jp/";

function ExternalSourceLink({
  children,
  href,
  locale,
}: {
  children: string;
  href: string;
  locale: PalworldLocale;
}) {
  return (
    <a
      aria-label={`${children} · ${palworldI18n[locale].externalLink}`}
      data-ja={`${children} · ${palworldI18n.ja.externalLink}`}
      data-ko={`${children} · ${palworldI18n.ko.externalLink}`}
      href={href}
      rel="noopener noreferrer"
      target="_blank"
    >
      {children}
    </a>
  );
}

export function PalworldSourceFooter({ locale }: { locale: PalworldLocale }) {
  const text = palworldI18n[locale];
  const palworldLabelStart = text.sourceNotice.indexOf("Palworld");
  const pocketpairLabelStart = text.sourceNotice.indexOf("Pocketpair", palworldLabelStart);
  const noticePrefix = text.sourceNotice.slice(0, palworldLabelStart);
  const sourceSeparator = text.sourceNotice.slice(palworldLabelStart + "Palworld".length, pocketpairLabelStart);
  return (
    <AppShellFooter
      aria-label={text.footerLabel}
      className="palworld-footer"
      data-testid="palworld-source-footer"
    >
      <strong>YORO.gg</strong>
      <p
        data-ja={palworldI18n.ja.sourceNotice}
        data-ko={palworldI18n.ko.sourceNotice}
      >
        {noticePrefix}
        <ExternalSourceLink href={PALWORLD_OFFICIAL_URL} locale={locale}>Palworld</ExternalSourceLink>
        {sourceSeparator}
        <ExternalSourceLink href={POCKETPAIR_OFFICIAL_URL} locale={locale}>Pocketpair</ExternalSourceLink>
      </p>
    </AppShellFooter>
  );
}
