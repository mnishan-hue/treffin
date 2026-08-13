import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

process.env.NEON_DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.ADMIN_PASSWORD = "test-password-not-a-secret";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-with-32-characters";
process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-with-32-characters";
process.env.ALLOWED_ORIGINS = "https://thetreffin.example,https://admin.thetreffin.example";

const { default: app } = await import("../../app");
const { pool } = await import("@workspace/db");

test("admin login, CORS, CSRF, session, and logout lifecycle", async (t) => {
  const server = app.listen(0);
  await new Promise<void>((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });
  t.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await pool.end();
  });

  const { port } = server.address() as AddressInfo;
  const origin = `http://127.0.0.1:${port}`;
  const adminOrigin = "https://admin.thetreffin.example";

  const anonymousSession = await fetch(`${origin}/api/admin/session`);
  assert.equal(anonymousSession.status, 401);

  const whitespacePassword = await fetch(`${origin}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: adminOrigin },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: ` ${process.env.ADMIN_PASSWORD} ` }),
  });
  assert.equal(whitespacePassword.status, 401, "password whitespace must not be silently ignored");

  const preflight = await fetch(`${origin}/api/admin/logout`, {
    method: "OPTIONS",
    headers: {
      origin: adminOrigin,
      "access-control-request-method": "POST",
      "access-control-request-headers": "x-admin-csrf",
    },
  });
  assert.equal(preflight.status, 204);
  assert.equal(preflight.headers.get("access-control-allow-origin"), adminOrigin);
  assert.match(preflight.headers.get("access-control-allow-headers") ?? "", /x-admin-csrf/i);

  const loginResponse = await fetch(`${origin}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: adminOrigin },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });
  assert.equal(loginResponse.status, 200);
  assert.equal(loginResponse.headers.get("access-control-allow-origin"), adminOrigin);
  assert.equal(loginResponse.headers.get("access-control-allow-credentials"), "true");
  assert.match(loginResponse.headers.get("cache-control") ?? "", /no-store/i);

  const setCookie = loginResponse.headers.get("set-cookie");
  if (!setCookie) assert.fail("Admin login did not set a session cookie");
  assert.ok(setCookie.includes("treffin_admin_session="));
  assert.match(setCookie, /HttpOnly/i);
  assert.match(setCookie, /SameSite=Lax/i);
  assert.doesNotMatch(setCookie, /Secure/i, "local HTTP cookies must not be Secure");

  const sessionCookie = setCookie.split(";", 1)[0];
  const sessionResponse = await fetch(`${origin}/api/admin/session`, {
    headers: { cookie: sessionCookie, origin: adminOrigin },
  });
  assert.equal(sessionResponse.status, 200);
  assert.match(sessionResponse.headers.get("cache-control") ?? "", /no-store/i);
  assert.deepEqual(await sessionResponse.json(), { authenticated: true });

  const missingCsrf = await fetch(`${origin}/api/admin/logout`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: adminOrigin },
  });
  assert.equal(missingCsrf.status, 403);

  const logoutResponse = await fetch(`${origin}/api/admin/logout`, {
    method: "POST",
    headers: { cookie: sessionCookie, origin: adminOrigin, "x-admin-csrf": "1" },
  });
  assert.equal(logoutResponse.status, 200);
  assert.match(logoutResponse.headers.get("set-cookie") ?? "", /treffin_admin_session=;/i);
  assert.match(logoutResponse.headers.get("cache-control") ?? "", /no-store/i);
});
