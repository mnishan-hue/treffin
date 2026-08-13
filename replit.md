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

- **Main app**: Better Auth with mandatory email OTP after password verification and optional Google OAuth. Browser sessions use secure HttpOnly cookies with a tab-scoped bearer fallback for cross-site deployments.
- **Admin panel**: isolated signed HttpOnly session cookie. Set `ADMIN_EMAIL`, `ADMIN_PASSWORD_HASH`, and an independent `ADMIN_SESSION_SECRET` of at least 32 characters.

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
| `ADMIN_EMAIL` | Admin panel login |
| `ADMIN_PASSWORD` | Admin panel plaintext fallback; prefer `ADMIN_PASSWORD_HASH` in production |
| `ADMIN_PASSWORD_HASH` | Admin panel login (bcrypt, preferred over plaintext) |
| `ADMIN_SESSION_SECRET` | Signs the HttpOnly admin session cookie (required in production; independent random value of at least 32 characters) |
| `RESEND_API_KEY` | Resend email delivery (required for email/password login OTP and password recovery) |
| `RESEND_FROM_EMAIL` | Verified sender, for example `Treffin <noreply@thetreffin.com>` |
| `BETTER_AUTH_SECRET` | Better Auth signing secret (required; can reuse `SESSION_SECRET` value — 32 random bytes) |
| `BETTER_AUTH_BASE_URL` | Full API origin for Better Auth (e.g. `https://treffin-api.onrender.com`); omit in dev, auto-inferred from request |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Additional comma-separated frontend origins trusted by Better Auth |
| `ALLOWED_ORIGINS` | Comma-separated browser origins allowed by API CORS |
| `FRONTEND_URL` | Canonical main frontend origin; automatically included in CORS and Better Auth trust |
| `ADMIN_FRONTEND_URL` | Canonical admin frontend origin; automatically included in CORS and Better Auth trust |

## User preferences

- Maintain the existing monorepo structure unless explicitly asked to change it.
- Pre-generated API client files (`lib/api-client-react/src/generated/`, `lib/api-zod/src/generated/`) should be copied from the source repo rather than re-generated from the spec when codegen produces fewer exports than the source.

### Production auth checklist

- API: set `BETTER_AUTH_BASE_URL` to the public API origin, including `https://` and no `/api/auth` suffix.
- API: set `FRONTEND_URL` and `ADMIN_FRONTEND_URL` to the two public frontend origins.
- API: set `ALLOWED_ORIGINS` to both frontend origins, comma-separated. `BETTER_AUTH_TRUSTED_ORIGINS` is also accepted by CORS.
- API: set independent 32+ character values for `BETTER_AUTH_SECRET` and `ADMIN_SESSION_SECRET`.
- Email/password login OTP: apply all ordered DB migrations, including `0004_email_login_otp.sql`; OTP delivery will intentionally fail closed if Resend is not configured.
- Welcome email: sent once when an account is first created, including first-time Google accounts; it is not resent on every login.
- API: set `ADMIN_EMAIL` and preferably a bcrypt `ADMIN_PASSWORD_HASH`.
- Main and admin Vercel projects: set `VITE_API_BASE_URL` to the same public API origin, then redeploy both projects.
- Password recovery: set `RESEND_API_KEY` and a verified `RESEND_FROM_EMAIL`; without them reset requests remain privacy-safe but no email can be delivered.
- For the most reliable cookie behavior, map the API to a same-site custom domain such as `api.thetreffin.com` and use that URL consistently in every variable above.
