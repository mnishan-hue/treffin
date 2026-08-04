import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

/**
 * Blocks any authenticated request from a suspended user.
 * Unauthenticated requests and users not yet in the DB pass through freely.
 */
export async function suspendedCheck(req: Request, res: Response, next: NextFunction) {
  const userId = req.betterAuthSession?.user?.id ?? null;
  if (!userId) { next(); return; }

  try {
    const [user] = await db
      .select({ isSuspended: usersTable.isSuspended })
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, userId))
      .limit(1);

    if (user?.isSuspended) {
      res.status(403).json({ error: "Your account has been suspended. Contact support for assistance." });
      return;
    }
  } catch {
    // Non-blocking — if the DB check fails, let the request through to avoid
    // locking out users due to transient DB errors.
  }

  next();
}
