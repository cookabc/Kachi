import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';

const HTML = 'file://' + path.resolve('..', 'Hedge-or-Pledge.html');
const SHOTS = path.resolve('shots');
fs.mkdirSync(SHOTS, { recursive: true });

const log = { errors: [], notes: [], xp: {}, screens: [] };
function note(k, v) { log.notes.push(`${k}: ${v}`); }

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', m => { if (m.type() === 'error') log.errors.push('console: ' + m.text()); });
page.on('pageerror', e => log.errors.push('pageerror: ' + e.message));

async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
  log.screens.push(name);
}
const sleep = ms => page.waitForTimeout(ms);
// JS click that bypasses stability checks (the "next" node bobs forever)
const jsClick = sel => page.evaluate(s => { const el = document.querySelector(s); if (!el) throw new Error('no el ' + s); el.click(); }, sel);
// navigate back to the learn screen from anywhere (complete screens may lack a path exit)
async function goLearn() {
  for (let i = 0; i < 4; i++) {
    if (await page.$('.path')) return;
    const tabBtn = await page.$('button[data-act="tab"][data-tab="learn"]');
    if (tabBtn) { await tabBtn.click(); await sleep(250); continue; }
    const heroBtn = await page.$('.hero .btn');
    if (heroBtn) { await heroBtn.click(); await sleep(250); }
    const ab = await page.$('button[data-act="abandon"]');
    if (ab) { await ab.click(); await sleep(250); }
  }
}

// ---------- helpers to read game state from DOM ----------
async function screenKind() {
  return await page.evaluate(() => {
    if (document.querySelector('.sheet')) return 'feedback';
    if (document.querySelector('.prompt.teach')) return 'teach';
    if (document.querySelector('.hero h1')) return 'hero:' + document.querySelector('.hero h1').textContent.trim();
    if (document.querySelector('#g-q')) return 'glossary';
    if (document.querySelector('.prac-hero')) return 'practice-home';
    if (document.querySelector('.opts')) return 'quiz-opts';
    if (document.querySelector('.tf')) return 'quiz-tf';
    if (document.querySelector('.bank')) return 'quiz-fill';
    if (document.querySelector('.match')) return 'quiz-match';
    if (document.querySelector('.path')) return 'learn';
    return 'unknown';
  });
}
async function hearts() {
  return await page.evaluate(() => document.querySelectorAll('.l-top .hearts .ht.full').length);
}

// answer one quiz prompt. mode: 'known' uses answer map, 'first' clicks first choice.
const KNOWN = {
  'What does hedge mean?': 'Insurance on a bet you already have.',
  'What does pledge mean here?': 'Put an asset up so a lender can seize it if you don\'t pay.',
  'Pledging stock means you sold it.': 'false',
  'What did you do?': null, // scenario: decide by story text
  'A hedge is the same as pledging your shares for a loan.': 'false',
  'You own stock. You want cash without selling. You would:': 'Pledge it as collateral for a loan.',
};

async function answerPrompt(mode) {
  const kind = await screenKind();
  const h0 = await hearts();
  if (kind === 'quiz-opts' || kind === 'quiz-tf') {
    const sel = kind === 'quiz-opts' ? '.opts button.opt' : '.tf button.opt';
    const texts = await page.$$eval(sel, els => els.map(e => e.dataset.val));
    let pick = texts[0];
    if (mode === 'known') {
      const stem = await page.evaluate(() => (document.querySelector('.stem') || {}).textContent || '');
      const story = await page.evaluate(() => (document.querySelector('.story') || {}).textContent || '');
      const blob = story + ' ' + stem;
      let want = KNOWN[stem.trim()];
      if (blob.includes('bank lends you cash')) want = 'Pledge';
      else if (blob.includes('contract that pays if they crash')) want = 'Hedge';
      if (want != null) {
        const found = texts.find(t => t === want);
        if (found) pick = found;
      }
    }
    const idx = texts.indexOf(pick);
    await page.$$eval(sel, (els, i) => els[i].click(), idx);
  } else if (kind === 'quiz-fill') {
    const chips = await page.$$eval('.bank button.bank-chip', els => els.map(e => e.dataset.val));
    let pick = chips[0];
    if (mode === 'known') {
      const story = await page.evaluate(() => (document.querySelector('.story') || {}).textContent || '');
      if (story.includes('Buying a put')) pick = 'hedge';
      else if (story.includes('need cash')) pick = 'pledge';
      if (!chips.includes(pick)) pick = chips[0];
    }
    const cidx = chips.indexOf(pick);
    await page.$$eval('.bank button.bank-chip', (els, i) => els[i].click(), cidx);
  } else if (kind === 'quiz-match') {
    // pair them correctly by id
    for (let k = 0; k < 8; k++) {
      const lefts = await page.$$('.match button.mchip[data-side="L"][data-act="m"]');
      if (!lefts.length) break;
      const id = await lefts[0].getAttribute('data-id');
      await lefts[0].click();
      await page.$$eval('.match button.mchip[data-side="R"]', (els, id) => {
        const el = els.find(e => e.dataset.id === id);
        if (el) el.click();
      }, id);
      await sleep(60);
    }
  } else {
    throw new Error('not a quiz screen: ' + kind);
  }
  await page.click('button[data-act="check"]');
  await sleep(150);
  const ok = await page.evaluate(() => !!document.querySelector('.sheet.ok'));
  const h1 = await hearts();
  return { kind, ok, heartsBefore: h0, heartsAfter: h1 };
}

// ---------- 1. load & learn screen ----------
await page.goto(HTML);
await sleep(600);
await shot('01-learn-fresh');
note('learn nodes', await page.$$eval('button.node', els => els.length));
note('locked nodes', await page.$$eval('button.node.locked', els => els.length));
note('next node', await page.$eval('button.node.next', el => el.getAttribute('aria-label')));

// ---------- 2. play u1l1 with mostly-correct answers ----------
await jsClick('button.node[data-id="u1l1"]');
await sleep(400);
await shot('02-teach');
let guard = 0;
while ((await screenKind()) === 'teach' && guard++ < 10) {
  await page.click('button[data-act="teach-next"]');
  await sleep(250);
}
note('teach cards clicked', guard - 1);
await shot('03-quiz-first-prompt');
let firstFeedbackShot = false, wrongFeedbackShot = false;
const run1 = [];
for (let i = 0; i < 15; i++) {
  const k = await screenKind();
  if (k.startsWith('hero:')) break;
  const r = await answerPrompt('known');
  run1.push(`${r.kind}:${r.ok ? 'ok' : 'MISS'}(${r.heartsBefore}->${r.heartsAfter})`);
  if (!firstFeedbackShot) { await shot('04-feedback-' + (r.ok ? 'ok' : 'miss')); firstFeedbackShot = true; }
  if (!r.ok && !wrongFeedbackShot) { await shot('04b-feedback-miss'); wrongFeedbackShot = true; }
  await page.click('button[data-act="cont"]');
  await sleep(250);
}
note('u1l1 run', run1.join(' '));
await sleep(900);
await shot('05-complete');
note('complete screen', await screenKind());
log.xp.afterU1L1 = await page.evaluate(() => JSON.parse(localStorage.getItem('hedge-or-pledge-v1')).xp);

// ---------- 3. back to path, verify unlock ----------
await goLearn();
note('done nodes', await page.$$eval('button.node.done', els => els.length));
note('next node now', await page.$eval('button.node.next', el => el.getAttribute('aria-label')));
await shot('06-learn-after-u1l1');

// ---------- 4. reload persistence ----------
await page.reload(); await sleep(500);
log.xp.afterReload = await page.evaluate(() => JSON.parse(localStorage.getItem('hedge-or-pledge-v1')).xp);
note('persist across reload', log.xp.afterU1L1 === log.xp.afterReload);

// ---------- 5. fail flow: play u1l2 answering first option (mostly wrong) ----------
let failOk = false;
for (let attempt = 0; attempt < 3 && !failOk; attempt++) {
  await jsClick('button.node[data-id="u1l2"]');
  await sleep(300);
  guard = 0;
  while ((await screenKind()) === 'teach' && guard++ < 10) {
    await page.click('button[data-act="teach-next"]'); await sleep(200);
  }
  const run2 = [];
  for (let i = 0; i < 15; i++) {
    const k = await screenKind();
    if (k.startsWith('hero:')) { note('u1l2 end screen', k); break; }
    const r = await answerPrompt('first');
    run2.push(`${r.kind.replace('quiz-', '')}:${r.ok ? 'ok' : 'MISS'}(♥${r.heartsAfter})`);
    await page.click('button[data-act="cont"]');
    await sleep(250);
  }
  note('u1l2 attempt ' + (attempt + 1), run2.join(' '));
  const k = await screenKind();
  if (k.includes('Out of hearts')) {
    failOk = true;
    await shot('07-fail');
    // retry refills hearts
    await page.click('button[data-act="start"]');
    await sleep(300);
    guard = 0;
    while ((await screenKind()) === 'teach' && guard++ < 10) {
      await page.click('button[data-act="teach-next"]'); await sleep(200);
    }
    note('hearts after retry', await hearts());
    await page.click('button[data-act="abandon"]'); await sleep(300);
  } else {
    note('u1l2 attempt ended without fail', k);
    await goLearn();
  }
}
note('fail flow reached', failOk);

// ---------- 6. practice ----------
await page.click('nav.nav button[data-tab="practice"]');
await sleep(300);
await shot('08-practice-home');
note('practice miss line', await page.$eval('.prac-hero .sub', el => el.textContent.trim()));
await page.click('button[data-act="practice"]');
await sleep(400);
await shot('09-practice-prompt');
// answer two prompts then quit via ×
for (let i = 0; i < 2; i++) {
  const k = await screenKind();
  if (k.startsWith('hero:')) break;
  await answerPrompt('first');
  await page.click('button[data-act="cont"]');
  await sleep(250);
}
await page.click('button[data-act="abandon"]');
await sleep(300);
note('after abandon', await screenKind());

// ---------- 7. glossary ----------
await page.click('nav.nav button[data-tab="glossary"]');
await sleep(300);
await shot('10-glossary');
note('glossary cards', await page.$$eval('.g-card', els => els.length));
note('seen checkmarks', await page.$$eval('.g-card .seen', els => els.length));
await page.fill('#g-q', 'put');
await sleep(200);
await shot('11-glossary-search-put');
note('cards for "put"', await page.$$eval('.g-card', els => els.map(e => e.querySelector('h3').textContent.trim()).join(', ')));

// ---------- 8. keyboard flow ----------
await page.click('nav.nav button[data-tab="learn"]');
await sleep(200);
await page.evaluate(() => { const el = document.querySelector('button.node[data-id="u1l3"]'); if (el) el.click(); });
await sleep(300);
const canStartU1L3 = (await screenKind()).startsWith('teach') || (await screenKind()).startsWith('quiz');
note('u1l3 startable (u1l2 completed during fail attempts?)', canStartU1L3);
if (!canStartU1L3) {
  // complete u1l2 properly to unlock u1l3
  await jsClick('button.node[data-id="u1l2"]');
  await sleep(300);
  guard = 0;
  while ((await screenKind()) === 'teach' && guard++ < 10) { await page.click('button[data-act="teach-next"]'); await sleep(200); }
  for (let i = 0; i < 15; i++) {
    const k = await screenKind();
    if (k.startsWith('hero:')) break;
    // keyboard: press 1 then Enter
    const kind = await screenKind();
    if (kind === 'quiz-match') { await answerPrompt('first'); await page.click('button[data-act="cont"]'); await sleep(200); continue; }
    await page.keyboard.press('1');
    await sleep(100);
    await page.keyboard.press('Enter');
    await sleep(150);
    await page.keyboard.press('Enter');
    await sleep(200);
  }
  note('u1l2 keyboard-run end', await screenKind());
  await goLearn();
}
log.xp.final = await page.evaluate(() => JSON.parse(localStorage.getItem('hedge-or-pledge-v1')).xp);
note('streak', await page.evaluate(() => JSON.parse(localStorage.getItem('hedge-or-pledge-v1')).streak));
note('missedTermIds', await page.evaluate(() => JSON.parse(localStorage.getItem('hedge-or-pledge-v1')).missedTermIds.join(',')));
await shot('12-learn-final');

// ---------- 9. desktop viewport ----------
const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 900 } });
const page2 = await ctx2.newPage();
await page2.goto(HTML);
await sleep(600);
await page2.screenshot({ path: path.join(SHOTS, '13-desktop.png') });
log.screens.push('13-desktop');
// short screen stress
const ctx3 = await browser.newContext({ viewport: { width: 390, height: 640 } });
const page3 = await ctx3.newPage();
await page3.goto(HTML + '?shot=lesson');
await sleep(600);
await page3.screenshot({ path: path.join(SHOTS, '14-short-viewport-quiz.png') });
log.screens.push('14-short-viewport-quiz');

console.log(JSON.stringify(log, null, 2));
await browser.close();
