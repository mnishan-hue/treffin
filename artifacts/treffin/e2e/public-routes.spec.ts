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
});

test("public pages do not overflow a phone viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-project check");
  for (const path of ["/privacy", "/terms", "/sign-in", "/sign-up"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, `${path} horizontal overflow`).toBeLessThanOrEqual(1);
  }
});