import { test, expect } from "@playwright/test";
import { openTestSite, signInAsDemoAgent } from "./support";

test("visitor and agent chat live across two windows", async ({ browser }) => {
  const agent = await signInAsDemoAgent(browser);
  const visitor = await openTestSite(browser, agent.publicKey);

  // The visitor writes; it lands in the agent's inbox without a reload.
  const box = visitor.widget.getByRole("textbox", { name: "Message" });
  await box.fill("Is the sourdough still warm?");
  await box.press("Enter");
  await expect(visitor.widget.getByRole("img", { name: /Sent|Seen/ }).first()).toBeVisible();
  const row = agent.page.getByRole("button", { name: /Is the sourdough still warm/ });
  await expect(row).toBeVisible();
  await row.click();

  // The agent types: the visitor sees it. Then replies: the visitor sees that, and the agent's reply is marked seen.
  const reply = agent.page.getByLabel("Reply to visitor");
  await reply.pressSequentially("Fresh out at 5");
  await expect(visitor.widget.getByText(/is typing/)).toBeVisible();
  await reply.fill("Fresh out at 5 o'clock!");
  await reply.press("Enter");
  await expect(visitor.widget.getByText("Fresh out at 5 o'clock!")).toBeVisible();

  await agent.context.close();
  await visitor.context.close();
});

test("the demo's offline button: a message typed during the outage arrives once, after the reconnect", async ({ page }) => {
  await page.goto("/");
  const widget = page.frameLocator("iframe[title='Sweet Crumbs Bakery chat widget']");
  await widget.getByRole("dialog").waitFor({ timeout: 60_000 });
  await expect(page.getByRole("button", { name: "Go offline for 5 seconds" })).toBeEnabled();

  await page.getByRole("button", { name: "Go offline for 5 seconds" }).click();
  await expect(page.getByRole("button", { name: /Offline\. Back in/ })).toBeVisible();
  const box = widget.getByRole("textbox", { name: "Message" });
  await box.fill("typed during the outage");
  await box.press("Enter");
  await expect(widget.getByRole("img", { name: "Sending" })).toBeVisible();

  await expect(page.getByText("typed during the outage").first()).toBeVisible({ timeout: 30_000 });
  await expect(widget.getByRole("img", { name: /Sent|Seen/ }).last()).toBeVisible();
  await page.getByRole("button", { name: /typed during the outage/ }).click();
  await expect(page.getByRole("region", { name: "Conversation" }).getByText("typed during the outage")).toHaveCount(1); // once, not doubled
});

test("reduced motion: typing is still announced in words", async ({ browser }) => {
  const agent = await signInAsDemoAgent(browser);
  const context = await browser.newContext({ reducedMotion: "reduce" });
  const page = await context.newPage();
  await page.goto(`http://localhost:5500/index.html?key=${agent.publicKey}`);
  const widget = page.frameLocator("#rd-widget-frame");
  await widget.getByRole("button", { name: /open chat/i }).click();
  const box = widget.getByRole("textbox", { name: "Message" });
  await box.fill("hello");
  await box.press("Enter");

  await agent.page.getByRole("button", { name: /hello/ }).first().click();
  await agent.page.getByLabel("Reply to visitor").pressSequentially("typing now");
  await expect(widget.getByText(/is typing…/)).toBeVisible();
  await context.close();
  await agent.context.close();
});
