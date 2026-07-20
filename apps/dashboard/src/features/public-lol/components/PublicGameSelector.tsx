import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { publicI18n, t } from "../i18n/public-lol-i18n";
import type { PublicMainPage } from "../types/public-lol";

export type PublicGameId = "league-of-legends" | "valorant" | "palworld" | "minecraft";

type PublicGameOption = {
  id: PublicGameId;
  page?: Extract<PublicMainPage, "search" | "palworld">;
  logo?: string;
  mark?: string;
  ko: string;
  ja: string;
  subtitleKo: string;
  subtitleJa: string;
};

export type PublicGameSelectorProps = {
  activePage: PublicMainPage;
  onPage: (page: PublicMainPage) => void;
  mode?: "dropdown" | "tray";
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
};

const preferredGameKey = "preferredGame";

const games: PublicGameOption[] = [
  {
    id: "league-of-legends",
    page: "search",
    logo: "/images/games/league-of-legends.png",
    ko: publicI18n.ko.leagueOfLegends,
    ja: publicI18n.ja.leagueOfLegends,
    subtitleKo: publicI18n.ko.leagueOfLegendsSubtitle,
    subtitleJa: publicI18n.ja.leagueOfLegendsSubtitle
  },
  {
    id: "valorant",
    mark: "V",
    ko: publicI18n.ko.valorant,
    ja: publicI18n.ja.valorant,
    subtitleKo: publicI18n.ko.valorantSubtitle,
    subtitleJa: publicI18n.ja.valorantSubtitle
  },
  {
    id: "palworld",
    page: "palworld",
    logo: "/images/games/palworld.png",
    ko: publicI18n.ko.palworld,
    ja: publicI18n.ja.palworld,
    subtitleKo: publicI18n.ko.palworldSubtitle,
    subtitleJa: publicI18n.ja.palworldSubtitle
  },
  {
    id: "minecraft",
    mark: "M",
    ko: publicI18n.ko.minecraft,
    ja: publicI18n.ja.minecraft,
    subtitleKo: publicI18n.ko.minecraftSubtitle,
    subtitleJa: publicI18n.ja.minecraftSubtitle
  }
];

function isPublicGameId(value: string | null): value is PublicGameId {
  return games.some((game) => game.id === value);
}

function gameIdForPage(page: PublicMainPage): PublicGameId | undefined {
  if (page === "search") return "league-of-legends";
  if (page === "palworld") return "palworld";
  return undefined;
}

function gameLabel(game: PublicGameOption): string {
  if (game.id === "league-of-legends") return t().leagueOfLegends;
  if (game.id === "valorant") return t().valorant;
  if (game.id === "palworld") return t().palworld;
  return t().minecraft;
}

function gameSubtitle(game: PublicGameOption): string {
  if (game.id === "league-of-legends") return t().leagueOfLegendsSubtitle;
  if (game.id === "valorant") return t().valorantSubtitle;
  if (game.id === "palworld") return t().palworldSubtitle;
  return t().minecraftSubtitle;
}

export function PublicGameSelector({
  activePage,
  onPage,
  mode = "dropdown",
  open: controlledOpen,
  onOpenChange
}: PublicGameSelectorProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [selectedGameId, setSelectedGameId] = useState<PublicGameId>(() => (
    gameIdForPage(activePage) ?? "league-of-legends"
  ));
  const selectorRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const open = controlledOpen ?? internalOpen;
  const selectedGame = games.find((game) => game.id === selectedGameId) ?? games[0]!;

  function setOpen(nextOpen: boolean): void {
    if (controlledOpen === undefined) {
      setInternalOpen(nextOpen);
    }
    onOpenChange?.(nextOpen);
  }

  function focusOption(index: number): void {
    const nextIndex = (index + games.length) % games.length;
    optionRefs.current[nextIndex]?.focus();
  }

  function selectGame(game: PublicGameOption): void {
    setSelectedGameId(game.id);
    window.localStorage.setItem(preferredGameKey, game.id);
    window.dispatchEvent(new CustomEvent("gamechange", { detail: { game: game.id } }));
    setOpen(false);
    if (game.page) {
      onPage(game.page);
    }
  }

  function handleOptionKeyDown(event: KeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(games.length - 1);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
    }
  }

  useEffect(() => {
    const routeGame = gameIdForPage(activePage);
    if (routeGame) {
      setSelectedGameId(routeGame);
      return;
    }

    const preferredGame = window.localStorage.getItem(preferredGameKey);
    if (isPublicGameId(preferredGame)) {
      setSelectedGameId(preferredGame);
    }
  }, [activePage]);

  useEffect(() => {
    const handleGameChange = (event: Event) => {
      const nextGame = (event as CustomEvent<{ game?: string }>).detail?.game ?? null;
      if (isPublicGameId(nextGame)) {
        setSelectedGameId(nextGame);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === preferredGameKey && isPublicGameId(event.newValue)) {
        setSelectedGameId(event.newValue);
      }
    };

    window.addEventListener("gamechange", handleGameChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener("gamechange", handleGameChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    if (!open || mode !== "dropdown") return undefined;

    const handlePointerDown = (event: PointerEvent) => {
      if (!selectorRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [mode, open]);

  const optionList = (
    <div
      className={mode === "tray" ? "public-game-selector-tray-list" : "public-game-selector-menu"}
      role="listbox"
      aria-label={t().gameMenu}
    >
      {games.map((game, index) => {
        const isSelected = selectedGameId === game.id;
        const isAvailable = Boolean(game.page);

        return (
          <button
            className={`public-game-selector-option${isSelected ? " active" : ""}${isAvailable ? "" : " is-coming-soon"}`}
            type="button"
            role="option"
            aria-selected={isSelected}
            data-ko={game.ko}
            data-ja={game.ja}
            onClick={() => selectGame(game)}
            onKeyDown={(event) => handleOptionKeyDown(event, index)}
            ref={(node) => {
              optionRefs.current[index] = node;
            }}
            key={game.id}
          >
            {game.logo ? (
              <img
                className={`public-game-selector-logo is-${game.id}`}
                src={game.logo}
                alt=""
                aria-hidden="true"
              />
            ) : (
              <span className={`public-game-selector-mark is-${game.id}`} aria-hidden="true">
                {game.mark}
              </span>
            )}
            <span className="public-game-selector-copy">
              <strong data-ko={game.ko} data-ja={game.ja}>{gameLabel(game)}</strong>
              <small data-ko={game.subtitleKo} data-ja={game.subtitleJa}>
                {gameSubtitle(game)}
              </small>
            </span>
            <span className="public-game-selector-meta">
              {!isAvailable ? (
                <small
                  className="public-game-selector-status"
                  data-ko={publicI18n.ko.comingSoon}
                  data-ja={publicI18n.ja.comingSoon}
                >
                  {t().comingSoon}
                </small>
              ) : null}
              {isSelected ? <span className="public-game-selector-check" aria-hidden="true">✓</span> : null}
            </span>
          </button>
        );
      })}
    </div>
  );

  if (mode === "tray") {
    return (
      <div className="public-game-selector public-game-selector-tray" ref={selectorRef}>
        {optionList}
      </div>
    );
  }

  return (
    <div className={`public-game-selector${open ? " is-open" : ""}`} ref={selectorRef}>
      <button
        className="public-game-selector-trigger"
        type="button"
        aria-label={t().gameMenu}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(event) => {
          if (event.key === "ArrowDown" || event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setOpen(true);
            window.requestAnimationFrame(() => focusOption(Math.max(0, games.findIndex((game) => game.id === selectedGameId))));
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      >
        {selectedGame.logo ? (
          <img
            className={`public-game-selector-logo is-${selectedGame.id}`}
            src={selectedGame.logo}
            alt=""
            aria-hidden="true"
          />
        ) : (
          <span className={`public-game-selector-mark is-${selectedGame.id}`} aria-hidden="true">
            {selectedGame.mark}
          </span>
        )}
        <span className="public-game-selector-label" data-ko={selectedGame.ko} data-ja={selectedGame.ja}>
          {gameLabel(selectedGame)}
        </span>
        <span className="public-game-selector-chevron" aria-hidden="true">⌄</span>
      </button>
      {open ? optionList : null}
    </div>
  );
}
