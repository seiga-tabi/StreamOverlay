import { useEffect, useState } from "react";
import type {
  TwitchExtensionConnectionState,
  TwitchExtensionInactiveBehavior,
  TwitchExtensionType,
} from "@streamops/shared";
import {
  DEFAULT_EXTENSION_DISPLAY,
  ExtensionOverlayCollapsed,
  ExtensionViewerPanel,
  type ExtensionDisplaySettings,
  type ExtensionViewerData,
  type ExtensionViewerStatus,
} from "./ExtensionViewer";
import { extensionCardI18n, type ExtensionLocale } from "./extension-i18n";
import {
  getTwitchExtensionSettings,
  saveTwitchExtensionSettings,
} from "../yoro-dashboard/api";

const SIM_STATUSES: ReadonlyArray<{ status: ExtensionViewerStatus; labelKey: keyof typeof extensionCardI18n.ko }> = [
  { status: "active", labelKey: "simActive" },
  { status: "joined", labelKey: "simJoined" },
  { status: "next", labelKey: "simNext" },
  { status: "paused", labelKey: "simPaused" },
  { status: "full", labelKey: "simFull" },
  { status: "ended", labelKey: "simEnded" },
  { status: "error", labelKey: "simError" },
  { status: "no_session", labelKey: "simNoSession" },
  { status: "loading", labelKey: "simLoading" },
];

/* 미리보기 표본 — 시청자 화면 데모용 고정 수치(저장·전송되지 않음). */
function previewData(status: ExtensionViewerStatus): ExtensionViewerData {
  return {
    status,
    game: "League of Legends",
    waitingCount: status === "joined" || status === "next" ? 5 : 4,
    myPosition: 3,
  };
}

/* Twitch Extension 관리 카드 — 미리보기 변경은 즉시 반영하고 저장은 명시적으로 수행합니다. */
export function TwitchExtensionCard({
  csrfToken,
  locale,
}: {
  csrfToken?: string;
  locale: ExtensionLocale;
}) {
  const text = extensionCardI18n[locale];
  const [display, setDisplay] = useState<ExtensionDisplaySettings>(DEFAULT_EXTENSION_DISPLAY);
  const [inactiveBehavior, setInactiveBehavior] = useState<TwitchExtensionInactiveBehavior>("hide");
  const [extensionType, setExtensionType] = useState<TwitchExtensionType>("panel");
  const [simStatus, setSimStatus] = useState<ExtensionViewerStatus>("active");
  const [connectionState, setConnectionState] = useState<TwitchExtensionConnectionState>();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    void getTwitchExtensionSettings(controller.signal)
      .then((settings) => {
        setDisplay(settings.display);
        setInactiveBehavior(settings.inactiveBehavior);
        setExtensionType(settings.extensionType);
        setConnectionState(settings.connectionState);
        setDirty(false);
        setSaveMessage("");
      })
      .catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setConnectionState("configuration_required");
        setSaveMessage(text.loadError);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [text.loadError]);

  function updateDisplay(key: keyof ExtensionDisplaySettings, checked: boolean) {
    setDisplay((previous) => ({ ...previous, [key]: checked }));
    setDirty(true);
    setSaveMessage("");
  }

  async function save() {
    if (!csrfToken || saving) return;
    setSaving(true);
    setSaveMessage("");
    try {
      const settings = await saveTwitchExtensionSettings({
        display,
        inactiveBehavior,
        extensionType,
      }, csrfToken);
      setDisplay(settings.display);
      setInactiveBehavior(settings.inactiveBehavior);
      setExtensionType(settings.extensionType);
      setConnectionState(settings.connectionState);
      setDirty(false);
      setSaveMessage(text.saved);
    } catch {
      setSaveMessage(text.saveError);
    } finally {
      setSaving(false);
    }
  }

  const toggles: ReadonlyArray<{ key: keyof ExtensionDisplaySettings; label: string }> = [
    { key: "joinButton", label: text.displayJoinButton },
    { key: "game", label: text.displayGame },
    { key: "waitingCount", label: text.displayWaitingCount },
    { key: "myPosition", label: text.displayMyPosition },
    { key: "cancelButton", label: text.displayCancelButton },
    { key: "nextState", label: text.displayNextState },
  ];

  const hiddenByInactive = simStatus === "no_session" && inactiveBehavior === "hide";
  const data = previewData(simStatus);

  const viewer = (
    <ExtensionViewerPanel
      data={data}
      display={display}
      locale={locale}
      variant={extensionType === "overlay" ? "overlay" : "panel"}
    />
  );

  return (
    <section aria-labelledby="twitch-extension-title" className="twitch-ext-card" data-testid="twitch-extension-card">
      <div className="twitch-ext-card__settings">
        <header className="twitch-ext-card__head">
          <h2 id="twitch-extension-title">{text.title}</h2>
          <span className={`twitch-ext-card__badge${connectionState === "connected" ? " is-connected" : ""}`}>
            {loading
              ? text.checkingBadge
              : connectionState === "connected"
                ? text.connectedBadge
                : text.setupBadge}
          </span>
        </header>
        <p className="twitch-ext-card__description">{text.description}</p>
        <p className="twitch-ext-card__note" role="note">
          {connectionState === "connected" ? text.connectedNote : text.setupNote}
        </p>

        <h3>{text.displayTitle}</h3>
        <div className="twitch-ext-card__toggles">
          {toggles.map((toggle) => (
            <label className="twitch-ext-card__toggle" key={toggle.key}>
              <span>{toggle.label}</span>
              <input
                checked={display[toggle.key]}
                disabled={loading || saving}
                onChange={(event) => updateDisplay(toggle.key, event.target.checked)}
                type="checkbox"
              />
              <span aria-hidden="true" className="twitch-ext-card__switch" />
            </label>
          ))}
        </div>

        <h3>{text.inactiveTitle}</h3>
        <div className="twitch-ext-card__segmented" role="group" aria-label={text.inactiveTitle}>
          <button
            aria-pressed={inactiveBehavior === "hide"}
            className={inactiveBehavior === "hide" ? "is-active" : ""}
            disabled={loading || saving}
            onClick={() => { setInactiveBehavior("hide"); setDirty(true); setSaveMessage(""); }}
            type="button"
          >
            {text.inactiveHide}
          </button>
          <button
            aria-pressed={inactiveBehavior === "message"}
            className={inactiveBehavior === "message" ? "is-active" : ""}
            disabled={loading || saving}
            onClick={() => { setInactiveBehavior("message"); setDirty(true); setSaveMessage(""); }}
            type="button"
          >
            {text.inactiveMessage}
          </button>
        </div>

        <h3>{text.typeTitle}</h3>
        <div className="twitch-ext-card__radios" role="radiogroup" aria-label={text.typeTitle}>
          <label>
            <input checked={extensionType === "panel"} disabled={loading || saving} name="twitch-extension-type" onChange={() => { setExtensionType("panel"); setDirty(true); setSaveMessage(""); }} type="radio" />
            <span>{text.typePanel}</span>
          </label>
          <label>
            <input checked={extensionType === "overlay"} disabled={loading || saving} name="twitch-extension-type" onChange={() => { setExtensionType("overlay"); setDirty(true); setSaveMessage(""); }} type="radio" />
            <span>{text.typeOverlay}</span>
          </label>
        </div>
        <div className="twitch-ext-card__save-row">
          <button
            className="twitch-ext-card__save"
            disabled={!csrfToken || loading || saving || !dirty}
            onClick={() => void save()}
            type="button"
          >
            {saving ? text.saving : text.save}
          </button>
          {saveMessage ? <span aria-live="polite">{saveMessage}</span> : null}
        </div>
      </div>

      <div className="twitch-ext-card__preview">
        <header className="twitch-ext-card__head">
          <h3>{text.previewTitle}</h3>
        </header>
        <p className="twitch-ext-card__description">{text.previewDescription}</p>
        <div aria-label={text.simLabel} className="twitch-ext-card__sim" role="group">
          {SIM_STATUSES.map((entry) => (
            <button
              aria-pressed={simStatus === entry.status}
              className={simStatus === entry.status ? "is-active" : ""}
              key={entry.status}
              onClick={() => setSimStatus(entry.status)}
              type="button"
            >
              {text[entry.labelKey]}
            </button>
          ))}
        </div>
        <div className="twitch-ext-card__stage" data-testid="twitch-extension-preview">
          {hiddenByInactive ? (
            <p className="twitch-ext-card__hidden">{text.previewHidden}</p>
          ) : extensionType === "overlay" ? (
            <div aria-label={text.previewVideoLabel} className="twitch-ext-card__video">
              {simStatus === "active" ? (
                <ExtensionOverlayCollapsed data={data} locale={locale} />
              ) : null}
              <div className="twitch-ext-card__video-widget">{viewer}</div>
            </div>
          ) : (
            viewer
          )}
        </div>
      </div>
    </section>
  );
}
