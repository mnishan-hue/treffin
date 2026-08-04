import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
import { auth, betterAuthHandler } from "./lib/better-auth";
import { fromNodeHeaders } from "better-auth/node";
import router from "./routes";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Health check — mounted before auth middleware so UptimeRobot / Render always gets 200
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

const corsDomains = process.env.ALLOWED_ORIGINS ?? process.env.REPLIT_DOMAINS ?? "";
const allowedOrigins = corsDomains
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .map((d) => (d.startsWith("http") ? d : `https://${d}`));

// Extract the apex domain (e.g. "thetreffin.com") from a full origin URL.
// Allows admin.thetreffin.com when thetreffin.com is in the allow-list.
function apexDomain(urlStr: string): string {
  try {
    const parts = new URL(urlStr).hostname.split(".");
    return parts.slice(-2).join(".");
  } catch {
    return "";
  }
}
const allowedApexDomains = new Set(allowedOrigins.map(apexDomain).filter(Boolean));

app.use(
  cors({
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-token",
      "x-math-user-id",
      "x-math-user-name",
    ],
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // When no explicit allow-list is configured, permit all origins.
      // Set ALLOWED_ORIGINS on the server (comma-separated) to restrict access
      // in production (e.g. "https://thetreffin.com,https://admin.thetreffin.com").
      if (!allowedOrigins.length) return cb(null, true);
      // Exact match OR any subdomain of an allowed apex domain.
      if (allowedOrigins.includes(origin)) return cb(null, true);
      if (allowedApexDomains.has(apexDomain(origin))) return cb(null, true);
      return cb(null, false);
    },
  }),
);

// Better Auth handler — mounted before JSON parsing so auth routes are
// handled directly (Better Auth manages its own body parsing).
app.all("/api/auth/*splat", betterAuthHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Better Auth session middleware ────────────────────────────────────────────
// Extracts the session from either a cookie or an Authorization: Bearer header
// (via the bearer plugin) and attaches it to req.betterAuthSession.
// Non-blocking: if extraction fails, req.betterAuthSession is null and routes
// treat the request as unauthenticated.
app.use(async (req, _res, next) => {
  try {
    const session = await auth.api.getSession({
      headers: fromNodeHeaders(req.headers),
    });
    req.betterAuthSession = session;
  } catch {
    req.betterAuthSession = null;
  }
  next();
});

const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please try again later." },
});

const writeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Slow down — too many submissions." },
});

// Only rate-limit writes (POST, PUT, PATCH, DELETE) — GETs must not count
// against the write budget or polling/page-loads will exhaust the quota.
function writeOnly(limiter: ReturnType<typeof rateLimit>) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) {
      return limiter(req, res, next);
    }
    return next();
  };
}

app.use("/api", globalLimiter);
app.use("/api/feed", writeOnly(writeLimiter));
app.use("/api/posts", writeOnly(writeLimiter));
app.use("/api/articles", writeOnly(writeLimiter));
app.use("/api/reputation/award", writeOnly(writeLimiter));
app.use("/api/communities", writeOnly(writeLimiter));
app.use("/api/debates", writeOnly(writeLimiter));
app.use("/api/math/problems", writeOnly(writeLimiter));
app.use("/api/math/solutions", writeOnly(writeLimiter));
app.use("/api/users", writeOnly(writeLimiter));
app.use("/api/notifications", writeOnly(writeLimiter));
app.use("/api/moderation", writeOnly(writeLimiter));

app.use("/api", router);

if (process.env.SERVE_TREFFIN_STATIC === "true") {
  const staticDir =
    process.env.TREFFIN_STATIC_DIR ??
    path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      "../../../treffin/dist/public",
    );

  if (fs.existsSync(staticDir)) {
    app.use(express.static(staticDir, { index: false }));
    app.get(/^(?!\/api).*/, (_req, res) => {
      res.sendFile(path.join(staticDir, "index.html"));
    });
  } else {
    logger.warn({ staticDir }, "SERVE_TREFFIN_STATIC is set but dist is missing");
  }
}

export default app;
