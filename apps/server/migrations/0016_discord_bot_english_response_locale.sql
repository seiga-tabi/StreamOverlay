ALTER TABLE discord_bot_control_configs
  DROP CONSTRAINT discord_bot_control_configs_preferred_locale_check;

ALTER TABLE discord_bot_control_configs
  ADD CONSTRAINT discord_bot_control_configs_preferred_locale_check
    CHECK (preferred_locale IN ('auto', 'ko', 'ja', 'en'));
