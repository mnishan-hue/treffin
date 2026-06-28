import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { clerkMiddleware } from "@clerk/express";
import { publishableKeyFromHost } from "@clerk/shared/keys";
import { logger } from "./lib/logger";
import {
  CLERK_PROXY_PATH,
  clerkProxyMiddleware,
  getClerkProxyHost,
} from "./middlewares/clerkProxyMiddleware";
import router from "./routes";
import webhooksRouter from "./routes/webhooks";

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

// Health check — mounted before Clerk so UptimeRobot / Render always gets 200
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

app.use(CLERK_PROXY_PATH, clerkProxyMiddleware());

const corsDomains = process.env.ALLOWED_ORIGINS ?? process.env.REPLIT_DOMAINS ?? "";
const allowedOrigins = corsDomains
  .split(",")
  .map((d) => d.trim())
  .filter(Boolean)
  .map((d) => (d.startsWith("http") ? d : `https://${d}`));

app.use(
  cors({
    credentials: true,
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      if (process.env.NODE_ENV !== "production") return cb(null, true);
      if (allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
  }),
);

// Webhook route needs raw body for svix signature verification — mount before express.json()
app.use("/api/webhooks", express.raw({ type: "application/json" }), webhooksRouter);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(
  clerkMiddleware({
    publishableKey: process.env.CLERK_PUBLISHABLE_KEY,
    secretKey: process.env.CLERK_SECRET_KEY,
  }),
);

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
    next();
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
