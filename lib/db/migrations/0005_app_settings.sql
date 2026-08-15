-- Creates the persistent store used by admin-configurable platform settings.
CREATE TABLE IF NOT EXISTS app_settings (
  id serial PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now(),
  updated_by text
);

CREATE UNIQUE INDEX IF NOT EXISTS app_settings_key_idx ON app_settings(key);

INSERT INTO app_settings (key, value, updated_by)
VALUES ('elite_thinker_threshold', '1000', 'migration')
ON CONFLICT (key) DO NOTHING;