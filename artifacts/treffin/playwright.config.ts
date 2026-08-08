import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: process.env.CI ? 1 : undefined,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  expect: { timeout: 10_000 },
  use: {
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    serviceWorkers: "block",
  },
  webServer: [
    {
      command: "pnpm exec vite preview --config vite.config.ts --host 127.0.0.1 --port 4173 --strictPort",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: "pnpm --dir ../admin exec vite preview --config vite.config.ts --host 127.0.0.1 --port 4174 --strictPort",
      url: "http://127.0.0.1:4174",
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
  projects: [
    { name: "desktop-chromium", testIgnore: /admin-auth\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4173" } },
    { name: "mobile-chromium", testIgnore: /admin-auth\.spec\.ts/, use: { ...devices["Pixel 5"], baseURL: "http://127.0.0.1:4173" } },
    { name: "admin-chromium", testMatch: /admin-auth\.spec\.ts/, use: { ...devices["Desktop Chrome"], baseURL: "http://127.0.0.1:4174" } },
  ],
});