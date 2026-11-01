import { expect, test } from "@playwright/test";
import en from "../content/packs/t5-quant-research/en-US/course.json" with { type: "json" };
import zh from "../content/packs/t5-quant-research/zh-CN/course.json" with { type: "json" };

for (const [locale, course] of [
  ["en-US", en],
  ["zh-CN", zh],
] as const) {
  test(`research cases keep their question, answer and explanation usable in ${locale}`, async ({
    page,
  }, info) => {
    await page.goto("/");
    if (locale === "zh-CN") {
      await page.getByRole("button", { name: "Me", exact: true }).click();
      await page.getByRole("button", { name: "中文", exact: true }).click();
      await page.getByRole("button", { name: "学习", exact: true }).click();
    }
    await page.locator(".level-btn").click();
    await page
      .locator(".level-item")
      .filter({ hasText: locale === "zh-CN" ? "读研报与量化" : "Research and quant" })
      .click();
    await expect(page.locator(".level-btn")).toContainText(
      locale === "zh-CN" ? "读研报与量化" : "Research and quant",
    );
    await page.locator(".today .btn").click();
    await expect(page.locator(".teach")).toBeVisible();
    while (await page.locator(".teach").count()) {
      await page.locator(".lesson-foot .btn").click();
    }

    // Follow the published lesson, so this also catches missing generated cases.
    for (const prompt of course.lessons[0].prompts) {
      if (prompt.type === "audit") {
        await expect(page.locator(".claim")).toHaveText(prompt.story!);
        await expect(page.locator(".q-stem")).toHaveText(prompt.stem!);
        await expect(page.locator(".opt")).toHaveCount(4);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        await page.screenshot({ path: info.outputPath("research-question.png"), fullPage: true });
        const correct = prompt.options![prompt.answer as number].text;
        await page.locator(".opt").filter({ hasText: correct }).click();
        await page.locator(".lesson-foot .btn-ink").click();
        await expect(page.locator(".feedback.ok")).toBeVisible();
        await expect(page.locator(".feedback")).toContainText(prompt.why);
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
        return;
      }
      if (prompt.type === "truefalse") {
        await page
          .locator(".opt")
          .nth(prompt.answer ? 0 : 1)
          .click();
      } else if (prompt.type === "fill") {
        await page
          .locator(".chip-btn")
          .filter({ hasText: prompt.answer as string })
          .click();
      } else {
        const correct = prompt.options![prompt.answer as number].text;
        await page.locator(".opt").filter({ hasText: correct }).click();
      }
      await page.locator(".lesson-foot .btn-ink").click();
      await expect(page.locator(".feedback.ok")).toBeVisible();
      await page.locator(".feedback .btn").click();
    }
    throw new Error("The first research lesson did not reach an audit case");
  });
}
