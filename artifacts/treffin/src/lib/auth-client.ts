import { createAuthClient } from "better-auth/react";
import { twoFactorClient } from "better-auth/client/plugins";
import { useContext } from "react";
import { SessionContext } from "./session-context";

// Must be an absolute URL. Fall back to the current origin so the auth client
// works in the Replit preview (and locally) even when VITE_API_BASE_URL is not
// set – in that case the API is served from the same origin as the frontend.
const browserOrigin = typeof window !== "undefined" ? window.location.origin : "";
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "")
  || browserOrigin;
const emailAuthOrigin = (import.meta.env.VITE_AUTH_BASE_URL ?? "").replace(/\/+$/, "")
  || (import.meta.env.PROD ? browserOrigin : apiOrigin);
const AUTH_TOKEN_KEY = "treffin_auth_token";

function readBearerToken(): string | undefined {
  if (typeof window === "undefined") return undefined;
  return window.sessionStorage.getItem(AUTH_TOKEN_KEY) ?? undefined;
}

function storeBearerToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.sessionStorage.setItem(AUTH_TOKEN_KEY, token);
  else window.sessionStorage.removeItem(AUTH_TOKEN_KEY);
}

export function rememberAuthToken(token: string | null | undefined): void {
  storeBearerToken(token ?? null);
}

function authFetchOptions() {
  return {
    credentials: "include",
    // The API is currently hosted on a different site. Cookies remain the
    // primary transport, with a tab-scoped bearer fallback for browsers that
    // block third-party cookies.
    auth: { type: "Bearer", token: readBearerToken },
    onResponse: ({ response, request }: { response: Response; request: Request }) => {
      const issuedToken = response.headers.get("set-auth-token");
      if (issuedToken) storeBearerToken(issuedToken);
      const requestUrl = String(request.url);
      if (response.ok && requestUrl.includes("/sign-out")) storeBearerToken(null);
      if (response.status === 401 && requestUrl.includes("/get-session")) storeBearerToken(null);
    },
  } as const;
}

export const authClient = createAuthClient({
  baseURL: `${apiOrigin}/api/auth`,
  plugins: [twoFactorClient()],
  fetchOptions: authFetchOptions(),
});

// Password + OTP must remain on one browser origin. Better Auth stores the
// short-lived two-factor challenge in an HttpOnly cookie between these calls;
// browsers can reject that cookie when Render is treated as a third party.
// Vercel proxies /api/auth/* to Render, making this one flow first-party. The
// regular client intentionally remains direct so the existing Google OAuth
// callback/session flow is preserved.
export const emailOtpAuthClient = createAuthClient({
  baseURL: `${emailAuthOrigin}/api/auth`,
  plugins: [twoFactorClient()],
  fetchOptions: authFetchOptions(),
});
export type AuthUser = {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  firstName: string;
  lastName: string;
  username: string;
  fullName: string;
  imageUrl: string | undefined;
};

function toAuthUser(user: {
  id: string;
  name?: string | null;
  email: string;
  image?: string | null;
}): AuthUser {
  const name = user.name?.trim() ?? "";
  const [firstName = "", ...rest] = name.split(/\s+/);
  const lastName = rest.join(" ");

  return {
    ...user,
    name,
    firstName,
    lastName,
    username: name,
    fullName: name,
    imageUrl: user.image ?? undefined,
  };
}

export function useSession() {
  // Read from the singleton context when available (always inside <App>).
  // Falls back to a direct BA call so the hook is safe outside the provider.
  const ctx = useContext(SessionContext);
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const fallback = ctx === null ? authClient.useSession() : null;
  const session = ctx ?? fallback!;

  const user = session.data?.user ? toAuthUser(session.data.user) : null;
  return {
    ...session,
    user,
    isSignedIn: Boolean(user),
    isLoaded: !session.isPending,
  };
}

export async function getToken(): Promise<string | null> {
  const result = await authClient.getSession();
  return result.data?.session?.token ?? null;
}

export const { signIn, signUp, signOut } = authClient;
