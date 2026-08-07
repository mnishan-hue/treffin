import { createAuthClient } from "better-auth/react";
import { useContext } from "react";
import { SessionContext } from "./session-context";

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
