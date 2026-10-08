import { defineConfig, devices } from "@playwright/test";

// The whole stack runs for these tests: API (:4000), web (:3000), widget (:5173) and the plain "bakery" test
// site (:5500) that proves the widget works on a site we don't control. Servers already running are reused.
export default defineConfig({
  testDir: "./tests",
  fullyParallel: false,
  forbidOnly: !!process.env["CI"],
  retries: process.env["CI"] ? 2 : 0,
  workers: 1,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["html", { open: "never" }], ["list"]],
  use: { baseURL: "http://localhost:3000", trace: "on-first-retry", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "pnpm --filter server dev", url: "http://localhost:4000/health", reuseExistingServer: true, timeout: 120_000, cwd: "../.." },
    { command: "pnpm --filter web dev", url: "http://localhost:3000/login", reuseExistingServer: true, timeout: 180_000, cwd: "../.." },
    { command: "pnpm --filter widget dev", url: "http://localhost:5173/frame.html", reuseExistingServer: true, timeout: 60_000, cwd: "../.." },
    { command: "pnpm --filter test-site serve", url: "http://localhost:5500/index.html", reuseExistingServer: true, timeout: 60_000, cwd: "../.." },
  ],
});
