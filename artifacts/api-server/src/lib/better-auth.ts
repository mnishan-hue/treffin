import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { twoFactor } from "better-auth/plugins/two-factor";
import { db } from "@workspace/db";
import {
  baUser,
  baSession,
  baAccount,
  baVerification,
  baTwoFactor,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { toNodeHandler } from "better-auth/node";
import { jitProvisionUser } from "./jit-provision";
import { collectTrustedOrigins } from "./security-policy";
import { sendLoginOtpEmail, sendPasswordResetEmail } from "./email";
import { logger } from "./logger";

const authSecret = process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET;
if (!authSecret || authSecret.length < 32) {
  throw new Error("BETTER_AUTH_SECRET (or SESSION_SECRET) must contain at least 32 characters");
}
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleOAuthEnabled = Boolean(googleClientId && googleClientSecret);

/**
 * Merge the explicit auth/CORS allowlists with the canonical frontend URLs.
 * No wildcards are used; invalid entries are ignored and origins are deduplicated.
 */function buildTrustedOrigins(): string[] {
  return collectTrustedOrigins(
    process.env.BETTER_AUTH_TRUSTED_ORIGINS,
    process.env.ALLOWED_ORIGINS,
    process.env.REPLIT_DOMAINS,
    process.env.FRONTEND_URL,
    process.env.ADMIN_FRONTEND_URL,
  );
}

async function ensureEmailLoginOtp(userId: string): Promise<void> {
  try {
    await db.update(baUser)
      .set({ twoFactorEnabled: true })
      .where(eq(baUser.id, userId));
    await db.insert(baTwoFactor).values({
      id: `email-otp-${userId}`,
      secret: "email-otp-only",
      backupCodes: "[]",
      userId,
      verified: true,
    }).onConflictDoNothing();
  } catch (err) {
    logger.error({ err, userId }, "Failed to enroll user in email login OTP");
    throw err;
  }
}

export const auth = betterAuth({
  // Use BETTER_AUTH_SECRET if set; fall back to SESSION_SECRET so the
  // existing secret already in Replit works without extra provisioning.
  secret: authSecret,

  // In production set BETTER_AUTH_BASE_URL to the full API origin,
  // e.g. https://treffin-api.onrender.com.  Leave it empty in dev and
  // Better Auth will infer the URL from the incoming request.
  baseURL: process.env.BETTER_AUTH_BASE_URL,

  // Allow cross-origin auth requests from frontend domains — must align with
  // the CORS allowlist so browsers can reach the auth endpoints.
  trustedOrigins: buildTrustedOrigins(),

  database: drizzleAdapter(db, {
    provider: "pg",
    schema: {
      // Map Better Auth's internal model names to our prefixed table objects.
      user: baUser,
      session: baSession,
      account: baAccount,
      verification: baVerification,
      twoFactor: baTwoFactor,
    },
  }),

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    revokeSessionsOnPasswordReset: true,
    sendResetPassword: async ({ user, url }) => {
      await sendPasswordResetEmail(user.email, user.name, url);
    },
  },

  // Google OAuth — credentials come from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  // set in the Render environment. Leave both empty to disable Google auth.
  socialProviders: googleOAuthEnabled ? {
    google: {
      clientId: googleClientId!,
      clientSecret: googleClientSecret!,
    },
  } : {},

  // When OAuth fails, redirect to the frontend sign-in page with ?error=...
  // IMPORTANT: Better Auth v1.6.x uses onAPIError.errorURL for this — the
  // `pages` key does NOT exist and is silently ignored.
  onAPIError: {
    errorURL: `${process.env.FRONTEND_URL ?? "https://thetreffin.com"}/sign-in`,
  },

  // Allow Google OAuth to link to an existing email/password account.
  //
  // IMPORTANT: accountLinking MUST be nested inside `account:` — placed at the
  // top level it is silently ignored (Better Auth reads
  // options.account?.accountLinking, confirmed from v1.6.25 bundle source).
  //
  // trustedProviders: ["google"] bypasses the requireLocalEmailVerified check,
  // which otherwise fires for any user whose ba_user.emailVerified is false
  // (all email/password signups by default since no email-verification step is
  // configured). Without this, any existing email/password user gets
  // account_not_linked when they attempt Google sign-in.
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      // MUST be false: the default is true, and it fires as a second independent
      // condition even when the provider IS in trustedProviders.
      // Without this, any user whose ba_user.emailVerified = false (all
      // email/password signups by default) still gets account_not_linked.
      requireLocalEmailVerified: false,
    },
  },

  // Frontend (thetreffin.com) and API (treffin-api.onrender.com) are on
  // different domains. Browsers block cross-origin cookies unless the server
  // explicitly opts in with SameSite=None + Secure.
  // Cache the session payload in a signed cookie so the client SDK can read
  // it without making a network round-trip for every useSession() call.
  // With 20+ components calling useSession() simultaneously this previously
  // caused a flood of GET /api/auth/get-session requests that exhausted the
  // global rate limiter (300 req / 15 min) and returned 429s for all other
  // API calls.  5-minute maxAge is a safe balance between freshness and load.
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // seconds — refresh the cache every 5 minutes
    },
  },

  advanced: {
    defaultCookieAttributes: {
      // Cross-site production deployments need SameSite=None + Secure, while
      // local HTTP development must not emit Secure cookies or sign-in breaks.
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
    },
  },

  plugins: [
    twoFactor({
      issuer: "Treffin",
      twoFactorCookieMaxAge: 10 * 60,
      accountLockout: {
        enabled: true,
        maxFailedAttempts: 5,
        durationSeconds: 15 * 60,
      },
      totpOptions: { disable: true },
      otpOptions: {
        period: 5,
        digits: 6,
        allowedAttempts: 5,
        storeOTP: "hashed",
        sendOTP: async ({ user, otp }) => sendLoginOtpEmail(user.email, user.name, otp),
      },
    }),
    // Converts "Authorization: Bearer <session-token>" to a session cookie
    // so the frontend's existing fetch pattern works without change.
    bearer(),
  ],

  databaseHooks: {
    user: {
      create: {
        // When a new BA user is created, auto-provision their Treffin profile
        // and send the welcome email. This fires reliably for every sign-up.
        after: async (user) => {
          await ensureEmailLoginOtp(user.id);
          await jitProvisionUser(user);
        },
      },
      update: {
        // Keep the Treffin profile in sync with the BA user record.
        after: async (user) => {
          const updates: Record<string, unknown> = {};
          if (user.name) updates.name = user.name;
          if (user.image !== undefined) updates.avatarUrl = user.image;
          if (Object.keys(updates).length > 0) {
            await db
              .update(usersTable)
              .set(updates)
              .where(eq(usersTable.betterAuthId, user.id));
          }
        },
      },
    },
  },
});

/**
 * Ready-to-use Node.js request handler.
 * Mount this on `POST /api/auth/**` in app.ts.
 */
export const betterAuthHandler = toNodeHandler(auth);
