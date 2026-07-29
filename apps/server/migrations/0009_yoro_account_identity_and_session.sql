ALTER TABLE users
  ADD COLUMN status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'suspended', 'closed'));

CREATE TABLE external_identities (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  provider TEXT NOT NULL CHECK (provider IN ('discord', 'twitch')),
  provider_subject TEXT NOT NULL
    CHECK (provider_subject ~ '^[0-9]{1,64}$'),
  display_name TEXT NOT NULL
    CHECK (char_length(display_name) BETWEEN 1 AND 80),
  avatar_reference TEXT
    CHECK (
      avatar_reference IS NULL
      OR char_length(avatar_reference) BETWEEN 1 AND 512
    ),
  connected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  UNIQUE (provider, provider_subject)
);

CREATE INDEX external_identities_user_active_idx
  ON external_identities (user_id, provider)
  WHERE revoked_at IS NULL;

CREATE UNIQUE INDEX external_identities_one_active_provider_idx
  ON external_identities (user_id, provider)
  WHERE revoked_at IS NULL;

INSERT INTO external_identities (
  id,
  user_id,
  provider,
  provider_subject,
  display_name,
  avatar_reference,
  connected_at,
  last_authenticated_at,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  identity.user_id,
  'discord',
  identity.discord_user_id,
  identity.display_name,
  identity.avatar_reference,
  identity.created_at,
  identity.updated_at,
  identity.created_at,
  identity.updated_at
FROM discord_identities identity
ON CONFLICT (provider, provider_subject) DO NOTHING;

INSERT INTO external_identities (
  id,
  user_id,
  provider,
  provider_subject,
  display_name
)
SELECT
  gen_random_uuid(),
  account.id,
  'twitch',
  account.twitch_user_id,
  account.twitch_user_id
FROM users account
WHERE account.twitch_user_id IS NOT NULL
ON CONFLICT (provider, provider_subject) DO NOTHING;

CREATE TABLE yoro_oauth_sessions (
  id UUID PRIMARY KEY,
  provider TEXT NOT NULL CHECK (provider IN ('discord', 'twitch')),
  purpose TEXT NOT NULL CHECK (purpose IN ('login', 'link_identity')),
  target_user_id UUID,
  state_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(state_hash) = 32),
  cookie_binding_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(cookie_binding_hash) = 32),
  pkce_verifier_encrypted BYTEA
    CHECK (
      pkce_verifier_encrypted IS NULL
      OR octet_length(pkce_verifier_encrypted) BETWEEN 32 AND 4096
    ),
  return_path TEXT NOT NULL DEFAULT '/'
    CHECK (
      char_length(return_path) BETWEEN 1 AND 256
      AND return_path LIKE '/%'
      AND return_path NOT LIKE '//%'
    ),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'expired', 'security_failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (target_user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK (
    (purpose = 'login' AND target_user_id IS NULL)
    OR (purpose = 'link_identity' AND target_user_id IS NOT NULL)
  ),
  CHECK ((status = 'consumed') = (consumed_at IS NOT NULL))
);

CREATE INDEX yoro_oauth_sessions_expiry_idx
  ON yoro_oauth_sessions (status, expires_at);

CREATE TABLE yoro_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token_hash BYTEA NOT NULL UNIQUE
    CHECK (octet_length(session_token_hash) = 32),
  csrf_token_hash BYTEA NOT NULL
    CHECK (octet_length(csrf_token_hash) = 32),
  authentication_provider TEXT NOT NULL
    CHECK (authentication_provider IN ('discord', 'twitch')),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'security_failed')),
  authenticated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idle_expires_at TIMESTAMPTZ NOT NULL,
  absolute_expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CHECK (idle_expires_at > created_at),
  CHECK (absolute_expires_at >= idle_expires_at),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE INDEX yoro_sessions_user_active_idx
  ON yoro_sessions (user_id, status, absolute_expires_at);

CREATE INDEX yoro_sessions_expiry_idx
  ON yoro_sessions (status, idle_expires_at, absolute_expires_at);
