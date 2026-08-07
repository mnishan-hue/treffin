import { createAuthClient } from "better-auth/react";
import { createContext, useContext, type ReactNode } from "react";

// Must be an absolute URL. Fall back to the current origin so the auth client
// works in the Replit preview (and locally) even when VITE_API_BASE_URL is not
// set – in that case the API is served from the same origin as the frontend.
const apiOrigin = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/+$/, "")
  || (typeof window !== "undefined" ? window.location.origin : "");

export const authClient = createAuthClient({
  baseURL: `${apiOrigin}/api/auth`,
  fetchOptions: {
    credentials: "include",
  },
});

// ---------------------------------------------------------------------------
// Session singleton via React context
//
// Better Auth's useSession() makes an independent HTTP call for every component
// that invokes it. With 40+ components on a page that floods the API with
// simultaneous GET /api/auth/get-session requests → 429s.
//
// Solution: one real BA call lives in <SessionProvider> at the app root.
// The useSession() hook exported below reads from context — zero extra network
// requests regardless of how many components call it.
// ---------------------------------------------------------------------------

type BASession = ReturnType<typeof authClient.useSession>;
const SessionContext = createContext<BASession | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}

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