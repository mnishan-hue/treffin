---
name: Clerk-to-Better-Auth frontend migration
description: How Clerk was replaced with Better Auth in the Treffin frontend, what patterns changed, and non-obvious constraints.
---

## Migration pattern

Better Auth's React client is imported from `better-auth/react` (not a separate package).
`createAuthClient` returns a `ReactAuthClient` that already wraps nanostores in React hooks — `client.useSession()` returns `{ data, isPending, isRefetching, error }` directly, no extra `useStore` call needed.

There is **no `bearerClient()` plugin** in the Better Auth v1.6.x client packages. Bearer token support on the *server* is the `bearer` plugin in `better-auth/plugins`; the frontend uses `credentials: "include"` (cookie-based) or passes the session token manually.

## Base URL requirement

`createAuthClient({ baseURL })` requires an **absolute URL**. If the env var is unset the fallback must be `window.location.origin`, not `""`.

```ts
const apiOrigin =
  (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "")
  || (typeof window !== "undefined" ? window.location.origin : "");
```

## Session token getter

`authClient.getSession()` returns `{ data?: { session?: { token } } }`. Use `data.session.token` (not `data.token`) for the bearer header getter.

## Clerk API replacements

| Clerk | Better Auth |
|---|---|
| `useUser()` → `{ user, isSignedIn, isLoaded }` | `useSession()` from `@/lib/auth-client` (same shape, wrapped) |
| `useAuth()` → `{ getToken, isSignedIn }` | `useSession()` + `getToken()` from auth-client |
| `useClerk()` → `{ signOut, openSignIn }` | `authClient.signOut()` + `setLocation("/sign-in")` |
| `<Show when="signed-in">` / `<Show when="signed-out">` | Plain `{isSignedIn && ...}` / `{!isSignedIn && ...}` |
| `<ClerkProvider>` + publishable key check | Remove entirely; session is fetched lazily |
| `user.fullName / firstName / lastName / imageUrl` | Mapped in `toAuthUser()` in auth-client.ts |

## Pre-existing missing dependencies

The Treffin frontend required `katex` and `jspdf` / `jspdf-autotable` as direct dependencies; these were installed but not declared in package.json before the migration and blocked the Vite build/dev server.

**Why:** The public repo source was imported as-is; its lockfile packages were not hoisted into the artifact's own package.json.
