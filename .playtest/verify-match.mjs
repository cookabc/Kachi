import { chromium } from 'playwright-core';
import path from 'node:path';
const HTML = 'file://' + path.resolve('..', 'Hedge-or-Pledge.html');
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
page.on('pageerror', e => console.log('PAGEERROR', e.message));
const sleep = ms => page.waitForTimeout(ms);
const jsClick = sel => page.evaluate(s => { const el = document.querySelector(s); if (el) el.click(); }, sel);
const KEY = [
  ['What does hedge mean', 'Insurance on a bet you already have.'],
  ['What does pledge mean', "Put an asset up so a lender can seize it if you don't pay."],
  ['Pledging stock means you sold it', 'false'],
  ['Buying a put is a', 'hedge'],
  ['need cash but', 'pledge'],
];
async function answerCurrent() {
  const blob = await page.evaluate(() => ((document.querySelector('.story')||{}).textContent||'') + ' ' + ((document.querySelector('.stem')||{}).textContent||''));
  const hit = KEY.find(([k]) => blob.includes(k));
  if (await page.$('.tf button.opt')) {
    await page.$$eval('.tf button.opt', (els, i) => els[i].click(), hit && hit[1]==='false' ? 1 : 0);
  } else if (await page.$('.bank button.bank-chip')) {
    const chips = await page.$$eval('.bank button.bank-chip', els => els.map(e => e.dataset.val));
    await page.$$eval('.bank button.bank-chip', (els, i) => els[i].click(), hit ? chips.indexOf(hit[1]) : 0);
  } else {
    const texts = await page.$$eval('.opts button.opt', els => els.map(e => e.dataset.val));
    await page.$$eval('.opts button.opt', (els, i) => els[i].click(), hit ? texts.indexOf(hit[1]) : 0);
  }
  await jsClick('button[data-act="check"]'); await sleep(150);
  await jsClick('button[data-act="cont"]'); await sleep(200);
}
await page.goto(HTML);
await sleep(400);
await page.evaluate(() => localStorage.clear());
await page.reload(); await sleep(400);
await page.evaluate(() => document.querySelector('button.node[data-id="u1l1"]').click());
await sleep(250);
while (await page.$('.prompt.teach')) { await jsClick('button[data-act="teach-next"]'); await sleep(200); }
// answer first 5 prompts correctly to reach the match prompt (index 5)
for (let i = 0; i < 5; i++) await answerCurrent();
console.log('on match prompt:', !!(await page.$('.match')));

// --- case 1: all pairs correct ---
for (let k = 0; k < 8; k++) {
  const L = await page.$('.match button.mchip[data-side="L"][data-act="m"]');
  if (!L) break;
  const id = await L.getAttribute('data-id');
  await L.click();
  await page.$$eval('.match button.mchip[data-side="R"]', (els, id) => { const el = els.find(e=>e.dataset.id===id); if (el) el.click(); }, id);
  await sleep(50);
}
await sleep(300);
const state1 = await page.evaluate(() => ({
  locked: document.querySelectorAll('.mchip.good').length,
  checkDisabled: document.querySelector('button[data-act="check"]') ? document.querySelector('button[data-act="check"]').disabled : 'no-check-btn',
  sheet: !!document.querySelector('.sheet'),
}));
console.log('after ALL-CORRECT match:', JSON.stringify(state1));
// try pressing check / enter
await jsClick('button[data-act="check"]');
await page.keyboard.press('Enter'); await sleep(200);
const state2 = await page.evaluate(() => ({ sheet: !!document.querySelector('.sheet'), stillMatch: !!document.querySelector('.match') }));
console.log('after check attempt:', JSON.stringify(state2));
await page.screenshot({ path: 'shots/v-match-allcorrect.png' });

if (!state2.sheet) {
  console.log('>>> CONFIRMED: all-correct match is soft-locked (no feedback, no way forward)');
} else {
  await jsClick('button[data-act="cont"]'); await sleep(200);
}

// --- case 2 (same lesson if we advanced, else bail): wrong pair docks a heart ---
// restart lesson fresh to test miss path cleanly
await page.evaluate(() => { localStorage.clear(); location.reload(); });
await sleep(400);
await page.evaluate(() => document.querySelector('button.node[data-id="u1l1"]').click());
await sleep(250);
while (await page.$('.prompt.teach')) { await jsClick('button[data-act="teach-next"]'); await sleep(200); }
for (let i = 0; i < 5; i++) await answerCurrent();
const h0 = await page.$$eval('.l-top .hearts .ht.full', els => els.length);
// deliberate mispair
const [idL, idR] = await page.evaluate(() => {
  const L = [...document.querySelectorAll('.match button.mchip[data-side="L"][data-act="m"]')];
  const R = [...document.querySelectorAll('.match button.mchip[data-side="R"][data-act="m"]')];
  const l = L[0].dataset.id;
  return [l, R.find(x => x.dataset.id !== l).dataset.id];
});
await page.$$eval('.match button.mchip[data-side="L"]', (els, id) => els.find(e=>e.dataset.id===id).click(), idL);
await page.$$eval('.match button.mchip[data-side="R"]', (els, id) => els.find(e=>e.dataset.id===id).click(), idR);
await sleep(400);
const miss = await page.evaluate(() => ({
  hearts: document.querySelectorAll('.l-top .hearts .ht.full').length,
  sheet: !!document.querySelector('.sheet.no'),
  sheetText: (document.querySelector('.sheet p')||{}).textContent || '',
}));
console.log(`mispair: hearts ${h0} -> ${miss.hearts}, feedback sheet: ${miss.sheet}, why: "${miss.sheetText.slice(0,80)}"`);
await page.screenshot({ path: 'shots/v-match-miss.png' });
// continue -> requeued same match prompt?
await jsClick('button[data-act="cont"]'); await sleep(300);
const requeued = await page.evaluate(() => !!document.querySelector('.match') && document.querySelectorAll('.mchip.good').length === 0);
console.log('requeued fresh match (no pairs carried over):', requeued);
// now complete the requeued match correctly — does it judge?
for (let k = 0; k < 8; k++) {
  const L = await page.$('.match button.mchip[data-side="L"][data-act="m"]');
  if (!L) break;
  const id = await L.getAttribute('data-id');
  await L.click();
  await page.$$eval('.match button.mchip[data-side="R"]', (els, id) => { const el = els.find(e=>e.dataset.id===id); if (el) el.click(); }, id);
  await sleep(50);
}
await sleep(300);
console.log('after correct requeued match: sheet =', !!(await page.$('.sheet')), ', check disabled =', await page.evaluate(() => { const b = document.querySelector('button[data-act="check"]'); return b ? b.disabled : 'none'; }));
await browser.close();
