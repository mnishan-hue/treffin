import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { bearer } from "better-auth/plugins/bearer";
import { db } from "@workspace/db";
import {
  baUser,
  baSession,
  baAccount,
  baVerification,
  usersTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { toNodeHandler } from "better-auth/node";
import { jitProvisionUser } from "./jit-provision";

/**
 * Build the trusted-origins list from the same env vars already used by CORS,
 * plus any explicit Better Auth overrides.
 *
 * Priority order:
 *   1. BETTER_AUTH_TRUSTED_ORIGINS  — explicit override (comma-separated URLs)
 *   2. ALLOWED_ORIGINS              — shared CORS allowlist (comma-separated)
 *   3. REPLIT_DOMAINS               — dev/preview domains injected by Replit
 *
 * No wildcards are used; every entry must be a full origin.
 */
function buildTrustedOrigins(): string[] {
  const raw =
    process.env.BETTER_AUTH_TRUSTED_ORIGINS ??
    process.env.ALLOWED_ORIGINS ??
    process.env.REPLIT_DOMAINS ??
    "";

  return raw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean)
    .map((d) => (d.startsWith("http") ? d : `https://${d}`));
}

export const auth = betterAuth({
  // Use BETTER_AUTH_SECRET if set; fall back to SESSION_SECRET so the
  // existing secret already in Replit works without extra provisioning.
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.SESSION_SECRET,

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
    },
  }),

  emailAndPassword: {
    enabled: true,
  },

  // Google OAuth — credentials come from GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
  // set in the Render environment. Leave both empty to disable Google auth.
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    },
  },

  // Allow Google OAuth to link to an existing email/password account.
  // Without this, signing in with a Google account whose email already
  // exists in ba_user (from a prior email signup) returns account_not_linked.
  accountLinking: {
    enabled: true,
    trustedProviders: ["google"],
  },

  // Frontend (thetreffin.com) and API (treffin-api.onrender.com) are on
  // different domains. Browsers block cross-origin cookies unless the server
  // explicitly opts in with SameSite=None + Secure.
  advanced: {
    defaultCookieAttributes: {
      sameSite: "none",
      secure: true,
      httpOnly: true,
    },
  },

  plugins: [
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
