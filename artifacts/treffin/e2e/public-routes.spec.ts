import { expect, test } from "@playwright/test";

const publicPages = [
  { path: "/privacy", heading: "Privacy Policy" },
  { path: "/terms", heading: "Terms of Service" },
  { path: "/sign-in", heading: "Welcome back" },
];

for (const entry of publicPages) {
  test(`${entry.path} loads its lazy route`, async ({ page }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (error) => pageErrors.push(error.message));
    await page.goto(entry.path);
    await expect(page.getByRole("heading", { name: entry.heading })).toBeVisible();
    expect(pageErrors).toEqual([]);
  });
}

test("authentication entry points remain connected", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByRole("link", { name: /sign up/i }).click();
  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page.getByRole("button", { name: "Create account" })).toBeVisible();

  await page.goto("/sign-in");
  await page.getByRole("link", { name: /forgot password/i }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("button", { name: "Send reset link" })).toBeVisible();
});


test("email and password sign-in requires the emailed OTP before navigation", async ({ page, isMobile }) => {
  let otpRequests = 0;
  let verifiedCode: string | undefined;
  let authenticated = false;
  const authRequestOrigins = new Set<string>();

  await page.addInitScript(() => {
    localStorage.setItem("treffin_onboarded", "true");
    localStorage.setItem("treffin_cookie_consent", "accepted");
  });
  await page.route("**/api/auth/get-session", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(authenticated ? {
        session: { id: "otp-session", userId: "otp-user", token: "otp-session-token", expiresAt: new Date(Date.now() + 3_600_000).toISOString() },
        user: { id: "otp-user", name: "OTP Member", email: "member@example.test", image: null },
      } : null),
    });
  });
  await page.route("**/api/users/me", async (route) => {
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ id: 1, betterAuthId: "otp-user", name: "OTP Member", interests: ["Science"] }) });
  });
  await page.route("**/api/notifications**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const body = path.endsWith("/preferences") ? { likes: true, replies: true, follows: true, debates: true } : [];
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });  await page.route("**/api/auth/sign-in/email", async (route) => {
    authRequestOrigins.add(new URL(route.request().url()).origin);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ twoFactorRedirect: true, twoFactorMethods: ["otp"] }),
    });
  });
  await page.route("**/api/auth/two-factor/send-otp", async (route) => {
    authRequestOrigins.add(new URL(route.request().url()).origin);
    otpRequests += 1;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: true }) });
  });
  await page.route("**/api/auth/two-factor/verify-otp", async (route) => {
    authRequestOrigins.add(new URL(route.request().url()).origin);
    verifiedCode = (route.request().postDataJSON() as { code?: string }).code;
    authenticated = true;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        token: "otp-session-token",
        user: {
          id: "otp-user",
          name: "OTP Member",
          email: "member@example.test",
          emailVerified: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }),
    });
  });

  await page.goto("/sign-in?next=%2Fnotifications");
  await page.getByLabel("Email").fill("member@example.test");
  await page.getByLabel("Password", { exact: true }).fill("A-secure-password-123!");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
  await expect.poll(() => otpRequests).toBe(1);
  await expect(page.getByText("me****@example.test", { exact: true })).toBeVisible();
  if (isMobile) {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  }

  await page.getByLabel("One-time code").fill("123456");
  await page.getByRole("button", { name: "Verify and sign in" }).click();
  await expect.poll(() => verifiedCode).toBe("123456");
  expect([...authRequestOrigins]).toEqual([new URL(page.url()).origin]);
  await expect(page).toHaveURL(/\/notifications$/);
  expect(await page.evaluate(() => sessionStorage.getItem("treffin_auth_token"))).toBe("otp-session-token");
});
test("password recovery requests a link and accepts a valid reset token", async ({ page }) => {
  let resetRequest: { email?: string; redirectTo?: string } | null = null;
  await page.route("**/api/auth/request-password-reset", async (route) => {
    resetRequest = route.request().postDataJSON() as { email?: string; redirectTo?: string };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: true }) });
  });
  await page.goto("/forgot-password");
  await page.getByLabel("Email").fill("member@example.test");
  await page.getByRole("button", { name: "Send reset link" }).click();
  await expect(page.getByText(/check your inbox/i)).toBeVisible();
  expect(resetRequest).toEqual({
    email: "member@example.test",
    redirectTo: "http://127.0.0.1:4173/reset-password",
  });

  let passwordReset: { newPassword?: string; token?: string } | null = null;
  await page.route("**/api/auth/reset-password", async (route) => {
    passwordReset = route.request().postDataJSON() as { newPassword?: string; token?: string };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ status: true }) });
  });
  await page.goto("/reset-password?token=valid-test-token");
  await page.getByLabel("New password").fill("A-secure-password-123!");
  await page.getByLabel("Confirm password").fill("A-secure-password-123!");
  await page.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByText(/password was changed/i)).toBeVisible();
  expect(passwordReset).toEqual({ newPassword: "A-secure-password-123!", token: "valid-test-token" });
});

test("password reset rejects a missing or expired token", async ({ page }) => {
  await page.goto("/reset-password?error=INVALID_TOKEN");
  await expect(page.getByRole("alert")).toContainText(/invalid or has expired/i);
  await expect(page.getByRole("link", { name: /request a new link/i })).toBeVisible();
});

test("public pages do not overflow a phone viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-project check");
  for (const path of ["/privacy", "/terms", "/sign-in", "/sign-up", "/forgot-password", "/reset-password?error=INVALID_TOKEN"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});
