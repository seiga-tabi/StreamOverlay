import { useState, type MouseEvent, type ReactNode } from "react";

export type PublicGameHomeLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

type PublicGameHomeImageVariant = {
  avif: string;
  webp: string;
  jpg: string;
  width: number;
  height: number;
};

export type PublicGameHomeImageSet = {
  desktop: PublicGameHomeImageVariant;
  mobile: PublicGameHomeImageVariant;
};

export const PUBLIC_GAME_HOME_IMAGES: Record<"lol" | "palworld", PublicGameHomeImageSet> = {
  lol: {
    desktop: {
      avif: "/images/public-home/lol/desktop.8373f07fdc4f4b5a.avif",
      webp: "/images/public-home/lol/desktop.eac474d130d37c60.webp",
      jpg: "/images/public-home/lol/desktop.ca4cdeb7f85bdc91.jpg",
      width: 1215,
      height: 660,
    },
    mobile: {
      avif: "/images/public-home/lol/mobile.a3da908a356f4d12.avif",
      webp: "/images/public-home/lol/mobile.de241c226edf9ad5.webp",
      jpg: "/images/public-home/lol/mobile.3fb8e59b9224eb73.jpg",
      width: 785,
      height: 717,
    },
  },
  palworld: {
    desktop: {
      avif: "/images/public-home/palworld/desktop.c4149b938919145c.avif",
      webp: "/images/public-home/palworld/desktop.dfdafb785aa4b97e.webp",
      jpg: "/images/public-home/palworld/desktop.2b60a3c0916ddf0b.jpg",
      width: 1920,
      height: 760,
    },
    mobile: {
      avif: "/images/public-home/palworld/mobile.66eb386fdc0702b6.avif",
      webp: "/images/public-home/palworld/mobile.55006924a94b1dd3.webp",
      jpg: "/images/public-home/palworld/mobile.b44b7b700d569414.jpg",
      width: 780,
      height: 820,
    },
  },
};

export function PublicGameHomeHero({
  children,
  description,
  eyebrow,
  game,
  liveContent,
  search,
  title,
}: {
  children?: ReactNode;
  description: PublicGameHomeLocalizedText;
  eyebrow?: PublicGameHomeLocalizedText;
  game: "lol" | "palworld";
  liveContent: ReactNode;
  search: ReactNode;
  title: PublicGameHomeLocalizedText;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const images = PUBLIC_GAME_HOME_IMAGES[game];
  const titleId = `public-${game}-home-title`;

  return (
    <section
      className={`public-game-home public-game-home--${game}`}
      aria-labelledby={titleId}
      data-image-state={imageFailed ? "fallback" : "ready"}
    >
      <div className="public-game-home__hero">
        {!imageFailed ? (
          <picture className="public-game-home__picture" aria-hidden="true">
            <source media="(max-width: 48rem)" type="image/avif" srcSet={images.mobile.avif} />
            <source media="(max-width: 48rem)" type="image/webp" srcSet={images.mobile.webp} />
            <source media="(max-width: 48rem)" type="image/jpeg" srcSet={images.mobile.jpg} />
            <source type="image/avif" srcSet={images.desktop.avif} />
            <source type="image/webp" srcSet={images.desktop.webp} />
            <img
              alt=""
              decoding="async"
              height={images.desktop.height}
              onError={() => setImageFailed(true)}
              src={images.desktop.jpg}
              width={images.desktop.width}
              {...({ fetchpriority: "high" } as Record<string, string>)}
            />
          </picture>
        ) : null}
        <div className="public-game-home__image-overlay" aria-hidden="true" />
        <div className="public-game-home__hero-grid">
          <div className="public-game-home__copy">
            {eyebrow ? (
              <span
                className="public-game-home__eyebrow"
                data-ko={eyebrow.ko}
                data-ja={eyebrow.ja}
              >
                {eyebrow.label}
              </span>
            ) : null}
            <h1 id={titleId} data-ko={title.ko} data-ja={title.ja}>{title.label}</h1>
            <p data-ko={description.ko} data-ja={description.ja}>{description.label}</p>
            <div className="public-game-home__search">{search}</div>
            {children}
          </div>
          <div className="public-game-home__live">{liveContent}</div>
        </div>
      </div>
    </section>
  );
}

export function PublicHomeSectionHeader({
  description,
  title,
}: {
  description?: PublicGameHomeLocalizedText;
  title: PublicGameHomeLocalizedText;
}) {
  return (
    <header className="public-game-home__section-header">
      <h2 data-ko={title.ko} data-ja={title.ja}>{title.label}</h2>
      {description ? <p data-ko={description.ko} data-ja={description.ja}>{description.label}</p> : null}
    </header>
  );
}

export function PublicHomeFeaturePanel({
  children,
  className = "",
  description,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: PublicGameHomeLocalizedText;
  title: PublicGameHomeLocalizedText;
}) {
  return (
    <section className={`public-game-home__feature-panel ${className}`.trim()}>
      <PublicHomeSectionHeader description={description} title={title} />
      <div className="public-game-home__feature-list">{children}</div>
    </section>
  );
}

export function PublicHomeFeatureCard({
  ariaLabel,
  className = "",
  description,
  href,
  onClick,
  title,
  visual,
}: {
  ariaLabel?: string;
  className?: string;
  description: PublicGameHomeLocalizedText;
  href?: string;
  onClick?: () => void;
  title: PublicGameHomeLocalizedText;
  visual?: ReactNode;
}) {
  const content = (
    <>
      {visual ? <span className="public-game-home__feature-visual" aria-hidden="true">{visual}</span> : null}
      <span className="public-game-home__feature-copy">
        <strong data-ko={title.ko} data-ja={title.ja}>{title.label}</strong>
        <small data-ko={description.ko} data-ja={description.ja}>{description.label}</small>
      </span>
      <span aria-hidden="true">›</span>
    </>
  );
  const classes = `public-game-home__feature-card ${className}`.trim();

  if (href) {
    const navigate = (event: MouseEvent<HTMLAnchorElement>) => {
      if (
        event.defaultPrevented
        || event.button !== 0
        || event.metaKey
        || event.ctrlKey
        || event.shiftKey
        || event.altKey
      ) return;
      if (!onClick) return;
      event.preventDefault();
      onClick();
    };
    return <a aria-label={ariaLabel} className={classes} href={href} onClick={navigate}>{content}</a>;
  }

  return <button aria-label={ariaLabel} className={classes} type="button" onClick={onClick}>{content}</button>;
}
