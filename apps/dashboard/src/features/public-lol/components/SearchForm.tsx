import { useEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from "react";
import type { LolPlatformId, LolRankedStats } from "@streamops/shared";
import { Button } from "../../../shared/ui/Button";
import { FormControl, FormField, FormLabel, Input } from "../../../shared/ui/Form";
import { StatusPill } from "../../../shared/ui/Status";

export type SearchFormVariant = "legacy" | "homeShared" | "rankingShared";
export type SearchFormPanelTab = "summoners" | "recent" | "favorites";

export type SearchFormPanelRequest = {
  tab: SearchFormPanelTab;
  nonce: number;
};

export type SearchFormSuggestion = {
  gameName: string;
  tagLine: string;
  source: string;
  profileIconUrl?: string;
  rankedStats?: LolRankedStats;
  lolPlatform?: string;
};

export type SearchFormLocalizedText = {
  label: string;
  ko: string;
  ja: string;
};

export type SearchFormText = {
  searchServer: string;
  searchPlaceholder: SearchFormLocalizedText;
  searchPlaceholderShort: SearchFormLocalizedText;
  clearSearch: string;
  searching: string;
  search: string;
  summonerResults: SearchFormLocalizedText;
  recentSearches: SearchFormLocalizedText;
  favorites: SearchFormLocalizedText;
  noRecentSearches: SearchFormLocalizedText;
  noFavorites: SearchFormLocalizedText;
  relatedSummoners: string;
};

export type SearchFormPlatformOption = {
  id: LolPlatformId;
  code: string;
  label: SearchFormLocalizedText;
};

export type SearchFormHelpers<TSuggestion extends SearchFormSuggestion = SearchFormSuggestion> = {
  suggestionRiotId: (suggestion: TSuggestion) => string;
  suggestionSourceLabel: (suggestion: TSuggestion) => string;
  assetUrl: (url: string | undefined) => string | undefined;
  rankBadgeClass: (stats: LolRankedStats | undefined) => string;
  shortRankLabel: (stats: LolRankedStats | undefined) => string;
};

export type SearchFormProps<TSuggestion extends SearchFormSuggestion = SearchFormSuggestion> = {
  query: string;
  loading: boolean;
  platform: LolPlatformId;
  platformOptions: readonly SearchFormPlatformOption[];
  onQuery: (value: string) => void;
  onPlatformChange: (platform: LolPlatformId) => void;
  onClear: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  suggestions: TSuggestion[];
  recentSearches?: TSuggestion[];
  favorites?: TSuggestion[];
  panelRequest?: SearchFormPanelRequest;
  onPickSuggestion: (suggestion: TSuggestion) => void;
  controlId?: string;
  variant?: SearchFormVariant;
  text: SearchFormText;
  helpers: SearchFormHelpers<TSuggestion>;
};

function suggestionTierLabel(stats: LolRankedStats | undefined, fallbackLabel: string): string {
  if (!stats) return fallbackLabel;
  if (stats.tier === "UNRANKED") return "Unranked";
  const tierLabel = stats.tier
    .toLocaleLowerCase()
    .replace(/(^|_)([a-z])/g, (_, separator: string, letter: string) => `${separator ? " " : ""}${letter.toLocaleUpperCase()}`);
  return `${tierLabel}${stats.rank ? ` ${stats.rank}` : ""}`.trim();
}

function uniquePanelSuggestions<TSuggestion extends SearchFormSuggestion>(items: readonly TSuggestion[]): TSuggestion[] {
  const unique = new Map<string, TSuggestion>();
  for (const item of items) {
    const platform = item.lolPlatform?.trim().toLocaleLowerCase() ?? "";
    const riotId = `${item.gameName.trim()}#${item.tagLine.trim()}`.normalize("NFKC").toLocaleLowerCase();
    const key = `${platform}:${riotId}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  return [...unique.values()];
}

export function SearchForm<TSuggestion extends SearchFormSuggestion>({
  query,
  loading,
  platform,
  platformOptions,
  onQuery,
  onPlatformChange,
  onClear,
  onSubmit,
  suggestions,
  recentSearches = [],
  favorites = [],
  panelRequest,
  onPickSuggestion,
  controlId = "public-search-input",
  variant = "legacy",
  text,
  helpers,
}: SearchFormProps<TSuggestion>) {
  const [serverMenuOpen, setServerMenuOpen] = useState(false);
  const [suggestionsOpen, setSuggestionsOpen] = useState(false);
  const [activePanelTab, setActivePanelTab] = useState<SearchFormPanelTab>("summoners");
  const searchWrapRef = useRef<HTMLDivElement | null>(null);
  const hasQuery = query.trim().length > 0;
  const isHomeShared = variant === "homeShared";
  const isRankingShared = variant === "rankingShared";
  const isShared = isHomeShared || isRankingShared;
  const sharedClassPrefix = isHomeShared ? "public-home-shared" : isRankingShared ? "public-ranking-shared" : "";
  const placeholderText = isHomeShared ? text.searchPlaceholderShort : text.searchPlaceholder;
  const uniqueSuggestions = useMemo(() => uniquePanelSuggestions(suggestions), [suggestions]);
  const uniqueRecentSearches = useMemo(() => uniquePanelSuggestions(recentSearches), [recentSearches]);
  const uniqueFavorites = useMemo(() => uniquePanelSuggestions(favorites), [favorites]);
  const hasPanelContent = uniqueSuggestions.length > 0 || uniqueRecentSearches.length > 0 || uniqueFavorites.length > 0;
  const fallbackPanelTab: SearchFormPanelTab = uniqueSuggestions.length > 0
    ? "summoners"
    : uniqueRecentSearches.length > 0
      ? "recent"
      : "favorites";
  const resolvedPanelTab = activePanelTab === "summoners" && uniqueSuggestions.length === 0 ? fallbackPanelTab : activePanelTab;
  const activePanelItems = resolvedPanelTab === "summoners"
    ? uniqueSuggestions
    : resolvedPanelTab === "recent"
      ? uniqueRecentSearches
      : uniqueFavorites;
  const activePanelLabel = resolvedPanelTab === "summoners"
    ? text.summonerResults
    : resolvedPanelTab === "recent"
      ? text.recentSearches
      : text.favorites;
  const activeEmptyText = resolvedPanelTab === "favorites" ? text.noFavorites : text.noRecentSearches;
  const panelRequested = Boolean(panelRequest && activePanelTab === panelRequest.tab);
  const panelTabs: Array<{ key: SearchFormPanelTab; label: SearchFormLocalizedText; count: number }> = [
    ...(uniqueSuggestions.length > 0 ? [{ key: "summoners" as const, label: text.summonerResults, count: uniqueSuggestions.length }] : []),
    { key: "recent", label: text.recentSearches, count: uniqueRecentSearches.length },
    { key: "favorites", label: text.favorites, count: uniqueFavorites.length }
  ];
  const selectedPlatform = platformOptions.find((option) => option.id === platform) ?? platformOptions[0];

  function submitFromKeyboard(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }

  function handleQueryChange(value: string): void {
    setServerMenuOpen(false);
    setSuggestionsOpen(true);
    setActivePanelTab("summoners");
    onQuery(value);
  }

  function handleQueryFocus(): void {
    setServerMenuOpen(false);
    if (!hasPanelContent) return;
    if (!hasQuery) setActivePanelTab(uniqueRecentSearches.length > 0 ? "recent" : "favorites");
    setSuggestionsOpen(true);
  }

  function handleServerMenuToggle(): void {
    setServerMenuOpen((open) => {
      const nextOpen = !open;
      if (nextOpen) setSuggestionsOpen(false);
      return nextOpen;
    });
  }

  function handleClear(): void {
    setSuggestionsOpen(false);
    onClear();
  }

  function handlePlatformChange(nextPlatform: LolPlatformId): void {
    setServerMenuOpen(false);
    setSuggestionsOpen(false);
    onPlatformChange(nextPlatform);
  }

  function handlePickSuggestion(suggestion: TSuggestion): void {
    setSuggestionsOpen(false);
    onPickSuggestion(suggestion);
  }

  useEffect(() => {
    function handlePointerDown(event: PointerEvent): void {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (searchWrapRef.current?.contains(target)) return;
      setServerMenuOpen(false);
      setSuggestionsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  useEffect(() => {
    if (!panelRequest) return;
    setServerMenuOpen(false);
    setActivePanelTab(panelRequest.tab);
    setSuggestionsOpen(true);
    window.setTimeout(() => {
      const input = document.getElementById(controlId);
      if (input instanceof HTMLInputElement) input.focus();
    }, 0);
  }, [controlId, panelRequest?.nonce, panelRequest?.tab]);

  const renderSuggestionButton = (suggestion: TSuggestion, source: SearchFormPanelTab) => {
    const riotId = helpers.suggestionRiotId(suggestion);
    const sourceLabel = helpers.suggestionSourceLabel(suggestion);
    const rankedStats = suggestion.rankedStats;
    const lpLabel = rankedStats && rankedStats.tier !== "UNRANKED" ? `${rankedStats.leaguePoints}LP` : undefined;
    const tierIconUrl = helpers.assetUrl(rankedStats?.tierIconUrl);
    const shortLabel = helpers.shortRankLabel(rankedStats);
    const tierLabel = suggestionTierLabel(rankedStats, shortLabel);

    return (
      <button
        type="button"
        role="option"
        key={`${source}:${suggestion.lolPlatform ?? platform}:${riotId}`}
        aria-label={`${riotId} ${sourceLabel}`}
        title={sourceLabel}
        /* 티어명을 티어색으로 칠하는 CSS 훅(목업 연관 패널 — 우측 티어명+LP). */
        data-tier={rankedStats?.tier ? rankedStats.tier.toLocaleLowerCase() : "unranked"}
        onClick={() => handlePickSuggestion(suggestion)}
      >
        <span className="public-suggestion-avatar">
          {suggestion.profileIconUrl ? <img src={helpers.assetUrl(suggestion.profileIconUrl)} alt="" /> : suggestion.gameName.slice(0, 1).toUpperCase()}
        </span>
        <span className="public-suggestion-tier" aria-hidden="true">
          {tierIconUrl ? (
            <img src={tierIconUrl} alt="" />
          ) : (
            <span className={helpers.rankBadgeClass(rankedStats)}>{shortLabel}</span>
          )}
        </span>
        <span className="public-suggestion-name">
          <span>{suggestion.gameName}</span>
          <strong>#{suggestion.tagLine}</strong>
        </span>
        <span className="public-suggestion-rank-copy">
          <span>{tierLabel}</span>
          {lpLabel ? <small>{lpLabel}</small> : null}
        </span>
        {source === "favorites" ? <span className="public-suggestion-favorite-mark" aria-hidden="true">★</span> : null}
      </button>
    );
  };

  return (
    <div ref={searchWrapRef} className={`public-search-wrap ${isHomeShared ? "public-home-shared-search" : ""} ${isRankingShared ? "public-ranking-shared-search" : ""}`}>
      <form className={`public-search-form ${isHomeShared ? "public-home-shared-search-form" : ""} ${isRankingShared ? "public-ranking-shared-search-form" : ""}`} onSubmit={onSubmit}>
        <div className="public-search-server">
          {isShared ? (
            <Button
              aria-expanded={serverMenuOpen}
              aria-label={text.searchServer}
              className={`public-server-pill ${sharedClassPrefix}-server`}
              data-platform={selectedPlatform?.id ?? platform}
              disabled={loading}
              onClick={handleServerMenuToggle}
              rightIcon={<span className={`${sharedClassPrefix}-server-caret`} />}
              size="lg"
              type="button"
              variant="tertiary"
            >
              <StatusPill
                className="public-server-badge"
                data-platform={selectedPlatform?.id ?? platform}
                tone="info"
                size="sm"
              >
                {selectedPlatform?.code ?? "JP"}
              </StatusPill>
            </Button>
          ) : (
            <button
              type="button"
              className="public-server-pill"
              data-platform={selectedPlatform?.id ?? platform}
              aria-label={text.searchServer}
              aria-expanded={serverMenuOpen}
              onClick={handleServerMenuToggle}
              disabled={loading}
            >
              <strong>{selectedPlatform?.code ?? "JP"}</strong>
              <span aria-hidden="true" />
            </button>
          )}
          {serverMenuOpen ? (
            <div className="public-server-menu" role="listbox" aria-label={text.searchServer}>
              {platformOptions.map((option) => (
                <button
                  type="button"
                  role="option"
                  aria-selected={option.id === platform}
                  data-platform={option.id}
                  key={option.id}
                  onClick={() => handlePlatformChange(option.id)}
                >
                  <strong className="public-server-badge" data-platform={option.id}>{option.code}</strong>
                  <span>{option.label.label}</span>
                </button>
              ))}
            </div>
          ) : null}
        </div>
        {isShared ? (
          <FormField className={`public-search-field ${sharedClassPrefix}-field`} controlId={controlId} loading={loading}>
            <FormLabel className="sr-only"  >{placeholderText.label}</FormLabel>
            <FormControl className={`${sharedClassPrefix}-control`} loading={loading}>
              <Input
                className={`${sharedClassPrefix}-input`}
                id={controlId}
                name="riotId"
                type="search"
                value={query}
                placeholder={placeholderText.label}


                enterKeyHint="search"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                onChange={(event) => handleQueryChange(event.target.value)}
                onFocus={handleQueryFocus}
                onKeyDown={submitFromKeyboard}
                disabled={loading}
              />
            </FormControl>
          </FormField>
        ) : (
          <label className="public-search-field">
            <span className="sr-only"  >{text.searchPlaceholder.label}</span>
            <input
              id={controlId}
              name="riotId"
              type="search"
              value={query}
              placeholder={text.searchPlaceholder.label}


              enterKeyHint="search"
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              onChange={(event) => handleQueryChange(event.target.value)}
              onFocus={handleQueryFocus}
              onKeyDown={submitFromKeyboard}
              disabled={loading}
            />
          </label>
        )}
        <div className="public-search-actions">
          {hasQuery ? isShared ? (
            <Button
              aria-label={text.clearSearch}
              className={`${sharedClassPrefix}-icon-button ${sharedClassPrefix}-clear`}
              disabled={loading}
              onClick={handleClear}
              size="md"
              type="button"
              variant="ghost"
            >
              <span aria-hidden="true" />
            </Button>
          ) : (
            <button
              type="button"
              className="public-search-icon-button public-search-clear"
              aria-label={text.clearSearch}
              onClick={handleClear}
              disabled={loading}
            >
              <span aria-hidden="true" />
            </button>
          ) : null}
          {isShared ? (
            <Button
              aria-label={loading ? text.searching : text.search}
              className={`${sharedClassPrefix}-icon-button ${sharedClassPrefix}-submit`}
              disabled={!hasQuery}
              loading={loading}
              loadingLabel={text.searching}
              size="md"
              type="submit"
              variant="primary"
            >
              <span aria-hidden="true" />
              {isHomeShared ? <strong  >{text.search}</strong> : null}
            </Button>
          ) : (
            <button
              type="submit"
              className={`public-search-icon-button public-search-submit ${loading ? "loading" : ""}`}
              aria-label={loading ? text.searching : text.search}
              disabled={loading || !hasQuery}
            >
              <span aria-hidden="true" />
            </button>
          )}
        </div>
      </form>
      {!loading && !serverMenuOpen && suggestionsOpen && (hasPanelContent || panelRequested) ? (
        <div className="public-suggestion-panel">
          <div className="public-suggestion-tabs" role="tablist" aria-label={text.relatedSummoners}>
            {panelTabs.map((tab) => (
              <button
                type="button"
                key={tab.key}
                className={resolvedPanelTab === tab.key ? "active" : ""}
                role="tab"
                aria-selected={resolvedPanelTab === tab.key}
                onClick={() => setActivePanelTab(tab.key)}
              >
                <span  >{tab.label.label}</span>
                <em>{tab.count}</em>
              </button>
            ))}
          </div>
          <div className="public-suggestion-title"  >{activePanelLabel.label}</div>
          <div key={resolvedPanelTab} className="public-suggestion-list" role="listbox" aria-label={text.relatedSummoners}>
            {activePanelItems.length > 0 ? (
              activePanelItems.map((suggestion) => renderSuggestionButton(suggestion, resolvedPanelTab))
            ) : (
              <div className="public-suggestion-empty" role="status"  >
                {activeEmptyText.label}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
