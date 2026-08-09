import test from "node:test";
import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";

process.env.NEON_DATABASE_URL ??= "postgresql://test:test@127.0.0.1:1/test";
process.env.ADMIN_EMAIL = "admin@example.invalid";
process.env.ADMIN_PASSWORD = "test-password-not-a-secret";
process.env.ADMIN_SESSION_SECRET = "test-admin-session-secret-with-32-characters";
process.env.BETTER_AUTH_SECRET = "test-better-auth-secret-with-32-characters";

const { default: app } = await import("../../app");
const { pool } = await import("@workspace/db");

test("admin login cookie authenticates the guarded session endpoint", async (t) => {
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
  const loginResponse = await fetch(`${origin}/api/admin/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }),
  });

  assert.equal(loginResponse.status, 200);
  const setCookie = loginResponse.headers.get("set-cookie");
  if (!setCookie) assert.fail("Admin login did not set a session cookie");
  assert.ok(setCookie.includes("treffin_admin_session="));
  assert.match(setCookie, /HttpOnly/i);

  const sessionCookie = setCookie.split(";", 1)[0];
  const sessionResponse = await fetch(`${origin}/api/admin/session`, {
    headers: { cookie: sessionCookie },
  });
  assert.equal(sessionResponse.status, 200);
  assert.deepEqual(await sessionResponse.json(), { authenticated: true });
});