import {
  DEFAULT_TWITCH_EXTENSION_SETTINGS,
  type TwitchExtensionConnectionState,
  type TwitchExtensionSettingsInput,
  type TwitchExtensionSettingsResponse
} from "@streamops/shared";
import { SafeDatabaseError } from "../errors.js";
import { requireUuid } from "../tenant-context.js";
import { repositoryQuery, type RepositoryQueryable } from "./types.js";

type TwitchExtensionSettingsRow = {
  display_join_button: boolean;
  display_game: boolean;
  display_waiting_count: boolean;
  display_my_position: boolean;
  display_cancel_button: boolean;
  display_next_state: boolean;
  inactive_behavior: "hide" | "message";
  extension_type: "panel" | "overlay";
  revision: string;
  updated_at: Date;
};

function requireTwitchUserId(value: string): string {
  const normalized = value.trim();
  if (!/^\d{1,32}$/u.test(normalized)) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return normalized;
}

function response(
  row: TwitchExtensionSettingsRow | undefined,
  connectionState: TwitchExtensionConnectionState
): TwitchExtensionSettingsResponse {
  if (!row) {
    return Object.freeze({
      ...DEFAULT_TWITCH_EXTENSION_SETTINGS,
      configured: false,
      connectionState,
      revision: 0
    });
  }
  const revision = Number(row.revision);
  if (!Number.isSafeInteger(revision) || revision < 1) {
    throw new SafeDatabaseError("DATABASE_INVALID_INPUT", false);
  }
  return Object.freeze({
    display: Object.freeze({
      joinButton: row.display_join_button,
      game: row.display_game,
      waitingCount: row.display_waiting_count,
      myPosition: row.display_my_position,
      cancelButton: row.display_cancel_button,
      nextState: row.display_next_state
    }),
    inactiveBehavior: row.inactive_behavior,
    extensionType: row.extension_type,
    configured: true,
    connectionState,
    revision,
    updatedAt: row.updated_at.toISOString()
  });
}

const SELECT_COLUMNS = `
  display_join_button, display_game, display_waiting_count,
  display_my_position, display_cancel_button, display_next_state,
  inactive_behavior, extension_type, revision, updated_at`;

export class TwitchExtensionSettingsRepository {
  constructor(private readonly queryable: RepositoryQueryable) {}

  async readForOwner(input: {
    userId: string;
    streamerTwitchUserId: string;
    connectionState: TwitchExtensionConnectionState;
  }): Promise<TwitchExtensionSettingsResponse> {
    const result = await repositoryQuery<TwitchExtensionSettingsRow>(
      this.queryable,
      `SELECT ${SELECT_COLUMNS}
         FROM twitch_extension_settings
        WHERE user_id = $1 AND streamer_twitch_user_id = $2`,
      [requireUuid(input.userId, "userId"), requireTwitchUserId(input.streamerTwitchUserId)]
    );
    return response(result.rows[0], input.connectionState);
  }

  async readForStreamer(input: {
    streamerTwitchUserId: string;
    connectionState: TwitchExtensionConnectionState;
  }): Promise<TwitchExtensionSettingsResponse> {
    const result = await repositoryQuery<TwitchExtensionSettingsRow>(
      this.queryable,
      `SELECT ${SELECT_COLUMNS}
         FROM twitch_extension_settings
        WHERE streamer_twitch_user_id = $1`,
      [requireTwitchUserId(input.streamerTwitchUserId)]
    );
    return response(result.rows[0], input.connectionState);
  }

  async replace(input: {
    userId: string;
    streamerTwitchUserId: string;
    settings: TwitchExtensionSettingsInput;
    connectionState: TwitchExtensionConnectionState;
  }): Promise<TwitchExtensionSettingsResponse> {
    const result = await repositoryQuery<TwitchExtensionSettingsRow>(
      this.queryable,
      `INSERT INTO twitch_extension_settings (
         user_id, streamer_twitch_user_id,
         display_join_button, display_game, display_waiting_count,
         display_my_position, display_cancel_button, display_next_state,
         inactive_behavior, extension_type
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id) DO UPDATE SET
         streamer_twitch_user_id = EXCLUDED.streamer_twitch_user_id,
         display_join_button = EXCLUDED.display_join_button,
         display_game = EXCLUDED.display_game,
         display_waiting_count = EXCLUDED.display_waiting_count,
         display_my_position = EXCLUDED.display_my_position,
         display_cancel_button = EXCLUDED.display_cancel_button,
         display_next_state = EXCLUDED.display_next_state,
         inactive_behavior = EXCLUDED.inactive_behavior,
         extension_type = EXCLUDED.extension_type,
         revision = twitch_extension_settings.revision + 1,
         updated_at = NOW()
       RETURNING ${SELECT_COLUMNS}`,
      [
        requireUuid(input.userId, "userId"),
        requireTwitchUserId(input.streamerTwitchUserId),
        input.settings.display.joinButton,
        input.settings.display.game,
        input.settings.display.waitingCount,
        input.settings.display.myPosition,
        input.settings.display.cancelButton,
        input.settings.display.nextState,
        input.settings.inactiveBehavior,
        input.settings.extensionType
      ]
    );
    const row = result.rows[0];
    if (!row) throw new SafeDatabaseError("DATABASE_INTERNAL_ERROR", false);
    return response(row, input.connectionState);
  }
}
