export const TWITCH_EXTENSION_INACTIVE_BEHAVIORS = ["hide", "message"] as const;
export const TWITCH_EXTENSION_TYPES = ["panel", "overlay"] as const;

export type TwitchExtensionInactiveBehavior = typeof TWITCH_EXTENSION_INACTIVE_BEHAVIORS[number];
export type TwitchExtensionType = typeof TWITCH_EXTENSION_TYPES[number];

export type TwitchExtensionDisplaySettings = Readonly<{
  joinButton: boolean;
  game: boolean;
  waitingCount: boolean;
  myPosition: boolean;
  cancelButton: boolean;
  nextState: boolean;
}>;

export type TwitchExtensionSettingsInput = Readonly<{
  display: TwitchExtensionDisplaySettings;
  inactiveBehavior: TwitchExtensionInactiveBehavior;
  extensionType: TwitchExtensionType;
}>;

export type TwitchExtensionConnectionState = "connected" | "configuration_required";

export type TwitchExtensionSettingsResponse = TwitchExtensionSettingsInput & Readonly<{
  configured: boolean;
  connectionState: TwitchExtensionConnectionState;
  revision: number;
  updatedAt?: string;
}>;

export const DEFAULT_TWITCH_EXTENSION_DISPLAY: TwitchExtensionDisplaySettings = Object.freeze({
  joinButton: true,
  game: true,
  waitingCount: true,
  myPosition: true,
  cancelButton: true,
  nextState: true
});

export const DEFAULT_TWITCH_EXTENSION_SETTINGS: TwitchExtensionSettingsInput = Object.freeze({
  display: DEFAULT_TWITCH_EXTENSION_DISPLAY,
  inactiveBehavior: "hide",
  extensionType: "panel"
});

function record(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function exactKeys(value: Record<string, unknown>, expected: readonly string[]): boolean {
  const keys = Object.keys(value);
  return keys.length === expected.length && keys.every((key) => expected.includes(key));
}

export function parseTwitchExtensionSettingsInput(
  value: unknown
): TwitchExtensionSettingsInput | undefined {
  const root = record(value);
  if (!root || !exactKeys(root, ["display", "inactiveBehavior", "extensionType"])) return undefined;
  const display = record(root.display);
  const displayKeys: Array<keyof TwitchExtensionDisplaySettings> = [
    "joinButton",
    "game",
    "waitingCount",
    "myPosition",
    "cancelButton",
    "nextState"
  ];
  if (
    !display
    || !exactKeys(display, displayKeys)
    || displayKeys.some((key) => typeof display[key] !== "boolean")
    || !TWITCH_EXTENSION_INACTIVE_BEHAVIORS.includes(
      root.inactiveBehavior as TwitchExtensionInactiveBehavior
    )
    || !TWITCH_EXTENSION_TYPES.includes(root.extensionType as TwitchExtensionType)
  ) return undefined;

  return Object.freeze({
    display: Object.freeze({
      joinButton: display.joinButton as boolean,
      game: display.game as boolean,
      waitingCount: display.waitingCount as boolean,
      myPosition: display.myPosition as boolean,
      cancelButton: display.cancelButton as boolean,
      nextState: display.nextState as boolean
    }),
    inactiveBehavior: root.inactiveBehavior as TwitchExtensionInactiveBehavior,
    extensionType: root.extensionType as TwitchExtensionType
  });
}
