import { useState } from "react";
import {
  DEFAULT_EXTENSION_DISPLAY,
  ExtensionOverlayCollapsed,
  ExtensionViewerPanel,
  type ExtensionDisplaySettings,
  type ExtensionViewerData,
  type ExtensionViewerStatus,
} from "./ExtensionViewer";
import { extensionCardI18n, type ExtensionLocale } from "./extension-i18n";

type InactiveBehavior = "hide" | "message";
type ExtensionType = "panel" | "overlay";

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

/* Twitch Extension 관리 카드 — 설정 변경이 Live Preview 에 즉시 반영됩니다.
 *
 * Twitch 연동(EBS·JWT)과 설정 저장 API 는 Codex handoff 대상이라 아직 없습니다.
 * 가짜 연동 상태(Connected 등)를 표시하지 않고 "연동 준비 중"으로 정직하게 표기하며,
 * 미리보기는 실제 Viewer 컴포넌트(ExtensionViewerPanel)를 그대로 렌더합니다.
 */
export function TwitchExtensionCard({ locale }: { locale: ExtensionLocale }) {
  const text = extensionCardI18n[locale];
  const [display, setDisplay] = useState<ExtensionDisplaySettings>(DEFAULT_EXTENSION_DISPLAY);
  const [inactiveBehavior, setInactiveBehavior] = useState<InactiveBehavior>("hide");
  const [extensionType, setExtensionType] = useState<ExtensionType>("panel");
  const [simStatus, setSimStatus] = useState<ExtensionViewerStatus>("active");

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
          <span className="twitch-ext-card__badge">{text.comingSoonBadge}</span>
        </header>
        <p className="twitch-ext-card__description">{text.description}</p>
        <p className="twitch-ext-card__note" role="note">{text.comingSoonNote}</p>

        <h3>{text.displayTitle}</h3>
        <div className="twitch-ext-card__toggles">
          {toggles.map((toggle) => (
            <label className="twitch-ext-card__toggle" key={toggle.key}>
              <span>{toggle.label}</span>
              <input
                checked={display[toggle.key]}
                onChange={(event) => setDisplay((previous) => ({ ...previous, [toggle.key]: event.target.checked }))}
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
            onClick={() => setInactiveBehavior("hide")}
            type="button"
          >
            {text.inactiveHide}
          </button>
          <button
            aria-pressed={inactiveBehavior === "message"}
            className={inactiveBehavior === "message" ? "is-active" : ""}
            onClick={() => setInactiveBehavior("message")}
            type="button"
          >
            {text.inactiveMessage}
          </button>
        </div>

        <h3>{text.typeTitle}</h3>
        <div className="twitch-ext-card__radios" role="radiogroup" aria-label={text.typeTitle}>
          <label>
            <input checked={extensionType === "panel"} name="twitch-extension-type" onChange={() => setExtensionType("panel")} type="radio" />
            <span>{text.typePanel}</span>
          </label>
          <label>
            <input checked={extensionType === "overlay"} name="twitch-extension-type" onChange={() => setExtensionType("overlay")} type="radio" />
            <span>{text.typeOverlay}</span>
          </label>
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
