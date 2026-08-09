import { expect, test, type Page, type Route } from "@playwright/test";

async function json(route: Route, body: unknown, status = 200) {
  await route.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
}

async function preparePublicApi(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem("treffin_onboarded", "1");
    if (!localStorage.getItem("treffin_theme")) localStorage.setItem("treffin_theme", "dark");
  });
  await page.route("**/api/auth/get-session", (route) => json(route, { session: null, user: null }));
  await page.route("**/api/**", (route) => json(route, []));
}

async function colors(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((element) => {
    const style = getComputedStyle(element);
    return { background: style.backgroundColor, color: style.color };
  });
}

test.describe("light and dark theme behavior", () => {
  test.beforeEach(async ({ page }) => preparePublicApi(page));

  test("About toggles its semantic surfaces and persists light mode", async ({ page }) => {
    await page.goto("/about");

    await expect(page.locator("html")).toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveCSS("color-scheme", "dark");

    const darkBody = await colors(page, "body");
    const darkFeature = await page.getByText("Intellectual Identity", { exact: true })
      .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')][1]")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
      });

    await page.getByRole("button", { name: "Toggle theme" }).click();

    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.locator("html")).toHaveCSS("color-scheme", "light");
    await expect.poll(() => page.evaluate(() => localStorage.getItem("treffin_theme"))).toBe("light");

    const lightBody = await colors(page, "body");
    const lightFeature = await page.getByText("Intellectual Identity", { exact: true })
      .locator("xpath=ancestor::*[contains(@class, 'rounded-2xl')][1]")
      .evaluate((element) => {
        const style = getComputedStyle(element);
        return { background: style.backgroundColor, color: style.color };
      });

    expect(lightBody.background).not.toBe(darkBody.background);
    expect(lightBody.color).not.toBe(darkBody.color);
    expect(lightFeature.background).not.toBe(darkFeature.background);

    await page.goto("/sign-in");
    await expect(page.locator("html")).not.toHaveClass(/dark/);
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible();

    const lightInput = await colors(page, "input[type='email']");
    expect(lightInput.background).not.toBe(darkFeature.background);
  });

  test("authentication surfaces follow a stored theme change", async ({ page }) => {
    await page.goto("/sign-in");
    const darkHeading = await colors(page, "h1");
    const darkInput = await colors(page, "input[type='email']");

    await page.evaluate(() => localStorage.setItem("treffin_theme", "light"));
    await page.reload();

    await expect(page.locator("html")).not.toHaveClass(/dark/);
    const lightHeading = await colors(page, "h1");
    const lightInput = await colors(page, "input[type='email']");

    expect(lightHeading.color).not.toBe(darkHeading.color);
    expect(lightInput.background).not.toBe(darkInput.background);
    expect(lightInput.color).not.toBe(darkInput.color);
  });
});

