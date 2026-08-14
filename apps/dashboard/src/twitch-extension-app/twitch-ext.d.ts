/* Twitch Extension Helper 최소 타입 — https://dev.twitch.tv/docs/extensions/reference/ */
type TwitchExtensionAuth = {
  channelId: string;
  clientId: string;
  token: string;
  userId: string;
};

interface Window {
  Twitch?: {
    ext?: {
      onAuthorized(callback: (auth: TwitchExtensionAuth) => void): void;
      onContext(callback: (context: Record<string, unknown>) => void): void;
      actions?: {
        requestIdShare(): void;
      };
    };
  };
}
