CREATE TABLE yoro_valorant_record_consents (
  external_identity_id UUID PRIMARY KEY
    REFERENCES external_identities(id) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL,
  policy_version TEXT NOT NULL,
  consented_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT yoro_valorant_record_consents_policy_version_check
    CHECK (policy_version = 'valorant-record-v1'),
  CONSTRAINT yoro_valorant_record_consents_state_check
    CHECK (
      (enabled = TRUE AND consented_at IS NOT NULL AND revoked_at IS NULL)
      OR
      (enabled = FALSE AND revoked_at IS NOT NULL)
    )
);

CREATE INDEX yoro_valorant_record_consents_public_idx
  ON yoro_valorant_record_consents (updated_at DESC, external_identity_id)
  WHERE enabled = TRUE;
