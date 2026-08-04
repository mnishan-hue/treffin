# Treffin

Full-stack intellectual platform for students and thinkers — live debates, articles, communities, math contests, and reputation system.

## Architecture

TypeScript pnpm monorepo with four services:

| Artifact | Port | Preview path | Description |
|---|---|---|---|
| `artifacts/treffin` | 18962 | `/` | Main React web app |
| `artifacts/admin` | 23744 | `/admin/` | Admin panel (bcrypt auth) |
| `artifacts/api-server` | 8080 | `/api` | Express 5 API server |
| `artifacts/mockup-sandbox` | 8081 | `/__mockup` | Design preview server |

Shared libraries live under `lib/`:
- `lib/db` — Drizzle ORM schema (47 tables) + migrations against Replit Postgres
- `lib/api-spec` — OpenAPI spec (`openapi.yaml`, 146 operations) + Orval codegen
- `lib/api-client-react` — Generated React Query hooks + `customFetch`
- `lib/api-zod` — Generated Zod validators from the same spec

## Auth

- **Main app**: Clerk (Replit-managed tenant). Keys auto-provisioned. `VITE_CLERK_PUBLISHABLE_KEY`, `CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` are set as Replit Secrets.
- **Admin panel**: custom bcrypt session tokens. Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` (plaintext) or `ADMIN_PASSWORD_HASH` (bcrypt hash) as Replit Secrets.

## Key commands

```bash
# Run codegen after editing openapi.yaml
pnpm --filter @workspace/api-spec run codegen

# Push DB schema changes to Postgres
pnpm --filter @workspace/db run push

# Type-check all libs
pnpm run typecheck:libs

# Install packages
pnpm --filter @workspace/<artifact> add <pkg>
```

## Environment variables needed

| Secret | Required for |
|---|---|
| `CLERK_PUBLISHABLE_KEY` | API server Clerk middleware ✅ set |
| `CLERK_SECRET_KEY` | API server Clerk middleware ✅ set |
| `VITE_CLERK_PUBLISHABLE_KEY` | Treffin frontend ClerkProvider ✅ set |
| `ADMIN_EMAIL` | Admin panel login |
| `ADMIN_PASSWORD` | Admin panel login (plaintext) |
| `ADMIN_PASSWORD_HASH` | Admin panel login (bcrypt, preferred over plaintext) |
| `RESEND_API_KEY` | Email sending via Resend (optional) |
| `BETTER_AUTH_SECRET` | Better Auth signing secret (required; can reuse `SESSION_SECRET` value — 32 random bytes) |
| `BETTER_AUTH_BASE_URL` | Full API origin for Better Auth (e.g. `https://treffin-api.onrender.com`); omit in dev, auto-inferred from request |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Comma-separated frontend origins allowed to make cross-origin auth requests (e.g. `https://thetreffin.com,https://admin.thetreffin.com`); falls back to `ALLOWED_ORIGINS` then `REPLIT_DOMAINS` |

## User preferences

- Maintain the existing monorepo structure unless explicitly asked to change it.
- Pre-generated API client files (`lib/api-client-react/src/generated/`, `lib/api-zod/src/generated/`) should be copied from the source repo rather than re-generated from the spec when codegen produces fewer exports than the source.
