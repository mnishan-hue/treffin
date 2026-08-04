/**
 * Extend Express Request to carry the Better Auth session so routes can read
 * req.betterAuthSession without calling auth.api.getSession() themselves.
 */
declare global {
  namespace Express {
    interface Request {
      betterAuthSession?: {
        user: {
          id: string;
          name: string;
          email: string;
          emailVerified: boolean;
          image?: string | null | undefined;
          createdAt: Date;
          updatedAt: Date;
        };
        session: {
          id: string;
          userId: string;
          expiresAt: Date;
          token: string;
          createdAt: Date;
          updatedAt: Date;
          ipAddress?: string | null;
          userAgent?: string | null;
        };
      } | null;
    }
  }
}

export {};
