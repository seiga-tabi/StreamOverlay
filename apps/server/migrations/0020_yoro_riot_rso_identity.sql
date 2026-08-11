ALTER TABLE external_identities
  DROP CONSTRAINT external_identities_provider_check,
  DROP CONSTRAINT external_identities_provider_subject_check;

ALTER TABLE external_identities
  ADD CONSTRAINT external_identities_provider_check
    CHECK (provider IN ('discord', 'twitch', 'riot')),
  ADD CONSTRAINT external_identities_provider_subject_check
    CHECK (
      (
        provider IN ('discord', 'twitch')
        AND provider_subject ~ '^[0-9]{1,64}$'
      )
      OR (
        provider = 'riot'
        AND provider_subject ~ '^[A-Za-z0-9_-]{40,128}$'
      )
    );

ALTER TABLE yoro_oauth_sessions
  DROP CONSTRAINT yoro_oauth_sessions_provider_check;

ALTER TABLE yoro_oauth_sessions
  ADD CONSTRAINT yoro_oauth_sessions_provider_check
    CHECK (provider IN ('discord', 'twitch', 'riot')),
  ADD CONSTRAINT yoro_oauth_sessions_riot_link_only_check
    CHECK (provider <> 'riot' OR purpose = 'link_identity');
