CREATE TABLE twitch_extension_settings (
  user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  streamer_twitch_user_id TEXT NOT NULL UNIQUE
    CHECK (streamer_twitch_user_id ~ '^[0-9]{1,32}$'),
  display_join_button BOOLEAN NOT NULL DEFAULT TRUE,
  display_game BOOLEAN NOT NULL DEFAULT TRUE,
  display_waiting_count BOOLEAN NOT NULL DEFAULT TRUE,
  display_my_position BOOLEAN NOT NULL DEFAULT TRUE,
  display_cancel_button BOOLEAN NOT NULL DEFAULT TRUE,
  display_next_state BOOLEAN NOT NULL DEFAULT TRUE,
  inactive_behavior TEXT NOT NULL DEFAULT 'hide'
    CHECK (inactive_behavior IN ('hide', 'message')),
  extension_type TEXT NOT NULL DEFAULT 'panel'
    CHECK (extension_type IN ('panel', 'overlay')),
  revision BIGINT NOT NULL DEFAULT 1 CHECK (revision >= 1),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
