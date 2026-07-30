CREATE TABLE yoro_user_preferences (
  user_id UUID PRIMARY KEY,
  locale TEXT NOT NULL DEFAULT 'ko'
    CHECK (locale IN ('ko', 'ja')),
  default_dashboard_page TEXT NOT NULL DEFAULT 'overview'
    CHECK (
      default_dashboard_page IN (
        'overview',
        'account',
        'organizations',
        'settings'
      )
    ),
  reduced_motion BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE RESTRICT
);

CREATE INDEX yoro_user_preferences_updated_idx
  ON yoro_user_preferences (updated_at DESC);
