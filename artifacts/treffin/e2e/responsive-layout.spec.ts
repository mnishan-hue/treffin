import { expect, test, type Page, type Route } from "@playwright/test";

const representativeRoutes = [
  "/about",
  "/privacy",
  "/terms",
  "/sign-in",
  "/sign-up",
  "/debates",
  "/articles",
  "/communities",
  "/discover",
  "/math",
  "/math/potw",
  "/math/leaderboard",
  "/math/contests",
];

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function preparePublicApi(page: Page) {
  await page.addInitScript(() => localStorage.setItem("treffin_onboarded", "1"));
  await page.route("**/api/auth/get-session", (route) => json(route, { session: null, user: null }));
  await page.route("**/api/**", (route) => json(route, []));
}

async function expectViewportContained(page: Page, path: string) {
  await page.goto(path);
  await page.waitForTimeout(150);
  const result = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const overflow = document.documentElement.scrollWidth - viewportWidth;
    const selector = "button, input, textarea, select, [role='dialog'], [data-testid], main, article, form";
    const violations = [...document.querySelectorAll<HTMLElement>(selector)]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        if (rect.width < 1 || rect.height < 1) return false;
        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName,
        testId: element.dataset.testid ?? null,
        text: (element.textContent ?? "").trim().slice(0, 60),
        rect: element.getBoundingClientRect().toJSON(),
      }));
    return { overflow, violations };
  });
  expect(result.overflow, `${path} document overflow`).toBeLessThanOrEqual(1);
  expect(result.violations, `${path} controls outside viewport`).toEqual([]);
}

test.describe("responsive route containment", () => {
  test.beforeEach(async ({ page }) => preparePublicApi(page));

  test("representative routes remain inside a 320px phone viewport", async ({ page, isMobile }) => {
    test.skip(!isMobile, "mobile-project check");
    await page.setViewportSize({ width: 320, height: 700 });
    for (const path of representativeRoutes) await expectViewportContained(page, path);
  });

  test("representative routes remain contained on desktop", async ({ page, isMobile }) => {
    test.skip(isMobile, "desktop-project check");
    await page.setViewportSize({ width: 1440, height: 900 });
    for (const path of representativeRoutes) await expectViewportContained(page, path);
  });
});