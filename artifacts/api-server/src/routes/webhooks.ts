import { Router } from "express";
import { Webhook } from "svix";
import { logger } from "../lib/logger";
import { sendWelcomeEmail } from "../lib/email";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const router = Router();

router.post("/api/webhooks/clerk", async (req, res) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (webhookSecret) {
    const svixId = req.headers["svix-id"] as string;
    const svixTimestamp = req.headers["svix-timestamp"] as string;
    const svixSignature = req.headers["svix-signature"] as string;

    if (!svixId || !svixTimestamp || !svixSignature) {
      res.status(400).json({ error: "Missing svix headers" });
      return;
    }

    const wh = new Webhook(webhookSecret);
    try {
      wh.verify(req.body as Buffer, {
        "svix-id": svixId,
        "svix-timestamp": svixTimestamp,
        "svix-signature": svixSignature,
      });
    } catch {
      logger.warn("Clerk webhook signature verification failed");
      res.status(400).json({ error: "Invalid webhook signature" });
      return;
    }
  }

  let payload: { type: string; data: Record<string, unknown> };
  try {
    payload = JSON.parse((req.body as Buffer).toString("utf8"));
  } catch {
    res.status(400).json({ error: "Invalid JSON body" });
    return;
  }

  const { type, data } = payload;

  // ── user.created ─────────────────────────────────────────────────────────────
  if (type === "user.created") {
    const clerkId = data.id as string;
    const emailAddresses = data.email_addresses as Array<{ id: string; email_address: string; verification?: { status: string } }>;
    const primaryEmailId = data.primary_email_address_id as string | null;
    const primaryEmailObj = emailAddresses?.find((e) => e.id === primaryEmailId) ?? emailAddresses?.[0];
    const email = primaryEmailObj?.email_address ?? "";
    const emailVerified = primaryEmailObj?.verification?.status === "verified";
    const firstName = (data.first_name as string) ?? "";
    const lastName = (data.last_name as string) ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ") || "Treffin User";
    const avatarUrl = (data.image_url as string) ?? null;

    try {
      // Create the user profile in the Treffin database
      const [newUser] = await db
        .insert(usersTable)
        .values({
          clerkId,
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
          emailVerified,
        })
        .onConflictDoNothing()
        .returning();

      logger.info({ clerkId, userId: newUser?.id }, "New user profile created from Clerk webhook");

      // Send welcome email (non-blocking)
      if (email) {
        void sendWelcomeEmail(email, firstName);
      }
    } catch (err) {
      logger.error({ err, clerkId }, "Failed to create user profile from webhook");
      // Still return 200 so Clerk doesn't retry indefinitely
    }

    res.json({ received: true });
    return;
  }

  // ── user.updated ─────────────────────────────────────────────────────────────
  if (type === "user.updated") {
    const clerkId = data.id as string;
    const firstName = (data.first_name as string) ?? "";
    const lastName = (data.last_name as string) ?? "";
    const fullName = [firstName, lastName].filter(Boolean).join(" ");
    const avatarUrl = (data.image_url as string) ?? null;
    const emailAddresses = data.email_addresses as Array<{ email_address: string; verification?: { status: string }; id?: string }>;
    const primaryEmailId = data.primary_email_address_id as string | null;
    const primaryEmailObj = emailAddresses?.find(e => e.id === primaryEmailId) ?? emailAddresses?.[0];
    const emailVerified = primaryEmailObj?.verification?.status === "verified";

    try {
      await db
        .update(usersTable)
        .set({
          ...(fullName ? { name: fullName } : {}),
          ...(avatarUrl !== undefined ? { avatarUrl } : {}),
          emailVerified,
        })
        .where(eq(usersTable.clerkId, clerkId));

      logger.info({ clerkId }, "User profile updated from Clerk webhook");
    } catch (err) {
      logger.error({ err, clerkId }, "Failed to update user profile from webhook");
    }

    res.json({ received: true });
    return;
  }

  // ── user.deleted ─────────────────────────────────────────────────────────────
  if (type === "user.deleted") {
    const clerkId = data.id as string;

    try {
      await db
        .update(usersTable)
        .set({ clerkId: null })
        .where(eq(usersTable.clerkId, clerkId));

      logger.info({ clerkId }, "User unlinked from Clerk (account deleted)");
    } catch (err) {
      logger.error({ err, clerkId }, "Failed to unlink user from webhook");
    }

    res.json({ received: true });
    return;
  }

  // Unknown event — acknowledge and ignore
  res.json({ received: true });
});

export default router;
