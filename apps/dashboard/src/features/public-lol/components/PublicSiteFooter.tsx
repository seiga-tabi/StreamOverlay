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
        <button type="button" onClick={() => onPage("privacy")}  >
          {text.privacy.label}
        </button>
        <button type="button" onClick={() => onPage("terms")}  >
          {text.terms.label}
        </button>
        <button type="button" onClick={() => onPage("contact")}  >
          {text.contact.label}
        </button>
      </nav>
      <div className="public-site-footer-brand" aria-label="YORO.gg">
        <span className="public-site-footer-brand-mark" aria-hidden="true">よろ</span>
        <span className="public-site-footer-brand-word">YORO.gg</span>
      </div>
      <p  >{text.riotDisclaimer.label}</p>
      <strong  >{text.copyright.label}</strong>
    </footer>
  );
}
