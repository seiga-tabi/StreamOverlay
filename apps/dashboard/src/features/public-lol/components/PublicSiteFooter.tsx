import type { MouseEvent } from "react";

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
  const navigate = (event: MouseEvent<HTMLAnchorElement>, page: PublicSiteFooterPage) => {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    event.preventDefault();
    onPage(page);
  };
  return (
    <footer className="public-site-footer">
      <nav
        aria-label={`${text.privacy.label} · ${text.terms.label} · ${text.contact.label}`}
        className="public-site-footer-nav"
        data-ja={`${text.privacy.ja} · ${text.terms.ja} · ${text.contact.ja}`}
        data-ko={`${text.privacy.ko} · ${text.terms.ko} · ${text.contact.ko}`}
      >
        <a
          data-ja={text.privacy.ja}
          data-ko={text.privacy.ko}
          href="/privacy"
          onClick={(event) => navigate(event, "privacy")}
        >
          {text.privacy.label}
        </a>
        <a
          data-ja={text.terms.ja}
          data-ko={text.terms.ko}
          href="/terms"
          onClick={(event) => navigate(event, "terms")}
        >
          {text.terms.label}
        </a>
        <a
          data-ja={text.contact.ja}
          data-ko={text.contact.ko}
          href="/contact"
          onClick={(event) => navigate(event, "contact")}
        >
          {text.contact.label}
        </a>
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
