import { chromium } from 'playwright-core';
import path from 'node:path';
const HTML = 'file://' + path.resolve('..', 'Hedge-or-Pledge.html');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const sleep = ms => page.waitForTimeout(ms);
const jsClick = sel => page.evaluate(s => { const el = document.querySelector(s); if (el) el.click(); }, sel);

// correct answers for u1l1, keyed by a substring of stem/story
const KEY = [
  ['What does hedge mean', 'Insurance on a bet you already have.'],
  ['What does pledge mean', "Put an asset up so a lender can seize it if you don't pay."],
  ['Pledging stock means you sold it', 'false'],
  ['Buying a put is a', 'hedge'],
  ['need cash but', 'pledge'],
  ['contract that pays if they crash', 'Hedge'],
  ['bank lends you cash', 'Pledge'],
  ['same as pledging your shares', 'false'],
  ['want cash without selling', 'Pledge it as collateral for a loan.'],
];

async function answerCurrent(wrongThisOne) {
  if (await page.$('.match')) {
    for (let k = 0; k < 8; k++) {
      const L = await page.$('.match button.mchip[data-side="L"][data-act="m"]');
      if (!L) break;
      const id = await L.getAttribute('data-id');
      await L.click();
      await page.$$eval('.match button.mchip[data-side="R"]', (els, id) => { const el = els.find(e=>e.dataset.id===id); if (el) el.click(); }, id);
      await sleep(40);
    }
    return 'match';
  }
  const blob = await page.evaluate(() => ((document.querySelector('.story')||{}).textContent||'') + ' ' + ((document.querySelector('.stem')||{}).textContent||''));
  const hit = KEY.find(([k]) => blob.includes(k));
  if (await page.$('.tf button.opt')) {
    const wantTrue = hit && hit[1] === 'true';
    const idx = wrongThisOne ? (wantTrue ? 1 : 0) : (wantTrue ? 0 : 1);
    await page.$$eval('.tf button.opt', (els, i) => els[i].click(), idx);
    return 'tf';
  }
  if (await page.$('.bank button.bank-chip')) {
    const chips = await page.$$eval('.bank button.bank-chip', els => els.map(e => e.dataset.val));
    let idx = hit ? chips.indexOf(hit[1]) : 0;
    if (wrongThisOne || idx < 0) idx = (idx + 1) % chips.length;
    await page.$$eval('.bank button.bank-chip', (els, i) => els[i].click(), idx);
    return 'fill';
  }
  const texts = await page.$$eval('.opts button.opt', els => els.map(e => e.dataset.val));
  let idx = hit ? texts.indexOf(hit[1]) : 0;
  if (wrongThisOne || idx < 0) idx = (idx + 1) % texts.length;
  await page.$$eval('.opts button.opt', (els, i) => els[i].click(), idx);
  return 'opts';
}
async function startU1L1() {
  await page.evaluate(() => { const el = document.querySelector('button.node[data-id="u1l1"]'); if (el) el.click(); });
  await sleep(250);
  while (await page.$('.prompt.teach')) { await jsClick('button[data-act="teach-next"]'); await sleep(200); }
}

await page.goto(HTML);
await sleep(400);

// B) reach match correctly, then wrong-pair once: heart cost?
await startU1L1();
for (let i = 0; i < 5; i++) {
  await answerCurrent(false);
  await jsClick('button[data-act="check"]'); await sleep(150);
  await jsClick('button[data-act="cont"]'); await sleep(200);
}
console.log('on match prompt:', !!(await page.$('.match')));
const h0 = await page.$$eval('.l-top .hearts .ht.full', els => els.length);
const [idL, idR] = await page.evaluate(() => {
  const L = [...document.querySelectorAll('.match button.mchip[data-side="L"][data-act="m"]')];
  const R = [...document.querySelectorAll('.match button.mchip[data-side="R"][data-act="m"]')];
  const l = L[0].dataset.id;
  return [l, R.find(x => x.dataset.id !== l).dataset.id];
});
await page.$$eval('.match button.mchip[data-side="L"]', (els, id) => els.find(e=>e.dataset.id===id).click(), idL);
await page.$$eval('.match button.mchip[data-side="R"]', (els, id) => els.find(e=>e.dataset.id===id).click(), idR);
await sleep(120);
const shakeDuring = await page.$$eval('.mchip.shake', els => els.length);
await sleep(400);
const h1 = await page.$$eval('.l-top .hearts .ht.full', els => els.length);
const shakeAfter = await page.$$eval('.mchip.shake', els => els.length);
console.log(`wrong match pair: hearts ${h0}->${h1}, shake during=${shakeDuring}, after=${shakeAfter}, check disabled=${await page.$eval('button[data-act="check"]', el => el.disabled)}`);
// fill-blank live fill check happened implicitly above (fill prompts passed)

// C) finish lesson with exactly ONE wrong answer (2nd prompt)
await answerCurrent(false); // the match, correctly now
await jsClick('button[data-act="check"]'); await sleep(150);
await jsClick('button[data-act="cont"]'); await sleep(200);
for (let i = 6; i < 10; i++) {
  const wrong = (i === 7);
  await answerCurrent(wrong);
  await jsClick('button[data-act="check"]'); await sleep(150);
  await jsClick('button[data-act="cont"]'); await sleep(200);
}
await sleep(800);
console.log('on complete:', await page.$eval('.hero h1', el => el.textContent).catch(() => 'NO HERO'));
console.log('complete-with-1-miss exits:', await page.$$eval('.hero .btn', els => els.map(b => b.textContent.trim() + ' [' + b.dataset.act + ']')));
console.log('mix chips:', await page.$$eval('.chips .chip', els => els.map(e => e.textContent.trim())));
console.log('acc line:', await page.$eval('.hero .sub', el => el.textContent.trim()));
await page.screenshot({ path: 'shots/15-complete-with-miss.png' });

// D) "Practice those" → lands in practice lesson, biased to the missed term?
await jsClick('.hero .btn-ghost');
await sleep(400);
console.log('practice-those landed in lesson:', !!(await page.$('.lesson')));
console.log('practice first prompt kicker/stem:', await page.evaluate(() => ((document.querySelector('.kicker2')||{}).textContent||'') + ' / ' + ((document.querySelector('.stem')||{}).textContent||'').slice(0,60)));
await page.screenshot({ path: 'shots/16-practice-those.png' });
await browser.close();
