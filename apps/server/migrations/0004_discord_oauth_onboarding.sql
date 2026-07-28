CREATE TABLE discord_identities (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  discord_user_id TEXT NOT NULL UNIQUE
    CHECK (discord_user_id ~ '^[0-9]{1,32}$'),
  display_name TEXT NOT NULL
    CHECK (char_length(display_name) BETWEEN 1 AND 80),
  avatar_reference TEXT
    CHECK (avatar_reference IS NULL OR avatar_reference ~ '^[a-f0-9_]{1,128}$'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE TABLE discord_setup_sessions (
  id UUID PRIMARY KEY,
  token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  discord_identity_id UUID,
  organization_id UUID,
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN (
      'issued',
      'authenticated',
      'guild_selected',
      'completed',
      'expired',
      'revoked'
    )),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  failed_attempts INTEGER NOT NULL DEFAULT 0 CHECK (failed_attempts BETWEEN 0 AND 20),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (discord_identity_id) REFERENCES discord_identities (id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id) REFERENCES organizations (id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK ((status = 'completed') = (consumed_at IS NOT NULL))
);

CREATE INDEX discord_setup_sessions_expiry_idx
  ON discord_setup_sessions (status, expires_at);

CREATE TABLE discord_oauth_sessions (
  id UUID PRIMARY KEY,
  setup_session_id UUID NOT NULL UNIQUE,
  state_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(state_hash) = 32),
  cookie_binding_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(cookie_binding_hash) = 32),
  csrf_token_hash BYTEA NOT NULL CHECK (octet_length(csrf_token_hash) = 32),
  pkce_verifier_encrypted BYTEA NOT NULL
    CHECK (octet_length(pkce_verifier_encrypted) BETWEEN 32 AND 4096),
  discord_identity_id UUID,
  encrypted_token_record BYTEA
    CHECK (encrypted_token_record IS NULL OR octet_length(encrypted_token_record) BETWEEN 32 AND 16384),
  key_version INTEGER NOT NULL DEFAULT 1 CHECK (key_version >= 1),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN (
      'pending',
      'authenticated',
      'consumed',
      'expired',
      'revoked',
      'encryption_failed'
    )),
  expires_at TIMESTAMPTZ NOT NULL,
  state_consumed_at TIMESTAMPTZ,
  token_expires_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (setup_session_id) REFERENCES discord_setup_sessions (id) ON DELETE RESTRICT,
  FOREIGN KEY (discord_identity_id) REFERENCES discord_identities (id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at)
);

CREATE INDEX discord_oauth_sessions_expiry_idx
  ON discord_oauth_sessions (status, expires_at);

CREATE TABLE discord_guild_candidates (
  oauth_session_id UUID NOT NULL,
  discord_guild_id TEXT NOT NULL CHECK (discord_guild_id ~ '^[0-9]{1,32}$'),
  display_name TEXT NOT NULL CHECK (char_length(display_name) BETWEEN 1 AND 120),
  icon_url TEXT CHECK (
    icon_url IS NULL
    OR (
      char_length(icon_url) BETWEEN 1 AND 512
      AND icon_url ~ '^https://cdn\.discordapp\.com/icons/[0-9]{1,32}/[a-zA-Z0-9_]+\.(png|webp)\?size=128$'
    )
  ),
  manageable BOOLEAN NOT NULL CHECK (manageable),
  verified_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (oauth_session_id, discord_guild_id),
  FOREIGN KEY (oauth_session_id) REFERENCES discord_oauth_sessions (id) ON DELETE CASCADE
);

CREATE INDEX discord_guild_candidates_session_idx
  ON discord_guild_candidates (oauth_session_id, display_name, discord_guild_id);
