import { expect, test } from "@playwright/test";

test("progress figures and captions remain readable on every colored tile", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.locator(".stat")).toHaveCount(4);
  const ratios = await page.locator(".stat").evaluateAll((tiles) => {
    const color = (value: string) => value.match(/[\d.]+/g)!.map(Number);
    const luminance = (rgb: number[]) =>
      rgb
        .slice(0, 3)
        .map((value) => {
          const channel = value / 255;
          return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
        })
        .reduce((sum, value, index) => sum + value * [0.2126, 0.7152, 0.0722][index], 0);
    return tiles.flatMap((tile) => {
      const background = color(getComputedStyle(tile).backgroundColor);
      return [...tile.querySelectorAll("b,small,b span")].map((node) => {
        const style = getComputedStyle(node);
        const foreground = color(style.color);
        const alpha = (foreground[3] ?? 1) * Number(style.opacity);
        const blended = foreground
          .slice(0, 3)
          .map((value, index) => value * alpha + background[index] * (1 - alpha));
        const a = luminance(blended),
          b = luminance(background);
        return { text: node.textContent, ratio: (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) };
      });
    });
  });
  expect(ratios.length).toBeGreaterThan(4);
  for (const value of ratios)
    expect(value.ratio, value.text ?? "progress caption").toBeGreaterThanOrEqual(4.5);
});

test("an empty album shows zero progress and file import keeps a visible keyboard focus", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Pairs", exact: false }).click();
  const meter = page.getByRole("progressbar");
  await expect(meter).toHaveAttribute("aria-valuenow", "0");
  await expect(meter.locator("i")).toHaveCount(0);
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.locator(".file-btn input").focus();
  const ring = await page.locator(".file-btn").evaluate((node) => {
    const style = getComputedStyle(node);
    return { style: style.outlineStyle, width: Number.parseFloat(style.outlineWidth) };
  });
  expect(ring.style).not.toBe("none");
  expect(ring.width).toBeGreaterThanOrEqual(2);
});

test("pronunciation buttons remain usable touch targets on narrow teach cards", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto("/");
  await page.locator(".today .btn").click();
  const buttons = page.locator(".speak");
  await expect(buttons).toHaveCount(2);
  for (const button of await buttons.all()) {
    const rect = await button.boundingBox();
    expect(rect?.width).toBeGreaterThanOrEqual(44);
    expect(rect?.height).toBeGreaterThanOrEqual(44);
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
});

test("investment foundations keep twin practice and expose examples in both languages", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.locator(".level-btn").click();
  await page.locator(".level-item").filter({ hasText: "Investment products and funds" }).click();
  await expect(page.locator(".today-title")).toHaveText("stock/bond");
  await page.locator(".today .btn").click();
  const stock = page.locator(".twin").filter({ has: page.locator(".twin-term", { hasText: /^stock$/ }) });
  await expect(stock.locator(".term-aliases")).toContainText("shares");
  await page.getByText("stock · Example & use", { exact: true }).click();
  await expect(page.locator(".concept-info").first()).toContainText("1%");
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  await page.getByRole("button", { name: "Got it!", exact: true }).click();
  await expect(
    page.locator(".q-meaning, .q-scenario, .q-truefalse, .q-fill, .q-listen, .q-match").first(),
  ).toBeVisible();
  await page.reload();
  await expect(page.locator(".level-btn")).toContainText("Investment products and funds");
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await page.getByRole("button", { name: "学习", exact: true }).click();
  await expect(page.locator(".level-btn")).toContainText("投资品种与基金");
  await page.locator(".today .btn").click();
  await page.getByText("stock · 例子与用法", { exact: true }).click();
  await expect(page.locator(".concept-info").first()).toContainText("教学假设");
  expect(errors).toEqual([]);
});

test("a new learner meets a twin pair, plays a lesson through a miss, and keeps progress", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator(".today-title")).toHaveText("rally/selloff");
  await page.locator(".today .btn").click();
  // The teach card shows both twins side by side.
  await expect(page.locator(".twin")).toHaveCount(2);
  await page.getByRole("button", { name: "Got it!" }).click();

  // Answer everything; get the first question wrong on purpose. A miss never
  // ends the lesson — it comes back at the end.
  let missed = false;
  for (let step = 0; step < 80; step++) {
    if (await page.locator(".done-screen").count()) break;
    if (await page.locator(".feedback").count()) {
      await page.locator(".feedback .btn").click();
      continue;
    }
    if (await page.locator(".teach").count()) {
      await page.locator(".lesson-foot .btn").click();
      continue;
    }
    if (await page.locator(".q-match").count()) {
      const left = page.locator(".match-col").first().locator(".match-btn:not(:disabled)");
      const right = page.locator(".match-col").nth(1).locator(".match-btn:not(:disabled)");
      await left.first().click();
      await right.first().click();
      continue;
    }
    const options = page.locator(".opt, .chip-btn");
    await options.nth(missed ? 0 : (await options.count()) - 1).click();
    await page.locator(".lesson-foot .btn-ink").click();
    if (!missed && (await page.locator(".feedback.no").count())) missed = true;
  }
  await expect(page.locator(".done-screen")).toBeVisible();
  await page.locator(".hero-actions").getByRole("button", { name: "Home" }).click();
  await expect(page.locator(".tab-badge")).not.toHaveText("0");
  await expect(page.locator(".node.done").first()).toBeVisible();
  // The save is asynchronous (IndexedDB); give it a moment before reloading.
  await page.waitForTimeout(500);

  await page.reload();
  await expect(page.locator(".node.done").first()).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
  expect(errors).toEqual([]);
});

test("the learner can switch language and level, and both survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await page.getByRole("button", { name: "学习", exact: true }).click();
  await page.locator(".level-btn").click();
  await page.locator(".level-item").filter({ hasText: "读债券与利率" }).click();
  await expect(page.locator(".level-btn")).toContainText("读债券与利率");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await expect(page.locator(".level-btn")).toContainText("读债券与利率");
});

test("an unavailable level leaves the current one and the language intact and offers retry", async ({
  page,
}) => {
  await page.route("**/sw.js", (route) => route.abort());
  await page.route("**/assets/course-*.js", (route) => route.abort());
  await page.goto("/");
  await page.locator(".level-btn").click();
  await page.locator(".level-item").filter({ hasText: "Bonds and rates" }).click();
  await expect(page.locator(".banner.alert")).toBeVisible();
  await expect(page.locator('.level-item[aria-pressed="true"]')).toContainText("Read the front page");
  await expect(page.locator("html")).toHaveAttribute("lang", "en-US");
  await page.unroute("**/assets/course-*.js");
  await page.getByRole("button", { name: "Try again", exact: true }).click();
  await expect(page.locator(".level-btn")).toContainText("Bonds and rates");
});

test("a failed page chunk provides a readable recovery panel and a usable reload action", async ({
  page,
}) => {
  await page.route("**/sw.js", (route) => route.abort());
  await page.route("**/assets/PairsScreen-*.js", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Pairs", exact: false }).click();
  const alert = page.getByRole("alert");
  await expect(alert).toContainText("This view couldn’t load");
  const reload = alert.getByRole("button", { name: "Reload page", exact: true });
  expect((await reload.boundingBox())?.height).toBeGreaterThanOrEqual(44);
  await expect(alert).toHaveCSS("padding-top", "12px");
  await reload.focus();
  await expect(reload).toBeFocused();
  await page.unroute("**/assets/PairsScreen-*.js");
  await reload.click();
  await expect(page.locator(".today")).toBeVisible();
  await page.getByRole("button", { name: "Pairs", exact: false }).click();
  await expect(page.locator(".album-unit").first()).toBeVisible();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("a service-worker controlled visit keeps the default level usable offline", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.locator(".today")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.reload();
  await expect(page.locator(".loading")).toHaveCount(0);
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "zh-CN");
  await context.setOffline(false);
});

test("foundation editions and new recorded pronunciation are available offline", async ({
  page,
  context,
}) => {
  test.setTimeout(60_000);
  await page.goto("/");
  await expect(page.locator(".today")).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.reload();
  await page.waitForFunction(() => Boolean(navigator.serviceWorker.controller));
  await context.setOffline(true);
  await page.locator(".level-btn").click();
  await page.locator(".level-item").filter({ hasText: "Investment products and funds" }).click();
  await expect(page.locator(".today-title")).toHaveText("stock/bond");
  const clips = await page.evaluate(async () => {
    return Promise.all(
      ["/audio/stock-us.mp3", "/audio/stock-gb.mp3"].map(async (url) => {
        const response = await fetch(url);
        return { ok: response.ok, size: (await response.arrayBuffer()).byteLength };
      }),
    );
  });
  expect(clips.every((clip) => clip.ok && clip.size > 1000)).toBe(true);
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await page.getByRole("button", { name: "中文", exact: true }).click();
  await page.getByRole("button", { name: "学习", exact: true }).click();
  await expect(page.locator(".level-btn")).toContainText("投资品种与基金");
  await context.setOffline(false);
});

test("pair cards trap keyboard focus, download PNG and return to their opener", async ({ page }) => {
  await page.goto("/");
  // Meet the first pair: open the lesson and pass its teach card.
  await page.locator(".today .btn").click();
  await page.getByRole("button", { name: "Got it!" }).click();
  await page.locator(".icon-btn").click();
  await page.getByRole("button", { name: "Pairs", exact: false }).click();
  await page.locator(".pcard:not(.locked)").first().click();
  const opener = page.getByRole("button", { name: "Make a card" });
  await opener.click();
  const dialog = page.locator("dialog.share-backdrop");
  await expect(dialog).toBeVisible();
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((node) => node.contains(document.activeElement))).toBe(true);
  }
  const save = dialog.getByRole("button", { name: "Save image" });
  await expect(save).toBeEnabled();
  const downloading = page.waitForEvent("download");
  await save.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/kachi-.*\.png$/);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(opener).toBeFocused();
});

test("a missing view chunk keeps navigation available with a reload action", async ({ page }) => {
  await page.route("**/sw.js", (route) => route.abort());
  await page.route("**/assets/MeScreen-*.js", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Me", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("couldn’t load");
  await expect(page.getByRole("button", { name: "Reload page", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Learn", exact: true }).click();
  await expect(page.locator(".today")).toBeVisible();
});
