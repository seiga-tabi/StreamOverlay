import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { DiscordSymbolIcon } from "./DiscordSymbolIcon";
import { TwitchGlitchIcon } from "./TwitchGlitchIcon";

export type PublicTwitchAccountUser = {
  login?: string;
  displayName: string;
  profileImageUrl?: string;
  provider?: "discord" | "twitch";
};

export type PublicTwitchAccountMenuAction = {
  id: string;
  label: ReactNode;
  onSelect: () => void;
  variant?: "default" | "dashboard";
};

export type PublicTwitchAccountChipProps = {
  configured: boolean;
  connected: boolean;
  user?: PublicTwitchAccountUser;
  open: boolean;
  loginLabel: string;
  loginLabelJa?: string;
  loginLabelKo?: string;
  loginTitle: string;
  loginMenuLabel?: string;
  discordLoginLabel?: string;
  twitchLoginLabel?: string;
  menuLabel: string;
  logoutLabel: string;
  logoutLabelJa?: string;
  logoutLabelKo?: string;
  menuActions?: PublicTwitchAccountMenuAction[];
  onDiscordLogin?: () => void;
  onLogin: () => void;
  onLogout: () => void;
  onOpenChange: (open: boolean) => void;
};

export type PublicTwitchAccountPanelProps = {
  configured: boolean;
  connected: boolean;
  user?: PublicTwitchAccountUser;
  loginLabel: string;
  loginLoading?: boolean;
  loginLoadingLabel: string;
  discordLoginLabel?: string;
  twitchLoginLabel?: string;
  unavailableLabel: string;
  logoutLabel: string;
  menuActions?: PublicTwitchAccountMenuAction[];
  onAction?: () => void;
  onDiscordLogin?: () => void;
  onLogin: () => void;
  onLogout: () => void;
};

function AccountProviderIcon({
  provider
}: {
  provider: PublicTwitchAccountUser["provider"];
}) {
  return provider === "discord" ? <DiscordSymbolIcon /> : <TwitchGlitchIcon />;
}

function accountProviderLabel(user: PublicTwitchAccountUser | undefined): string | undefined {
  if (user?.provider === "discord") return "Discord";
  if (user?.provider === "twitch") return "Twitch";
  return undefined;
}

export function PublicTwitchAccountPanel({
  configured,
  connected,
  user,
  loginLabel,
  loginLoading = false,
  loginLoadingLabel,
  discordLoginLabel,
  twitchLoginLabel,
  unavailableLabel,
  logoutLabel,
  menuActions = [],
  onAction,
  onDiscordLogin,
  onLogin,
  onLogout,
}: PublicTwitchAccountPanelProps) {
  const displayName = user?.displayName || user?.login || loginLabel;

  if (!connected) {
    const unifiedLogin = Boolean(
      onDiscordLogin && discordLoginLabel && twitchLoginLabel
    );
    return (
      <div className="public-twitch-account-panel" aria-busy={loginLoading || undefined}>
        {unifiedLogin ? (
          <div className="public-account-login-options">
            <button
              className="public-account-login-option is-discord"
              disabled={loginLoading}
              onClick={() => {
                onAction?.();
                onDiscordLogin?.();
              }}
              type="button"
            >
              <DiscordSymbolIcon />
              <strong>{discordLoginLabel}</strong>
            </button>
            <button
              className="public-account-login-option is-twitch"
              disabled={!configured || loginLoading}
              onClick={() => {
                onAction?.();
                onLogin();
              }}
              type="button"
            >
              <TwitchGlitchIcon />
              <strong>{loginLoading ? loginLoadingLabel : twitchLoginLabel}</strong>
            </button>
          </div>
        ) : (
          <button
            className="public-twitch-account-panel__login"
            disabled={!configured || loginLoading}
            onClick={() => {
              onAction?.();
              onLogin();
            }}
            type="button"
          >
            <TwitchGlitchIcon />
            <strong>{loginLoading ? loginLoadingLabel : loginLabel}</strong>
          </button>
        )}
        {!configured ? (
          <p className="public-twitch-account-panel__status" role="status">
            {unavailableLabel}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="public-twitch-account-panel">
      <div className="public-twitch-account-panel__profile">
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            alt=""
            onError={(event) => {
              event.currentTarget.hidden = true;
              event.currentTarget.nextElementSibling?.removeAttribute("hidden");
            }}
          />
        ) : null}
        <span aria-hidden="true" hidden={Boolean(user?.profileImageUrl)}>
          <AccountProviderIcon provider={user?.provider} />
        </span>
        <div>
          <strong>{displayName}</strong>
          {user?.login
            ? <small>@{user.login}</small>
            : accountProviderLabel(user)
              ? <small>{accountProviderLabel(user)}</small>
              : null}
        </div>
      </div>
      <div className="public-twitch-account-panel__actions">
        {menuActions.map((action) => (
          <button
            className={action.variant === "dashboard" ? "dashboard" : undefined}
            key={action.id}
            onClick={() => {
              onAction?.();
              action.onSelect();
            }}
            type="button"
          >
            {action.label}
          </button>
        ))}
        <button
          className="danger"
          onClick={() => {
            onAction?.();
            onLogout();
          }}
          type="button"
        >
          {logoutLabel}
        </button>
      </div>
    </div>
  );
}

export function PublicTwitchAccountChip({
  configured,
  connected,
  user,
  open,
  loginLabel,
  loginLabelJa,
  loginLabelKo,
  loginTitle,
  loginMenuLabel,
  discordLoginLabel,
  twitchLoginLabel,
  menuLabel,
  logoutLabel,
  logoutLabelJa,
  logoutLabelKo,
  menuActions = [],
  onDiscordLogin,
  onLogin,
  onLogout,
  onOpenChange
}: PublicTwitchAccountChipProps) {
  const menuId = `public-twitch-account-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimerRef = useRef<number | undefined>(undefined);
  const unifiedLogin = Boolean(
    onDiscordLogin && discordLoginLabel && twitchLoginLabel
  );
  const menuItemCount = connected ? menuActions.length + 1 : unifiedLogin ? 2 : 0;

  function clearCloseTimer(): void {
    if (closeTimerRef.current === undefined) return;
    window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = undefined;
  }

  function closeMenu({ restoreFocus = false } = {}): void {
    clearCloseTimer();
    onOpenChange(false);
    if (restoreFocus) buttonRef.current?.focus();
  }

  function scheduleClose(): void {
    if (!open) return;
    clearCloseTimer();
    closeTimerRef.current = window.setTimeout(() => {
      onOpenChange(false);
      closeTimerRef.current = undefined;
    }, 320);
  }

  function focusMenuItem(index: number): void {
    if (menuItemCount < 1) return;
    const nextIndex = (index + menuItemCount) % menuItemCount;
    menuItemRefs.current[nextIndex]?.focus();
  }

  function handleMenuItemKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number): void {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(menuItemCount - 1);
    } else if (event.key === "Tab") {
      closeMenu();
    }
  }

  useEffect(() => {
    if (!open) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeMenu();
    };
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") closeMenu({ restoreFocus: true });
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => focusMenuItem(0));
    return () => window.cancelAnimationFrame(frame);
  }, [menuItemCount, open]);

  useEffect(() => () => clearCloseTimer(), []);

  const displayName = user?.displayName || user?.login || loginLabel;

  return (
    <div
      className={`public-twitch-profile-wrap ${open ? "menu-open" : ""}`}
      ref={rootRef}
      onMouseEnter={clearCloseTimer}
      onMouseLeave={scheduleClose}
    >
      <button
        aria-controls={connected || unifiedLogin ? menuId : undefined}
        aria-expanded={connected || unifiedLogin ? open : false}
        aria-haspopup={connected || unifiedLogin ? "menu" : undefined}
        className={`public-twitch-login-chip ${connected ? "connected" : ""}`}
        disabled={!connected && !configured && !unifiedLogin}
        onClick={() => {
          if (!connected) {
            if (unifiedLogin) {
              onOpenChange(!open);
              return;
            }
            onLogin();
            return;
          }
          onOpenChange(!open);
        }}
        ref={buttonRef}
        title={connected ? displayName : loginTitle}
        type="button"
      >
        {user?.profileImageUrl ? (
          <img src={user.profileImageUrl} alt="" />
        ) : (
          <span aria-hidden="true">
            {connected ? (
              <AccountProviderIcon provider={user?.provider} />
            ) : !unifiedLogin ? (
              <TwitchGlitchIcon />
            ) : (
              <svg className="public-account-login-icon" fill="none" viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.8" />
                <path d="M5.5 20c.5-4 2.7-6 6.5-6s6 2 6.5 6" stroke="currentColor" strokeLinecap="round" strokeWidth="1.8" />
              </svg>
            )}
          </span>
        )}
        <strong
          data-ja={connected ? undefined : loginLabelJa}
          data-ko={connected ? undefined : loginLabelKo}
        >
          {connected ? displayName : loginLabel}
        </strong>
      </button>
      {connected && open ? (
        <div className="public-twitch-profile-menu" id={menuId} role="menu" aria-label={menuLabel}>
          <div className="public-twitch-profile-menu-head" role="presentation">
            {user?.profileImageUrl
              ? <img src={user.profileImageUrl} alt="" />
              : <span aria-hidden="true"><AccountProviderIcon provider={user?.provider} /></span>}
            <div>
              <strong>{displayName}</strong>
              {user?.login
                ? <small>@{user.login}</small>
                : accountProviderLabel(user)
                  ? <small>{accountProviderLabel(user)}</small>
                  : null}
            </div>
          </div>
          {menuActions.map((action, index) => (
            <button
              className={action.variant === "dashboard" ? "dashboard" : undefined}
              key={action.id}
              onKeyDown={(event) => handleMenuItemKeyDown(event, index)}
              onClick={() => {
                closeMenu();
                action.onSelect();
              }}
              role="menuitem"
              ref={(node) => {
                menuItemRefs.current[index] = node;
              }}
              type="button"
            >
              {action.label}
            </button>
          ))}
          <button
            data-ja={logoutLabelJa}
            data-ko={logoutLabelKo}
            type="button"
            role="menuitem"
            onKeyDown={(event) => handleMenuItemKeyDown(event, menuActions.length)}
            ref={(node) => {
              menuItemRefs.current[menuActions.length] = node;
            }}
            onClick={() => {
              closeMenu();
              onLogout();
            }}
          >
            {logoutLabel}
          </button>
        </div>
      ) : !connected && unifiedLogin && open ? (
        <div
          className="public-twitch-profile-menu public-account-login-menu"
          id={menuId}
          role="menu"
          aria-label={loginMenuLabel ?? loginTitle}
        >
          <button
            className="public-account-login-menu__option is-discord"
            onClick={() => {
              closeMenu();
              onDiscordLogin?.();
            }}
            onKeyDown={(event) => handleMenuItemKeyDown(event, 0)}
            ref={(node) => {
              menuItemRefs.current[0] = node;
            }}
            role="menuitem"
            type="button"
          >
            <DiscordSymbolIcon />
            <strong>{discordLoginLabel}</strong>
          </button>
          <button
            className="public-account-login-menu__option is-twitch"
            disabled={!configured}
            onClick={() => {
              closeMenu();
              onLogin();
            }}
            onKeyDown={(event) => handleMenuItemKeyDown(event, 1)}
            ref={(node) => {
              menuItemRefs.current[1] = node;
            }}
            role="menuitem"
            type="button"
          >
            <TwitchGlitchIcon />
            <strong>{twitchLoginLabel}</strong>
          </button>
        </div>
      ) : null}
    </div>
  );
}
