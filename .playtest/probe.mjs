import path from 'node:path';
import { chromium } from 'playwright-core';

const HTML = 'file://' + path.resolve('..', 'Hedge-or-Pledge.html');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
const sleep = (ms) => page.waitForTimeout(ms);
const jsClick = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (el) el.click();
  }, sel);

await page.goto(HTML);
await sleep(400);

// A) glossary list scrollability
await jsClick('nav.nav button[data-tab="glossary"]');
await sleep(300);
const g = await page.evaluate(() => {
  const el = document.getElementById('g-list');
  const cs = getComputedStyle(el);
  const before = el.scrollTop;
  el.scrollTop = 2000;
  return {
    scrollH: el.scrollHeight,
    clientH: el.clientHeight,
    overflowY: cs.overflowY,
    scrolled: el.scrollTop !== before,
    scrolledTo: el.scrollTop,
  };
});
console.log('glossary list:', JSON.stringify(g));

// B) match wrong-pair: does it cost a heart?
await jsClick('nav.nav button[data-tab="learn"]');
await sleep(250);
await jsClick('button.node[data-id="u1l1"]');
await sleep(250);
while (await page.$('.prompt.teach')) {
  await jsClick('button[data-act="teach-next"]');
  await sleep(200);
}
// advance to the match prompt (index 5): answer first five correctly-ish (click first opt; if wrong it's fine, track)
for (let i = 0; i < 5; i++) {
  if (await page.$('.opts button.opt')) await page.$$eval('.opts button.opt', (els) => els[0].click());
  else if (await page.$('.tf button.opt')) await page.$$eval('.tf button.opt', (els) => els[0].click());
  else if (await page.$('.bank button.bank-chip'))
    await page.$$eval('.bank button.bank-chip', (els) => els[0].click());
  await jsClick('button[data-act="check"]');
  await sleep(150);
  await jsClick('button[data-act="cont"]');
  await sleep(200);
}
const isMatch = !!(await page.$('.match'));
console.log('reached match prompt:', isMatch);
if (isMatch) {
  const h0 = await page.$$eval('.l-top .hearts .ht.full', (els) => els.length);
  // click L of first id, then R of a DIFFERENT id
  const [idL, idR] = await page.evaluate(() => {
    const L = [...document.querySelectorAll('.match button.mchip[data-side="L"][data-act="m"]')];
    const R = [...document.querySelectorAll('.match button.mchip[data-side="R"][data-act="m"]')];
    const l = L[0].dataset.id;
    const r = R.find((x) => x.dataset.id !== l).dataset.id;
    return [l, r];
  });
  await page.$$eval(
    '.match button.mchip[data-side="L"]',
    (els, id) => els.find((e) => e.dataset.id === id).click(),
    idL,
  );
  await page.$$eval(
    '.match button.mchip[data-side="R"]',
    (els, id) => els.find((e) => e.dataset.id === id).click(),
    idR,
  );
  await sleep(500);
  const h1 = await page.$$eval('.l-top .hearts .ht.full', (els) => els.length);
  const shaken = await page.evaluate(() => document.querySelectorAll('.mchip.shake').length);
  console.log('wrong match: hearts', h0, '->', h1, '| shake applied then released (shake cls now):', shaken);
  // can we check with incomplete match?
  const checkDisabled = await page.$eval('button[data-act="check"]', (el) => el.disabled);
  console.log('check disabled while match incomplete:', checkDisabled);
}

// C) complete screen exits when there ARE misses and a next lesson
// restart lesson u1l1, answer one wrong deliberately, rest via first-option, land on complete
await jsClick('button[data-act="abandon"]');
await sleep(250);
await jsClick('button.node[data-id="u1l1"]');
await sleep(250);
while (await page.$('.prompt.teach')) {
  await jsClick('button[data-act="teach-next"]');
  await sleep(200);
}
let wronged = false;
for (let i = 0; i < 14; i++) {
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
      await sleep(50);
    }
  } else if (await page.$('.opts button.opt')) {
    const n = await page.$$eval('.opts button.opt', (els) => els.length);
    // wrong on purpose once: click LAST option unless already wronged
    const idx = !wronged && n > 1 ? n - 1 : 0;
    await page.$$eval('.opts button.opt', (els, i) => els[i].click(), idx);
  } else if (await page.$('.tf button.opt')) {
    const idx = !wronged ? 0 : 1;
    await page.$$eval('.tf button.opt', (els, i) => els[i].click(), idx);
  } else if (await page.$('.bank button.bank-chip')) {
    const n = await page.$$eval('.bank button.bank-chip', (els) => els.length);
    const idx = !wronged && n > 1 ? n - 1 : 0;
    await page.$$eval('.bank button.bank-chip', (els, i) => els[i].click(), idx);
  }
  await jsClick('button[data-act="check"]');
  await sleep(150);
  const wasWrong = !!(await page.$('.sheet.no'));
  if (wasWrong) wronged = true;
  await jsClick('button[data-act="cont"]');
  await sleep(200);
}
const exits = await page.evaluate(() => {
  if (!document.querySelector('.hero')) return 'not on hero';
  return [...document.querySelectorAll('.hero .btn')].map(
    (b) => b.textContent.trim() + ' [' + (b.dataset.act || '') + ']',
  );
});
console.log('complete-with-miss exits:', JSON.stringify(exits));
console.log(
  'mix chips shown:',
  await page.$$eval('.chips .chip', (els) => els.map((e) => e.textContent.trim())),
);

// D) practice bias: do practice prompts hit missed terms early?
const missed = await page.evaluate(
  () => JSON.parse(localStorage.getItem('hedge-or-pledge-v1')).missedTermIds,
);
console.log('missedTermIds before practice:', JSON.stringify(missed));
await jsClick('.hero .btn-ghost'); // practice those
await sleep(400);
const onPractice = await page.evaluate(() => !!document.querySelector('.lesson'));
console.log('practice-those landed in lesson:', onPractice);
await browser.close();
