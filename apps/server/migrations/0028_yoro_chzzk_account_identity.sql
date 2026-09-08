-- CHZZK는 로그인 수단이며 Riot의 연결 전용 제약은 유지합니다.
ALTER TABLE external_identities
  DROP CONSTRAINT external_identities_provider_check,
  DROP CONSTRAINT external_identities_provider_subject_check,
  ADD CONSTRAINT external_identities_provider_check
    CHECK (provider IN ('discord', 'twitch', 'chzzk', 'riot')),
  ADD CONSTRAINT external_identities_provider_subject_check
    CHECK (
      (provider IN ('discord', 'twitch') AND provider_subject ~ '^[0-9]{1,64}$')
      OR (provider = 'riot' AND provider_subject ~ '^[A-Za-z0-9_-]{40,128}$')
      OR (provider = 'chzzk' AND char_length(provider_subject) BETWEEN 1 AND 256
          AND provider_subject !~ U&'[\0001-\001F\007F-\009F]'
          AND provider_subject !~ '^ | $')
    );
ALTER TABLE yoro_oauth_sessions
  DROP CONSTRAINT yoro_oauth_sessions_provider_check,
  ADD CONSTRAINT yoro_oauth_sessions_provider_check
    CHECK (provider IN ('discord', 'twitch', 'chzzk', 'riot'));
ALTER TABLE yoro_sessions
  DROP CONSTRAINT yoro_sessions_authentication_provider_check,
  ADD CONSTRAINT yoro_sessions_authentication_provider_check
    CHECK (authentication_provider IN ('discord', 'twitch', 'chzzk'));
-- 외부 identity가 로그인 식별의 기준이므로 legacy ID 없는 신규 계정을 허용합니다.
-- 각 legacy ID 열의 형식 및 UNIQUE 제약은 유지합니다.
ALTER TABLE users DROP CONSTRAINT users_check;
