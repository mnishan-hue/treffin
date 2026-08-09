import fs from "node:fs";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express, { type Express } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import { logger } from "./lib/logger";
import { auth, betterAuthHandler } from "./lib/better-auth";
import { fromNodeHeaders } from "better-auth/node";
import router from "./routes";
import { collectTrustedOrigins, normalizeOrigin, resolveTrustedFrontendUrl as resolveTrustedUrl } from "./lib/security-policy";

const app: Express = express();

app.set("trust proxy", 1);

app.use(
  pinoHttp({
    logger,
    genReqId(req, res) {
      const supplied = req.headers["x-request-id"];
      const requestId = typeof supplied === "string" && /^[A-Za-z0-9._:-]{1,100}$/.test(supplied) ? supplied : crypto.randomUUID();
      res.setHeader("x-request-id", requestId);
      return requestId;
    },
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

const allowedOrigins = collectTrustedOrigins(
  process.env.ALLOWED_ORIGINS,
  process.env.REPLIT_DOMAINS,
  process.env.FRONTEND_URL,
  process.env.ADMIN_FRONTEND_URL,
);
if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
  throw new Error('At least one trusted frontend origin must be configured in production');
}
const trustedOriginSet = new Set(allowedOrigins.map(normalizeOrigin).filter((value): value is string => !!value));
app.use(
  cors({
    credentials: true,
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "x-admin-csrf",
    ],
    origin: (origin, cb) => {
      if (!origin) return cb(null, true);
      // When no explicit allow-list is configured, permit all origins.
      // Set ALLOWED_ORIGINS on the server (comma-separated) to restrict access
      // in production (e.g. "https://thetreffin.com,https://admin.thetreffin.com").
      if (!allowedOrigins.length) return cb(null, true);
      if (trustedOriginSet.has(normalizeOrigin(origin) ?? "")) return cb(null, true);
      return cb(null, false);
    },
  }),
);
// Public health check. Keep this after CORS so browser diagnostics from an
// allowed frontend can read it, while still mounting it before authentication.
app.get("/health", (_req, res) => {
  res.json({ status: "ok", ts: Date.now() });
});

// ── Google OAuth first-party redirect ────────────────────────────────────────
// The frontend navigates here via window.location.href (top-level navigation)
// with ?provider=google&callbackURL=https://thetreffin.com.
//
// Why we intercept instead of letting Better Auth handle the GET directly:
//   Better Auth's /signin/social only fully processes state when called as
//   a POST (JSON body). When called via GET the state cookie may not be
//   properly set, leading to state_mismatch on the Google callback.
//
// Our fix: synthesise a POST internally, capture the state cookie Better Auth
// writes, set it on our response (first-party to treffin-api.onrender.com),
// then redirect the browser to Google. When Google redirects back the cookie
// is present first-party → state validates → OAuth succeeds.

app.get("/api/auth/signin/social", async (req, res) => {
  const provider = (req.query.provider as string) || "google";
  const callbackURL = resolveTrustedUrl(req.query.callbackURL, process.env.FRONTEND_URL ?? allowedOrigins[0] ?? "http://localhost:3000", allowedOrigins);

  try {
    // auth.api.signInSocial is the typed server-side API — avoids synthetic
    // Request body-stream issues that plagued auth.handler().
    // asResponse:true gives us the full Response so we can forward Set-Cookie.
    const response = (await auth.api.signInSocial({
      body: { provider: provider as "google", callbackURL },
      headers: fromNodeHeaders(req.headers),
      asResponse: true,
    })) as Response;

    // Forward every Set-Cookie so the state cookie lands first-party on
    // treffin-api.onrender.com before the browser ever visits Google.
    const h = response.headers as Headers & { getSetCookie?: () => string[] };
    const setCookies: string[] =
      typeof h.getSetCookie === "function"
        ? h.getSetCookie()
        : h.get("set-cookie")
          ? [h.get("set-cookie")!]
          : [];
    if (setCookies.length) res.setHeader("Set-Cookie", setCookies);

    // Better Auth returns either a 302 (Location header) or 200 JSON { url }.
    const location = response.headers.get("location");
    if (location) return res.redirect(location);

    const text = await response.text();
    try {
      const body = JSON.parse(text) as { url?: string; error?: string };
      if (body.url) return res.redirect(body.url);
      const errMsg = encodeURIComponent(body.error ?? "OAuthSignin");
      logger.error({ body, status: response.status }, "Better Auth returned no OAuth URL");
      return res.redirect(`${callbackURL}/sign-in?error=${errMsg}`);
    } catch {
      logger.error({ text, status: response.status }, "Better Auth response not JSON");
      return res.redirect(`${callbackURL}/sign-in?error=OAuthSignin`);
    }
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    logger.error({ err }, "Social OAuth initiation error");
    return res.redirect(`${callbackURL}/sign-in?error=${encodeURIComponent(detail)}`);
  }
});

// Better Auth handler — mounted after the custom GET above so auth routes are
// handled directly (Better Auth manages its own body parsing).
app.all("/api/auth/*splat", betterAuthHandler);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ── Better Auth session middleware ────────────────────────────────────────────
// Extracts the session from either a cookie or an Authorization: Bearer header
// (via the bearer plugin) and attaches it to req.betterAuthSession.
// Non-blocking: if extraction fails, req.betterAuthSession is null and routes
// treat the request as unauthenticated.
app.use(async (req, _res, next) => {
  // Admin authentication uses its own signed HttpOnly cookie and must not
  // depend on the application user's Better Auth database session.
  if (req.path.startsWith("/api/admin")) {
    next();
    return;
  }
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
  // Raised from 300 → 1000: a React SPA with 20+ components makes many
  // parallel API calls on every page transition.  300/15min was far too low
  // and caused legitimate traffic to receive 429s.
  max: 1000,
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

// Apply the global limiter to all /api routes EXCEPT /api/auth/* —
// Better Auth session endpoints are called frequently by the client SDK
// (useSession in every mounted component) and must not consume the shared
// quota.  They have their own security model (signed cookies, CSRF tokens).
app.use("/api", (req, res, next) => {
  if (req.path.startsWith("/auth/")) return next();
  return globalLimiter(req, res, next);
});
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
