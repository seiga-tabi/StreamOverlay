CREATE TABLE yoro_twitch_viewer_credentials (
  user_id UUID PRIMARY KEY,
  encrypted_token_record BYTEA
    CHECK (
      encrypted_token_record IS NULL
      OR octet_length(encrypted_token_record) BETWEEN 64 AND 16384
    ),
  token_expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'security_failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT,
  CHECK (
    (status = 'active' AND revoked_at IS NULL AND encrypted_token_record IS NOT NULL)
    OR (status <> 'active' AND revoked_at IS NOT NULL AND encrypted_token_record IS NULL)
  )
);

CREATE INDEX yoro_twitch_viewer_credentials_active_expiry_idx
  ON yoro_twitch_viewer_credentials (token_expires_at)
  WHERE status = 'active';
