-- Structured metadata for the Mathematics Arena problem composer.
-- Additive and safe to run more than once.
ALTER TABLE math_problems
  ADD COLUMN IF NOT EXISTS problem_type text NOT NULL DEFAULT 'solve',
  ADD COLUMN IF NOT EXISTS tags text,
  ADD COLUMN IF NOT EXISTS estimated_minutes integer,
  ADD COLUMN IF NOT EXISTS prerequisites text,
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS source_attribution text,
  ADD COLUMN IF NOT EXISTS is_original boolean NOT NULL DEFAULT true;

ALTER TABLE math_problems
  DROP CONSTRAINT IF EXISTS math_problems_problem_type_check;

ALTER TABLE math_problems
  ADD CONSTRAINT math_problems_problem_type_check
  CHECK (problem_type IN ('solve', 'prove', 'explain', 'counterexample', 'optimize', 'open'));

ALTER TABLE math_problems
  DROP CONSTRAINT IF EXISTS math_problems_estimated_minutes_check;

ALTER TABLE math_problems
  ADD CONSTRAINT math_problems_estimated_minutes_check
  CHECK (estimated_minutes IS NULL OR estimated_minutes BETWEEN 1 AND 1440);
