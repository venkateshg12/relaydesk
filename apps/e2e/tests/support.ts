import { expect, type Browser, type BrowserContext, type Page } from "@playwright/test";

const API = "http://localhost:4000";
export const TEST_SITE = "http://localhost:5500";

// An agent: the homepage starts a private demo workspace and signs this browser in as its admin — real
// cookies, a real workspace, nothing seeded by hand. Returns the page, plus the workspace's public key.
export async function signInAsDemoAgent(browser: Browser): Promise<{ context: BrowserContext; page: Page; publicKey: string }> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto("/");
  await expect(page.getByRole("button", { name: /Visitor 1001|Alice/ }).first()).toBeVisible({ timeout: 60_000 });
  const publicKey = await page.evaluate(async (api) => {
    const response = await fetch(`${api}/auth/me`, { credentials: "include" });
    return (await response.json()).data.workspace.publicKey as string;
  }, API);
  return { context, page, publicKey };
}

// A visitor on the bakery test site with that workspace's widget — a separate browser, a separate origin.
export async function openTestSite(browser: Browser, publicKey: string, path = "index.html") {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(`${TEST_SITE}/${path}?key=${publicKey}`);
  const widget = page.frameLocator("#rd-widget-frame");
  await widget.getByRole("button", { name: /open chat/i }).click();
  await widget.getByRole("dialog").waitFor();
  return { context, page, widget };
}
