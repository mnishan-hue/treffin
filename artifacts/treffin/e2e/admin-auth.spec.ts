import { expect, test } from "@playwright/test";

test("admin login establishes an HttpOnly session and loads guarded data", async ({ page, context, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 700 });
  let authenticated = false;
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: authenticated ? 200 : 401,
    contentType: "application/json",
    body: JSON.stringify(authenticated ? { authenticated: true } : { error: "Unauthorized" }),
  }));
  await page.route("**/api/admin/login", (route) => {
    authenticated = true;
    return route.fulfill({ status: 200, headers: { "set-cookie": "treffin_admin_session=test-session; Path=/api/admin; HttpOnly; SameSite=Lax" }, contentType: "application/json", body: JSON.stringify({ ok: true, expiresAt: new Date(Date.now() + 3_600_000).toISOString() }) });
  });
  await page.route("**/api/admin/stats", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ totalUsers: 3, totalPosts: 4, totalDebates: 5, totalArticles: 6, totalCommunities: 2, repEventsToday: 1, mostActiveUser: null, openAppeals: 0, flaggedPosts: 0, pendingReviews: 0, highRiskUsers: 0 }) }));
  await page.route("**/api/admin/notifications/counts", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ openAppeals: 0, pendingReviews: 0, openCreatorReports: 0 }) }));

  await page.goto("/");
  await page.locator('input[type="email"]').fill("admin@example.invalid");
  await page.locator('input[type="password"]').fill("not-a-real-secret");
  await page.getByRole("button", { name: "Sign In" }).click();
  await expect(page.getByRole("button", { name: "Command Center" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("treffin_admin_token"))).toBeNull();
  const cookie = (await context.cookies()).find((item) => item.name === "treffin_admin_session");
  expect(cookie?.httpOnly).toBe(true);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow, "admin dashboard horizontal overflow").toBeLessThanOrEqual(1);
  if (isMobile) {
    for (const section of ["Users", "Problems", "Database Tools"]) {
      await page.getByRole("button", { name: "Open menu" }).click();
      await page.getByRole("button", { name: section, exact: true }).click();
      const sectionOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(sectionOverflow, `${section} horizontal overflow`).toBeLessThanOrEqual(1);
    }
  }
});
test("expired admin API session clears the shell and returns to login", async ({ page }) => {
  await page.route("**/api/admin/session", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ authenticated: true }),
  }));
  await page.route("**/api/admin/stats", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "Unauthorized" }),
  }));
  await page.route("**/api/admin/notifications/counts", (route) => route.fulfill({
    status: 401,
    contentType: "application/json",
    body: JSON.stringify({ error: "Unauthorized" }),
  }));

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Admin Panel" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
});
test("admin Outcomes concludes an Elegant Battle with a mathematical verdict", async ({ page, isMobile }) => {
  if (isMobile) await page.setViewportSize({ width: 320, height: 700 });
  let outcomeBody: { winningSide?: string; justification?: string } | null = null;
  await page.route("**/api/admin/session", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ authenticated: true }) }));
  await page.route("**/api/admin/stats", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ totalUsers: 0, totalPosts: 0, totalDebates: 1, totalArticles: 0, totalCommunities: 0, repEventsToday: 0, mostActiveUser: null, openAppeals: 0, flaggedPosts: 0, pendingReviews: 0, highRiskUsers: 0 }) }));
  await page.route("**/api/admin/notifications/counts", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ openAppeals: 0, pendingReviews: 0, openCreatorReports: 0 }) }));
  await page.route("**/api/admin/debates", (route) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify([{ id: 70, title: "Elegance Battle: Sample identity", category: "Mathematics", participantCount: 0, isLive: true, isTrending: false, isFeatured: false, createdAt: new Date().toISOString(), hasOutcome: false, mathProblemId: 7, winnerStatus: "undecided" }]) }));
  await page.route("**/api/debates/70/comments", (route) => route.fulfill({ status: 200, contentType: "application/json", body: "[]" }));
  await page.route("**/api/admin/debates/70/outcome", async (route) => {
    outcomeBody = route.request().postDataJSON() as { winningSide?: string; justification?: string };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true }) });
  });

  await page.goto("/");
  if (isMobile) await page.getByRole("button", { name: "Open menu" }).click();
  await page.getByRole("button", { name: "Debate Outcomes", exact: true }).click();
  await page.getByRole("button", { name: "Adjudicate" }).click();
  await expect(page.getByText("Conclude Elegance Battle", { exact: true })).toBeVisible();
  await expect(page.getByText(/no support\/against side is used/i)).toBeVisible();
  await page.getByPlaceholder(/Explain the ruling/i).fill("The algebraic proof is concise, rigorous, and exposes the invariant directly.");
  await page.getByRole("button", { name: "Publish Math Verdict" }).click();
  await expect.poll(() => outcomeBody).toEqual({
    winningSide: "draw",
    justification: "The algebraic proof is concise, rigorous, and exposes the invariant directly.",
  });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
