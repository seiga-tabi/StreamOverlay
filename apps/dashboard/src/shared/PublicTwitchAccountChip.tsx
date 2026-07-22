import { useEffect, useId, useRef, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";

export type PublicTwitchAccountUser = {
  login: string;
  displayName: string;
  profileImageUrl?: string;
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
  menuLabel: string;
  logoutLabel: string;
  logoutLabelJa?: string;
  logoutLabelKo?: string;
  menuActions?: PublicTwitchAccountMenuAction[];
  onLogin: () => void;
  onLogout: () => void;
  onOpenChange: (open: boolean) => void;
};

export function PublicTwitchAccountChip({
  configured,
  connected,
  user,
  open,
  loginLabel,
  loginLabelJa,
  loginLabelKo,
  loginTitle,
  menuLabel,
  logoutLabel,
  logoutLabelJa,
  logoutLabelKo,
  menuActions = [],
  onLogin,
  onLogout,
  onOpenChange
}: PublicTwitchAccountChipProps) {
  const menuId = `public-twitch-account-${useId().replace(/:/g, "")}`;
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const menuItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const closeTimerRef = useRef<number | undefined>(undefined);

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
    const itemCount = menuActions.length + 1;
    const nextIndex = (index + itemCount) % itemCount;
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
      focusMenuItem(menuActions.length);
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
    if (open && (!configured || !connected)) onOpenChange(false);
  }, [configured, connected, onOpenChange, open]);

  useEffect(() => {
    if (!open) return undefined;
    const frame = window.requestAnimationFrame(() => focusMenuItem(0));
    return () => window.cancelAnimationFrame(frame);
  }, [menuActions.length, open]);

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
        aria-controls={connected ? menuId : undefined}
        aria-expanded={connected ? open : false}
        aria-haspopup={connected ? "menu" : undefined}
        className={`public-twitch-login-chip ${connected ? "connected" : ""}`}
        disabled={!configured}
        onClick={() => {
          if (!connected) {
            onLogin();
            return;
          }
          onOpenChange(!open);
        }}
        ref={buttonRef}
        title={connected ? displayName : loginTitle}
        type="button"
      >
        {user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : <span aria-hidden="true">T</span>}
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
            {user?.profileImageUrl ? <img src={user.profileImageUrl} alt="" /> : <span aria-hidden="true">T</span>}
            <div>
              <strong>{displayName}</strong>
              {user?.login ? <small>@{user.login}</small> : null}
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
      ) : null}
    </div>
  );
}
