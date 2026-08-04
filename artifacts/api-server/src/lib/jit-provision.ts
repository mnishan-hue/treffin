import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./logger";
import { sendWelcomeEmail } from "./email";

export interface BetterAuthUser {
  id: string;
  name: string | null;
  email: string;
  emailVerified: boolean;
  image?: string | null;
}

/**
 * JIT-provision a Treffin user profile for a Better Auth user on their first
 * API call (or sign-up hook). Creates a DB row if it doesn't already exist.
 *
 * Accepts null to simplify call sites — returns null immediately with no DB work.
 *
 * Returns the user row (new or existing) or null on failure.
 */
export async function jitProvisionUser(
  baUser: BetterAuthUser | null,
): Promise<typeof usersTable.$inferSelect | null> {
  if (!baUser) return null;

  const fullName = baUser.name?.trim() || "Treffin User";
  const avatarUrl = baUser.image ?? null;
  const email = baUser.email ?? "";
  const firstName = fullName.split(" ")[0] ?? "";

  try {
    const [newUser] = await db
      .insert(usersTable)
      .values({
        betterAuthId: baUser.id,
        name: fullName,
        title: "New Member",
        bio: null,
        avatarUrl,
        reputationScore: 0,
        followers: 0,
        following: 0,
        debatesJoined: 0,
        articlesPublished: 0,
        isVerified: false,
        streakDays: 0,
        interests: [],
        emailVerified: baUser.emailVerified,
      })
      .onConflictDoNothing()
      .returning();

    if (newUser) {
      // Only send welcome email when actually creating (not on conflict/fallback)
      if (email && firstName) {
        void sendWelcomeEmail(email, firstName);
      }
      return newUser;
    }

    // onConflictDoNothing returns empty when the row already existed (race condition).
    // Fall back to a select to return the existing user.
    const [existing] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.betterAuthId, baUser.id));
    return existing ?? null;
  } catch (err) {
    logger.error({ err, betterAuthId: baUser.id }, "JIT provision: failed to insert user into DB");
    return null;
  }
}
