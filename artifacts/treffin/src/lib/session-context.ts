/**
 * Shared session context reference — imported by both auth-client.ts and
 * session-provider.tsx to break the circular dependency.
 *
 * auth-client.ts  →  session-context.ts  (reads context)
 * session-provider.tsx  →  session-context.ts + auth-client.ts  (fills context)
 */
import { createContext } from "react";

// BASession is the return type of authClient.useSession(). We use `any` here
// to avoid importing authClient (which would recreate the cycle). The actual
// type is applied in session-provider.tsx and auth-client.ts via their own
// narrower casts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const SessionContext = createContext<any>(null);
