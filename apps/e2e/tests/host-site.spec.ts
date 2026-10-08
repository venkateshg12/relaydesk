import { test, expect } from "@playwright/test";
import { TEST_SITE } from "./support";

const KEY = "rd_pk_sweetcrumbsbakery0000001";

// A desktop screen tall enough that the open widget leaves the host's navigation clickable.
test.use({ viewport: { width: 1440, height: 900 } });

test("the widget appears only after the page has loaded, a slow frame never delays the host, a broken one never breaks it", async ({ page }) => {
  // Record when `load` fired and when the iframe was created, inside the page.
  await page.addInitScript(() => {
    // Errors on the host's own window (an error inside the iframe never reaches it).
    const hostErrors: string[] = [];
    (window as unknown as { __hostErrors: string[] }).__hostErrors = hostErrors;
    window.addEventListener("error", (event) => hostErrors.push(event.message));
    const marks: Record<string, number> = {};
    (window as unknown as { __marks: typeof marks }).__marks = marks;
    window.addEventListener("load", () => (marks["load"] = performance.now()));
    new MutationObserver(() => {
      if (document.getElementById("rd-widget-frame") && !marks["iframe"]) marks["iframe"] = performance.now();
    }).observe(document, { childList: true, subtree: true });
  });
  // The frame takes three seconds to arrive, and then throws on startup.
  await page.route("**/frame.html*", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 3000));
    await route.fulfill({ contentType: "text/html", body: "<script>throw new Error('widget exploded')</script>" });
  });
  await page.goto(`${TEST_SITE}/index.html?key=${KEY}`);
  await expect(page.getByRole("heading", { name: "Freshly baked every dawn." })).toBeVisible();
  await expect(page.locator("#rd-widget-frame")).toBeAttached();
  const marks = await page.evaluate(() => (window as unknown as { __marks: Record<string, number> }).__marks);
  expect(marks["iframe"]).toBeGreaterThanOrEqual(marks["load"]!); // the iframe was created after `load`, never before
  await page.waitForTimeout(3500);
  await expect(page.getByRole("link", { name: "Cakes" })).toBeVisible(); // the host still works
  expect(await page.evaluate(() => (window as unknown as { __hostErrors: string[] }).__hostErrors)).toEqual([]); // and never saw the widget's error
});

test("navigating between pages keeps the conversation and the open window", async ({ page }) => {
  await page.goto(`${TEST_SITE}/index.html?key=${KEY}`);
  const widget = page.frameLocator("#rd-widget-frame");
  await widget.getByRole("button", { name: /open chat/i }).click();
  const box = widget.getByRole("textbox", { name: "Message" });
  await box.fill("persist me");
  await box.press("Enter");
  await expect(widget.getByRole("log").getByText("persist me")).toBeVisible();

  await page.getByRole("link", { name: "Cakes" }).click();
  await expect(page).toHaveURL(/cakes\.html/);
  await expect(page.frameLocator("#rd-widget-frame").getByRole("log").getByText("persist me")).toBeVisible({ timeout: 30_000 });
  await expect(page.frameLocator("#rd-widget-frame").getByRole("dialog")).toBeVisible();
});
