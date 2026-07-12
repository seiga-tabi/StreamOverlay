export type PublicSiteFooterPage = "privacy" | "terms" | "contact";

export type PublicSiteFooterLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type PublicSiteFooterText = {
  privacy: PublicSiteFooterLocalizedText;
  terms: PublicSiteFooterLocalizedText;
  contact: PublicSiteFooterLocalizedText;
  riotDisclaimer: PublicSiteFooterLocalizedText;
  copyright: PublicSiteFooterLocalizedText;
};

export function PublicSiteFooter({
  onPage,
  text,
}: {
  onPage: (page: PublicSiteFooterPage) => void;
  text: PublicSiteFooterText;
}) {
  return (
    <footer className="public-site-footer">
      <nav className="public-site-footer-nav" aria-label="public footer">
        <button type="button" onClick={() => onPage("privacy")} data-ko={text.privacy.ko} data-ja={text.privacy.ja}>
          {text.privacy.label}
        </button>
        <button type="button" onClick={() => onPage("terms")} data-ko={text.terms.ko} data-ja={text.terms.ja}>
          {text.terms.label}
        </button>
        <button type="button" onClick={() => onPage("contact")} data-ko={text.contact.ko} data-ja={text.contact.ja}>
          {text.contact.label}
        </button>
      </nav>
      <div className="public-site-footer-brand" aria-label="YORO.gg">
        <span className="public-site-footer-brand-mark" aria-hidden="true">よろ</span>
        <span className="public-site-footer-brand-word">YORO.gg</span>
      </div>
      <p data-ko={text.riotDisclaimer.ko} data-ja={text.riotDisclaimer.ja}>{text.riotDisclaimer.label}</p>
      <strong data-ko={text.copyright.ko} data-ja={text.copyright.ja}>{text.copyright.label}</strong>
    </footer>
  );
}
