import { expect, test } from "@playwright/test";

test("the learner can switch language, browse a pack and retain progress across reload", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("button", { name: "English", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.locator(".pack-choice").first().click();
  await expect(page.locator('.pack-choice[aria-pressed="true"]')).toContainText("front page");
  await page.getByRole("button", { name: "Learning path", exact: true }).click();
  await expect(page.locator(".app-window")).toContainText("42");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("an unavailable lazy course leaves the current language and selection intact and offers retry", async ({
  page,
}) => {
  await page.route("**/sw.js", (route) => route.abort());
  await page.route("**/assets/course-*.js", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.locator(".pack-choice").first().click();
  await expect(page.locator(".course-alert")).toBeVisible();
  await expect(page.locator('.pack-choice[aria-pressed="true"]')).toContainText("Borrow");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await expect(page.getByRole("button", { name: "Try again", exact: true })).toBeEnabled();
  await page.unroute("**/assets/course-*.js");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator('.pack-choice[aria-pressed="true"]')).toContainText("front page");
});

test("a service-worker controlled visit keeps the default course usable offline", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.locator(".lab-hero")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".loading")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Settings", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await context.setOffline(false);
});

test("share cards trap keyboard focus, download PNG and return to their opener", async ({ page }) => {
  await page.goto("/");
  await page.locator(".lab-hero-cta").click();
  await page.locator(".xbtn").click();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  const opener = page.locator(".g-share").first();
  await opener.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  const save = dialog.locator(".btn-gold");
  await expect(save).toBeEnabled();
  const downloading = page.waitForEvent("download");
  await save.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/kachi-.*\.png$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
  await page.reload();
  await page.getByRole("button", { name: "Glossary", exact: true }).click();
  await expect(page.locator(".g-share").first()).toBeVisible();
});

test("a missing view chunk keeps navigation available with a reload action", async ({ page }) => {
  await page.route("**/sw.js", (route) => route.abort());
  await page.route("**/assets/Settings-*.js", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("This view could not load");
  await expect(page.getByRole("button", { name: "Reload page", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Learning path", exact: true }).click();
  await expect(page.locator(".lab-hero")).toBeVisible();
});
