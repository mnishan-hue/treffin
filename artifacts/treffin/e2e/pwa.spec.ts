import { expect, test } from "@playwright/test";

test("installed Treffin has valid metadata and relaunches an uncached route offline", async ({ page, context }) => {
  const pageErrors: string[] = [];
  const consoleErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.stack ?? error.message));
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  await page.goto("/privacy");
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();

  const manifest = await page.evaluate(async () => {
    const response = await fetch("/manifest.json");
    return response.json();
  });
  expect(manifest.display).toBe("standalone");
  expect(manifest.start_url).toBe("./");
  expect(manifest.scope).toBe("./");
  expect(manifest.icons).toEqual(expect.arrayContaining([
    expect.objectContaining({ src: "./pwa-icon-192.png", sizes: "192x192" }),
    expect.objectContaining({ src: "./pwa-icon-512.png", sizes: "512x512" }),
    expect.objectContaining({ src: "./pwa-maskable-512.png", sizes: "512x512", purpose: "maskable" }),
  ]));

  const dimensions = await page.evaluate(async () => {
    const paths = ["/pwa-icon-192.png", "/pwa-icon-512.png", "/pwa-maskable-512.png"];
    return Promise.all(paths.map(async (path) => {
      const bitmap = await createImageBitmap(await (await fetch(path)).blob());
      const result = [bitmap.width, bitmap.height];
      bitmap.close();
      return result;
    }));
  });
  expect(dimensions).toEqual([[192, 192], [512, 512], [512, 512]]);

  await page.evaluate(async () => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect(page.getByRole("heading", { name: "Privacy Policy" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByText("A new version of Treffin is ready.")).toBeHidden();
  const cachedUrls = await page.evaluate(async () => {
    const names = await caches.keys();
    return (await Promise.all(names.map(async (name) => (await (await caches.open(name)).keys()).map((request) => request.url)))).flat();
  });
  const expectedTermsUrls = await page.evaluate(async () => {
    const manifest = await (await fetch("/asset-manifest.json")).json();
    return Object.entries(manifest)
      .filter(([key]) => key.includes("pages/terms"))
      .map(([, entry]) => new URL((entry as { file: string }).file, location.origin).href);
  });
  expect(cachedUrls.filter((url) => url.includes("/assets/terms-"))).toEqual(expectedTermsUrls);

  await context.setOffline(true);
  await page.goto("/terms");
  await page.waitForTimeout(1_000);
  expect(pageErrors).toEqual([]);
  await expect(page.getByRole("heading", { name: "Terms of Service" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true);
  expect(pageErrors).toEqual([]);
  expect(consoleErrors.filter((message) => message.includes("ErrorBoundary caught") || message.includes("dynamically imported module"))).toEqual([]);
});
