import { Router } from "express";

// Clerk webhook handler has been removed. User lifecycle events are now handled
// by Better Auth databaseHooks in lib/better-auth.ts (user.create, user.update).

const router = Router();

export default router;
