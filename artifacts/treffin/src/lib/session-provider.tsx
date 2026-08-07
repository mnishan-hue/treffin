/**
 * SessionProvider — wraps the app once so every useSession() call reads from
 * a shared React context instead of making its own GET /api/auth/get-session
 * request.
 *
 * Dependency graph (no cycles):
 *   session-context.ts  ←  auth-client.ts  (reads context)
 *   session-context.ts  ←  session-provider.tsx  (fills context)
 *   auth-client.ts      ←  session-provider.tsx  (uses authClient)
 */
import { type ReactNode } from "react";
import { authClient } from "./auth-client";
import { SessionContext } from "./session-context";

export { SessionContext };

export function SessionProvider({ children }: { children: ReactNode }) {
  const session = authClient.useSession();
  return (
    <SessionContext.Provider value={session}>
      {children}
    </SessionContext.Provider>
  );
}
