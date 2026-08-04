#!/bin/bash
set -e
pnpm install --frozen-lockfile
pnpm --filter db push
# Rebuild lib declarations (composite project references) so consumers see
# up-to-date types after any schema changes.
pnpm run typecheck:libs
