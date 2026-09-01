import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright-core';

const file = path.resolve('..', 'Hedge-or-Pledge.html');
const html = fs.readFileSync(file, 'utf8');
const code = html.slice(html.indexOf('const TERMS = {'), html.indexOf('/* ========== STATE'));
eval(code + '\nglobalThis.__L = LESSONS;');
const u5r = globalThis.__L.find((l) => l.id === 'u5r');
// deterministic prompt order; answer key per index
const key = u5r.prompts.map((p) => {
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
await page.evaluate(() => document.querySelector('button.node[data-id="u5r"]').click());
await sleep(300);
while (await page.$('.prompt.teach')) {
  await jsClick('button[data-act="teach-next"]');
  await sleep(150);
}

let idx = 0,
  misses = 0,
  forced = false;
for (let step = 0; step < 25; step++) {
  if (await page.$('.hero')) break;
  const k = key[idx];
  if (!k) break;
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
    const good = k.val ? 0 : 1;
    const pick = !forced ? ((forced = true), 1 - good) : good; // one deliberate miss
    await page.$$eval('.tf button.opt', (els, i) => els[i].click(), pick);
    await jsClick('button[data-act="check"]');
    await sleep(150);
  } else if (k.type === 'fill') {
    const chips = await page.$$eval('.bank button.bank-chip', (els) => els.map((e) => e.dataset.val));
    let i = chips.indexOf(k.val);
    if (!forced) {
      forced = true;
      i = (i + 1) % chips.length;
    }
    await page.$$eval('.bank button.bank-chip', (els, i) => els[i].click(), i);
    await jsClick('button[data-act="check"]');
    await sleep(150);
  } else {
    const texts = await page.$$eval('.opts button.opt', (els) => els.map((e) => e.dataset.val));
    let i = texts.indexOf(k.val);
    if (!forced) {
      forced = true;
      i = (i + 1) % texts.length;
    }
    await page.$$eval('.opts button.opt', (els, i) => els[i].click(), i);
    await jsClick('button[data-act="check"]');
    await sleep(150);
  }
  if (await page.$('.sheet.no')) misses++;
  await jsClick('button[data-act="cont"]');
  await sleep(200);
  idx++;
}
const btns = await page.$$eval('.hero .btn', (els) => els.map((b) => b.textContent.trim()));
console.log('u5r complete, misses:', misses, '| buttons:', JSON.stringify(btns));
console.log(
  'duplicate "Back to the path":',
  btns.filter((b) => b === 'Back to the path').length > 1 ? 'YES (bug)' : 'no',
);
await page.screenshot({ path: 'shots/v-last-lesson-complete.png' });
await browser.close();
