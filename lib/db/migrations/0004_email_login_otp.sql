-- 0004_email_login_otp.sql
-- Enables Better Auth's email OTP second factor for credential sign-ins.
-- OAuth providers continue to perform their own provider-managed verification.
ALTER TABLE ba_user
  ADD COLUMN IF NOT EXISTS two_factor_enabled boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS ba_two_factor (
  id text PRIMARY KEY,
  secret text NOT NULL,
  backup_codes text NOT NULL,
  user_id text NOT NULL REFERENCES ba_user(id) ON DELETE CASCADE,
  verified boolean NOT NULL DEFAULT true,
  failed_verification_count integer NOT NULL DEFAULT 0,
  locked_until timestamp
);

CREATE UNIQUE INDEX IF NOT EXISTS ba_two_factor_user_id_idx
  ON ba_two_factor(user_id);

UPDATE ba_user SET two_factor_enabled = true
WHERE two_factor_enabled IS DISTINCT FROM true;

INSERT INTO ba_two_factor (
  id,
  secret,
  backup_codes,
  user_id,
  verified,
  failed_verification_count
)
SELECT
  'email-otp-' || id,
  'email-otp-only',
  '[]',
  id,
  true,
  0
FROM ba_user
ON CONFLICT (user_id) DO NOTHING;
