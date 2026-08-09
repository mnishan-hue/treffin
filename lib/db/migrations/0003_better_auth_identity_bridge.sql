-- 0003_better_auth_identity_bridge.sql
-- Backfill the legacy identity bridge used by older relations while Better Auth
-- remains the canonical authentication provider. This is non-destructive and
-- intentionally skips any value that would collide with an existing clerk_id.
UPDATE users AS target
SET clerk_id = target.better_auth_id
WHERE target.better_auth_id IS NOT NULL
  AND target.clerk_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM users AS existing
    WHERE existing.id <> target.id
      AND existing.clerk_id = target.better_auth_id
  );