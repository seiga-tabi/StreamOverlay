CREATE TABLE discord_management_oauth_sessions (
  id UUID PRIMARY KEY,
  state_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(state_hash) = 32),
  cookie_binding_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(cookie_binding_hash) = 32),
  pkce_verifier_encrypted BYTEA NOT NULL
    CHECK (octet_length(pkce_verifier_encrypted) BETWEEN 32 AND 4096),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'consumed', 'expired', 'revoked', 'security_failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (expires_at > created_at),
  CHECK ((status = 'consumed') = (consumed_at IS NOT NULL))
);

CREATE INDEX discord_management_oauth_expiry_idx
  ON discord_management_oauth_sessions (status, expires_at);

CREATE TABLE discord_management_sessions (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  session_token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(session_token_hash) = 32),
  csrf_token_hash BYTEA NOT NULL CHECK (octet_length(csrf_token_hash) = 32),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'revoked', 'security_failed')),
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

CREATE INDEX discord_management_sessions_user_idx
  ON discord_management_sessions (user_id, status, absolute_expires_at);

CREATE INDEX discord_management_sessions_expiry_idx
  ON discord_management_sessions (status, idle_expires_at, absolute_expires_at);

CREATE TABLE agent_bootstrap_sessions (
  id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  game_server_id UUID NOT NULL,
  issued_by_user_id UUID NOT NULL,
  token_hash BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
  status TEXT NOT NULL DEFAULT 'issued'
    CHECK (status IN ('issued', 'consumed', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (organization_id, id),
  FOREIGN KEY (organization_id, game_server_id)
    REFERENCES game_servers (organization_id, id) ON DELETE RESTRICT,
  FOREIGN KEY (organization_id, issued_by_user_id)
    REFERENCES organization_members (organization_id, user_id) ON DELETE RESTRICT,
  CHECK (expires_at > created_at),
  CHECK ((status = 'consumed') = (consumed_at IS NOT NULL)),
  CHECK ((status = 'revoked') = (revoked_at IS NOT NULL))
);

CREATE UNIQUE INDEX agent_bootstrap_active_server_idx
  ON agent_bootstrap_sessions (organization_id, game_server_id)
  WHERE status = 'issued' AND consumed_at IS NULL AND revoked_at IS NULL;

CREATE INDEX agent_bootstrap_expiry_idx
  ON agent_bootstrap_sessions (status, expires_at);
