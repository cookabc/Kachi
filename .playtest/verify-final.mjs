import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const file = path.resolve('..', 'Hedge-or-Pledge.html');
const html = fs.readFileSync(file, 'utf8');
const code = html.slice(html.indexOf('const TERMS = {'), html.indexOf('/* ========== STATE'));
eval(code + '\nglobalThis.__L = LESSONS;');
const lesson = globalThis.__L.find((l) => l.id === 'u1l1');
const key = lesson.prompts.map((p) => {
  if (p.type === 'match') return { type: 'match' };
  if (p.type === 'truefalse') return { type: 'tf', val: p.answer };
  if (p.type === 'fill') return { type: 'fill', val: p.answer };
  return { type: 'opts', val: p.options[p.answer].text };
});
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const sleep = (ms) => page.waitForTimeout(ms);
const jsClick = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) el.click();
  }, sel);
await page.goto('file://' + file);
await page.evaluate(() => localStorage.clear());
await page.reload();
await sleep(400);
// header should have XP + streak only
console.log(
  'header stats children:',
  await page.$$eval('.stats .stat', (els) => els.map((e) => e.className)),
);
console.log('header hearts present:', !!(await page.$('.stats .hearts')));
await page.evaluate(() => document.querySelector('button.node[data-id="u1l1"]').click());
await sleep(250);
while (await page.$('.prompt.teach')) {
  await jsClick('button[data-act="teach-next"]');
  await sleep(150);
}
let idx = 0;
for (let step = 0; step < 15; step++) {
  if (await page.$('.hero')) break;
  const k = key[idx];
  if (k.type === 'match') {
    for (let c = 0; c < 8; c++) {
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
    await sleep(300);
  } else if (k.type === 'tf') {
    await page.$$eval('.tf button.opt', (els, i) => els[i].click(), k.val ? 0 : 1);
    await jsClick('button[data-act="check"]');
    await sleep(150);
  } else if (k.type === 'fill') {
    const chips = await page.$$eval('.bank button.bank-chip', (els) => els.map((e) => e.dataset.val));
    await page.$$eval('.bank button.bank-chip', (els, i) => els[i].click(), chips.indexOf(k.val));
    await jsClick('button[data-act="check"]');
    await sleep(150);
  } else {
    const texts = await page.$$eval('.opts button.opt', (els) => els.map((e) => e.dataset.val));
    await page.$$eval('.opts button.opt', (els, i) => els[i].click(), texts.indexOf(k.val));
    await jsClick('button[data-act="check"]');
    await sleep(150);
  }
  await jsClick('button[data-act="cont"]');
  await sleep(200);
  idx++;
}
console.log('complete title:', await page.$eval('.hero h1', (el) => el.textContent));
console.log(
  'complete buttons:',
  await page.$$eval('.hero .btn', (els) => els.map((b) => b.textContent.trim())),
);
console.log('xp:', await page.evaluate(() => JSON.parse(localStorage.getItem('hedge-or-pledge-v1')).xp));
await page.screenshot({ path: 'shots/v-flawless.png' });
await browser.close();
