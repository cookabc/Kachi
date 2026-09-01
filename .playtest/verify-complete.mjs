import path from 'node:path';
import { chromium } from 'playwright-core';

const HTML = 'file://' + path.resolve('..', 'Hedge-or-Pledge.html');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const sleep = (ms) => page.waitForTimeout(ms);
const jsClick = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) el.click();
  }, sel);

// seed: every lesson except the last one (u5r) completed
await page.goto(HTML);
await page.evaluate(() => {
  localStorage.setItem(
    'hedge-or-pledge-v1',
    JSON.stringify({
      xp: 0,
      streak: 0,
      lastPlayedDate: null,
      completedLessonIds: [
        'u1l1',
        'u1l2',
        'u1l3',
        'u1r',
        'u2l1',
        'u2l2',
        'u2l3',
        'u2r',
        'u3l1',
        'u3l2',
        'u3r',
        'u4l1',
        'u4l2',
        'u4r',
        'u5l1',
        'u5l2',
      ],
      missedTermIds: [],
      seenTermIds: [],
    }),
  );
});
await page.reload();
await sleep(400);

// play u5r (recap: no teach cards) — answer first option always, expect some misses
await page.evaluate(() => document.querySelector('button.node[data-id="u5r"]').click());
await sleep(300);
while (await page.$('.prompt.teach')) {
  await jsClick('button[data-act="teach-next"]');
  await sleep(150);
}
let misses = 0;
for (let i = 0; i < 20; i++) {
  if (await page.$('.hero')) break;
  if (await page.$('.match')) {
    for (let k = 0; k < 8; k++) {
      const L = await page.$('.match button.mchip[data-side="L"][data-act="m"]');
      if (!L) break;
      const id = await L.getAttribute('data-id');
      await L.click();
      await page.$$eval(
        '.match button.mchip[data-side="R"]',
        (els, id) => {
          const el = els.find((e) => e.dataset.id === id);
          if (el) el.click();
        },
        id,
      );
      await sleep(40);
    }
    await sleep(300); // auto-judged now
    await jsClick('button[data-act="cont"]');
    await sleep(200);
    continue;
  }
  if (await page.$('.opts button.opt'))
    await page.$$eval('.opts button.opt', (els) => els[els.length - 1].click());
  else if (await page.$('.tf button.opt')) await page.$$eval('.tf button.opt', (els) => els[0].click());
  else if (await page.$('.bank button.bank-chip'))
    await page.$$eval('.bank button.bank-chip', (els) => els[els.length - 1].click());
  await jsClick('button[data-act="check"]');
  await sleep(150);
  if (await page.$('.sheet.no')) misses++;
  await jsClick('button[data-act="cont"]');
  await sleep(200);
}
const btns = await page.$$eval('.hero .btn', (els) => els.map((b) => b.textContent.trim()));
console.log('last-lesson complete with', misses, 'misses. buttons:', JSON.stringify(btns));
const labels = btns.join('|');
console.log(
  'duplicate path exits:',
  btns.filter((b) => b === 'Back to the path').length > 1 ? 'YES (bug)' : 'no',
);
await page.screenshot({ path: 'shots/v-last-lesson-complete.png' });
await browser.close();
