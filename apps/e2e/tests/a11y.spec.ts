import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { openTestSite, signInAsDemoAgent } from "./support";

// Zero serious or critical violations on the screens a person actually uses (DESIGN_SYSTEM §12).
const scan = async (page: import("@playwright/test").Page, scope?: string) => {
  const builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]);
  const results = await (scope ? builder.include(scope) : builder).analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id}: ${v.help} — ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
};

test("axe: /login", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("button", { name: /log in|sign in/i })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("axe: /signup", async ({ page }) => {
  await page.goto("/signup");
  await expect(page.getByRole("heading", { name: "Create your workspace" })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

// The homepage: the stage hero, every reference-led section and the footer, with the live demo running.
test("axe: / (homepage)", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Questions owners ask." })).toBeVisible();
  expect(await scan(page)).toEqual([]);
});

test("axe: /inbox and /admin/widget (signed in as a demo admin), screenshots at 375 and 1280", async ({ browser }) => {
  const { page, context } = await signInAsDemoAgent(browser);
  await page.goto("/inbox");
  await expect(page.getByRole("tab", { name: /All open/ })).toBeVisible();
  expect(await scan(page)).toEqual([]);
  await page.goto("/admin/widget");
  await expect(page.getByLabel("Business name")).toBeVisible();
  expect(await scan(page)).toEqual([]);

  for (const width of [1280, 375]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto("/inbox");
    await page.screenshot({ path: `test-results/inbox-${width}.png` });
  }
  await context.close();
});

test("axe: the widget frame", async ({ browser }) => {
  const agent = await signInAsDemoAgent(browser);
  const visitor = await openTestSite(browser, agent.publicKey);
  expect(await scan(visitor.page, "#rd-widget-frame")).toEqual([]);
  await agent.context.close();
  await visitor.context.close();
});
