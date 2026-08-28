import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const BASE = 'http://localhost:5199/';
const SHOTS = path.resolve(HERE, 'shots-new');
fs.mkdirSync(SHOTS, { recursive: true });

const course = JSON.parse(fs.readFileSync(path.join(REPO, 'content/packs/hedge-or-pledge/zh-CN/course.json'), 'utf8'));
const lesson = course.lessons.find((l) => l.id === 'u1l1');
const conceptById = (id) => course.concepts.find((c) => c.id === id);

const log = { errors: [], notes: [], xp: [], hearts: [] };
const note = (k, v) => log.notes.push(`${k}: ${v}`);

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') log.errors.push('console: ' + m.text()); });
page.on('pageerror', (e) => log.errors.push('pageerror: ' + e.message));

async function shot(name) { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); }
const sleep = (ms) => page.waitForTimeout(ms);
// JS click that bypasses actionability checks (the "next" node bobs forever)
const jsClick = (sel) => page.evaluate((s) => { const el = document.querySelector(s); if (!el) throw new Error('no el: ' + s); el.click(); }, sel);
const jsClickText = (sel, text) => page.evaluate(([s, t]) => {
  const el = Array.from(document.querySelectorAll(s)).find((n) => n.textContent.trim() === t);
  if (!el) throw new Error(`no ${s} with text ${t}`);
  el.click();
}, [sel, text]);

async function readXp() { return page.$eval('.stat.xp', (el) => el.textContent.trim()).catch(() => 'n/a'); }
async function fullHearts() {
  return page.evaluate(() => document.querySelectorAll('.hearts .ht.full').length).catch(() => -1);
}

await page.goto(BASE);
await page.waitForSelector('.path', { timeout: 10000 });
await shot('01-learn-home');
log.xp.push(['home', await readXp()]);

// open u1l1 through the bobbing node
await jsClick(`button.node.next`);
await page.waitForSelector('.prompt.teach');
note('teach kicker', await page.$eval('.kicker2', (el) => el.textContent.trim()));
await shot('02-teach-card');
let teachClicks = 0;
while (await page.$('.prompt.teach') && teachClicks < 8) {
  const btn = await page.$('.foot .btn');
  const label = await btn.evaluate((el) => el.textContent.trim());
  await btn.click();
  teachClicks += 1;
  if (label === '开始练习') break;
  await sleep(250);
}
note('teach cards walked', String(teachClicks));
await page.waitForSelector('.prompt:not(.teach)');
await shot('03-quiz-first');
note('first kicker', await page.$eval('.kicker2', (el) => el.textContent.trim()));
note('hearts at quiz start', String(await fullHearts()));

// walk the quiz. Plan: mispair the first match once; answer the first meaning/scenario wrong once.
let mispaired = false, answeredWrong = false, promptsSeen = 0, requeuedMatch = false, prompts = [];
while (!(await page.$('.hero')) && promptsSeen < 20) {
  await page.waitForSelector('.prompt:not(.teach)');
  const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
  const sheet = await page.$('.sheet');
  if (sheet) {
    // feedback for the previous answer
    const ok = await sheet.evaluate((el) => el.classList.contains('ok'));
    const full = await fullHearts();
    log.hearts.push([kicker, ok ? 'correct' : 'wrong', full]);
    prompts.push(`${kicker}:${ok ? '✓' : '✗'}`);
    await page.click('.sheet .btn');
    await sleep(250);
    continue;
  }
  promptsSeen += 1;
  const type = Object.entries({ 词义辨析: 'meaning', 判断正误: 'truefalse', 补全句子: 'fill', 真实情境: 'scenario', 配对练习: 'match' }).find(([k]) => k === kicker)?.[1];
  if (!type) throw new Error('unknown kicker: ' + kicker);
  if (type === 'match' && !mispaired) {
    // deliberate mispair: first left chip against a right chip from another pair
    mispaired = true;
    const pairTexts = await page.evaluate(() => {
      const left = Array.from(document.querySelectorAll('.match > div:nth-child(1) .mchip')).filter((c) => !c.disabled);
      const right = Array.from(document.querySelectorAll('.match > div:nth-child(2) .mchip')).filter((c) => !c.disabled);
      return { left: left[0] && left[0].textContent.trim(), right: right[right.length - 1] && right[right.length - 1].textContent.trim() };
    });
    await jsClickText('.match > div:nth-child(1) .mchip', pairTexts.left);
    await jsClickText('.match > div:nth-child(2) .mchip', pairTexts.right);
    await page.waitForSelector('.sheet.no');
    note('mispair judged live', 'sheet.no + heart docked: ' + (await fullHearts()));
    await shot('04-match-mispair');
    await page.click('.sheet .btn');
    await sleep(250);
    requeuedMatch = true;
    continue;
  }
  if ((type === 'meaning' || type === 'scenario') && !answeredWrong) {
    answeredWrong = true;
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = lesson.prompts.find((p) => p.type === type && p.stem === stem);
    if (!published) throw new Error('unknown stem for deliberate wrong: ' + stem);
    const wrong = published.options.find((o) => o.text !== published.options[published.answer].text);
    note('deliberate wrong pick', wrong.text.slice(0, 40));
    await jsClickText('.opts .opt.tile', wrong.text);
    await page.click('.foot .btn');
    await page.waitForSelector('.sheet.no');
    await shot('05-feedback-wrong');
    await sleep(150);
    continue;
  }
  if (type === 'match') {
    // finish the pairs using published pair texts (shuffled columns are copies of them)
    const pairs = lesson.prompts.filter((p) => p.type === 'match').flatMap((p) => p.pairs);
    for (;;) {
      const remaining = await page.evaluate(() => ({
        left: Array.from(document.querySelectorAll('.match > div:nth-child(1) .mchip')).filter((c) => !c.disabled).map((c) => c.textContent.trim()),
        right: Array.from(document.querySelectorAll('.match > div:nth-child(2) .mchip')).filter((c) => !c.disabled).map((c) => c.textContent.trim())
      }));
      if (!remaining.left.length || !remaining.right.length) break;
      const pair = pairs.find((p) => remaining.left.includes(p.left) && remaining.right.includes(p.right));
      if (!pair) throw new Error('no visible pair for ' + JSON.stringify(remaining));
      await jsClickText('.match > div:nth-child(1) .mchip', pair.left);
      await jsClickText('.match > div:nth-child(2) .mchip', pair.right);
      await sleep(120);
      if (await page.$('.sheet')) break; // last pair judged live
    }
    await sleep(150);
    continue;
  }
  // knowledge prompts: answer correctly from published data
  if (type === 'truefalse') {
    // identify prompt by stem among published prompts
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = lesson.prompts.find((p) => p.type === 'truefalse' && p.stem === stem);
    if (!published) throw new Error('unknown truefalse: ' + stem);
    await jsClickText('.tf .opt.tile .cap', published.answer ? 'True' : 'False');
  } else if (type === 'fill') {
    // the story identifies the prompt (stem is hidden for fill)
    const story = await page.$eval('.story', (el) => el.textContent.trim());
    const published = lesson.prompts.find((p) => p.type === 'fill' && p.story && story.startsWith(p.story.split('____')[0].slice(0, 24)));
    if (!published) throw new Error('unknown fill: ' + story.slice(0, 40));
    await jsClickText('.bank .bank-chip', published.answer);
  } else {
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = lesson.prompts.find((p) => p.type === type && p.stem === stem);
    if (!published) throw new Error(`unknown ${type}: ` + stem);
    await jsClickText('.opts .opt.tile', published.options[published.answer].text);
  }
  await sleep(120);
  await page.click('.foot .btn');
  await sleep(200);
}

await page.waitForSelector('.hero');
await shot('06-complete');
note('complete h1', await page.$eval('.hero h1', (el) => el.textContent.trim()));
note('complete sub', await page.$eval('.hero .sub', (el) => el.textContent.trim()));
note('xp rows', await page.$$eval('.xp-row', (rows) => rows.map((r) => r.textContent.trim()).join(' | ')));
note('mix chips', await page.$$eval('.chip', (chips) => chips.map((c) => c.textContent.trim()).join(', ')));
log.xp.push(['after u1l1 (8✓ 1✗ 1 re-run✓ = 10 answers)', await readXp()]);

// back to the path: node 1 done, node 2 unlocked
await page.click('.hero .btn-ghost');
await page.waitForSelector('.path');
const nodeStates = await page.evaluate(() => Array.from(document.querySelectorAll('.node')).slice(0, 4).map((n) => n.className.replace('node', '').trim() || 'plain'));
note('first 4 node states', JSON.stringify(nodeStates));
await shot('07-path-after-lesson');

// keyboard: Enter should press the focused path? Instead verify in next lesson (teach continue)
// Practice round: pool = u1l1 + u1l2 (seed), focus = missed terms
await page.click('.nav button:nth-child(2)');
await page.waitForSelector('.prac-hero');
await shot('08-practice-home');
note('practice copy', await page.$eval('.prac-hero .sub', (el) => el.textContent.trim()));
await page.click('.prac-hero .btn');
await page.waitForSelector('.prompt:not(.teach)');

let practiceAnswers = 0;
while (!(await page.$('.hero')) && practiceAnswers < 30) {
  const sheet = await page.$('.sheet');
  if (sheet) {
    const ok = await sheet.evaluate((el) => el.classList.contains('ok'));
    log.hearts.push(['practice', ok ? 'correct' : 'wrong', await fullHearts()]);
    await page.click('.sheet .btn');
    await sleep(200);
    continue;
  }
  const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
  const type = { 词义辨析: 'meaning', 判断正误: 'truefalse', 补全句子: 'fill', 真实情境: 'scenario', 配对练习: 'match' }[kicker];
  if (!type) throw new Error('practice unknown kicker: ' + kicker);
  practiceAnswers += 1;
  if (type === 'match') {
    const pairs = course.lessons.flatMap((l) => l.prompts).filter((p) => p.type === 'match').flatMap((p) => p.pairs);
    let done = 0;
    while (done < 4) {
      const remaining = await page.evaluate(() => ({
        left: Array.from(document.querySelectorAll('.match > div:nth-child(1) .mchip')).filter((c) => !c.disabled).map((c) => c.textContent.trim()),
        right: Array.from(document.querySelectorAll('.match > div:nth-child(2) .mchip')).filter((c) => !c.disabled).map((c) => c.textContent.trim())
      }));
      const pair = pairs.find((p) => remaining.left.includes(p.left) && remaining.right.includes(p.right));
      if (!pair) break;
      await jsClickText('.match > div:nth-child(1) .mchip', pair.left);
      await jsClickText('.match > div:nth-child(2) .mchip', pair.right);
      done += 1;
      await sleep(120);
      if (await page.$('.sheet')) break;
    }
    await sleep(150);
    continue;
  }
  if (type === 'truefalse') {
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = course.lessons.filter((l) => l.id === 'u1l1' || l.id === 'u1l2').flatMap((l) => l.prompts).find((p) => p.type === 'truefalse' && p.stem === stem);
    if (!published) throw new Error('practice unknown truefalse');
    await jsClickText('.tf .opt.tile .cap', published.answer ? 'True' : 'False');
  } else if (type === 'fill') {
    const story = await page.$eval('.story', (el) => el.textContent.trim());
    const published = course.lessons.filter((l) => l.id === 'u1l1' || l.id === 'u1l2').flatMap((l) => l.prompts).find((p) => p.type === 'fill' && p.story && story.startsWith(p.story.split('____')[0].slice(0, 24)));
    if (!published) throw new Error('practice unknown fill');
    await jsClickText('.bank .bank-chip', published.answer);
  } else {
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = course.lessons.filter((l) => l.id === 'u1l1' || l.id === 'u1l2').flatMap((l) => l.prompts).find((p) => p.type === type && p.stem === stem);
    if (!published) throw new Error('practice unknown stem: ' + stem);
    await jsClickText('.opts .opt.tile', published.options[published.answer].text);
  }
  await sleep(120);
  await page.click('.foot .btn');
  await sleep(200);
}
await page.waitForSelector('.hero');
await shot('09-practice-complete');
note('practice h1', await page.$eval('.hero h1', (el) => el.textContent.trim()));
note('practice xp rows', await page.$$eval('.xp-row', (rows) => rows.map((r) => r.textContent.trim()).join(' | ')));
log.xp.push(['after practice round (all correct)', await readXp()]);

// Glossary search updates only the list
await page.click('.hero .btn-ghost'); // 回到路径
await page.waitForSelector('.path');
await page.click('.nav button:nth-child(3)');
await page.waitForSelector('.g-search input');
const totalCards = await page.$$eval('.g-card', (cards) => cards.length);
await page.fill('.g-search input', 'put');
await sleep(200);
const filtered = await page.$$eval('.g-card', (cards) => cards.map((c) => c.querySelector('h3').textContent.trim()));
note(`glossary cards total=${totalCards} filtered=put`, JSON.stringify(filtered));
await shot('10-glossary-search');

// Fail flow: drain 5 hearts in a practice round, retry refills
await page.click('.nav button:nth-child(2)');
await page.waitForSelector('.prac-hero .btn');
await page.click('.prac-hero .btn');
await page.waitForSelector('.prompt:not(.teach)');
let wrongs = 0;
while (!(await page.$('.hero')) && wrongs < 12) {
  const sheet = await page.$('.sheet');
  if (sheet) {
    await page.click('.sheet .btn');
    await sleep(200);
    continue;
  }
  const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
  const type = { 词义辨析: 'meaning', 判断正误: 'truefalse', 补全句子: 'fill', 真实情境: 'scenario', 配对练习: 'match' }[kicker];
  if (type === 'match') {
    // guaranteed mispair: click a left chip and a right chip that is not its partner
    const rem = await page.evaluate(() => ({
      left: Array.from(document.querySelectorAll('.match > div:nth-child(1) .mchip')).filter((c) => !c.disabled).map((c) => c.textContent.trim()),
      right: Array.from(document.querySelectorAll('.match > div:nth-child(2) .mchip')).filter((c) => !c.disabled).map((c) => c.textContent.trim())
    }));
    const allPairs = course.lessons.flatMap((l) => l.prompts).filter((p) => p.type === 'match').flatMap((p) => p.pairs);
    const relevant = allPairs.filter((p) => rem.left.includes(p.left) && rem.right.includes(p.right));
    const leftPick = rem.left[0];
    const partner = relevant.find((p) => p.left === leftPick)?.right;
    const wrongRight = rem.right.find((t) => t !== partner);
    if (leftPick && wrongRight) {
      await jsClickText('.match > div:nth-child(1) .mchip', leftPick);
      await jsClickText('.match > div:nth-child(2) .mchip', wrongRight);
      wrongs += 1;
      await page.waitForSelector('.sheet.no');
      log.hearts.push(['fail-run match', 'wrong', await fullHearts()]);
      await sleep(150);
    } else {
      // only one pair left: complete it (judged correct on the last pair) and continue
      const pair = relevant[0];
      await jsClickText('.match > div:nth-child(1) .mchip', pair.left);
      await jsClickText('.match > div:nth-child(2) .mchip', pair.right);
      await sleep(300);
    }
    continue;
  }
  // guaranteed wrong answers from published data
  if (type === 'truefalse') {
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = course.lessons.filter((l) => l.id === 'u1l1' || l.id === 'u1l2').flatMap((l) => l.prompts).find((p) => p.type === 'truefalse' && p.stem === stem);
    await jsClickText('.tf .opt.tile .cap', published.answer ? 'False' : 'True');
  } else if (type === 'fill') {
    const story = await page.$eval('.story', (el) => el.textContent.trim());
    const published = course.lessons.filter((l) => l.id === 'u1l1' || l.id === 'u1l2').flatMap((l) => l.prompts).find((p) => p.type === 'fill' && p.story && story.startsWith(p.story.split('____')[0].slice(0, 24)));
    const wrong = published.bank.find((w) => w !== published.answer);
    await jsClickText('.bank .bank-chip', wrong);
  } else {
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = course.lessons.filter((l) => l.id === 'u1l1' || l.id === 'u1l2').flatMap((l) => l.prompts).find((p) => p.type === type && p.stem === stem);
    const wrong = published.options.find((o) => o.text !== published.options[published.answer].text);
    await jsClickText('.opts .opt.tile', wrong.text);
  }
  wrongs += 1;
  await sleep(120);
  await page.click('.foot .btn');
  await sleep(200);
}
await page.waitForSelector('.hero');
await shot('11-fail');
note('fail h1', await page.$eval('.hero h1', (el) => el.textContent.trim()));
note('xp after failed practice (per-answer only)', await readXp());
await page.click('.hero .btn'); // 再来一轮
await page.waitForSelector('.prompt:not(.teach)');
note('hearts refilled on retry', String(await fullHearts()));
await shot('12-practice-restarted');

// exit the restarted round through the × close, then check Settings
await page.click('.xbtn');
await page.waitForSelector('.path');
await page.click('.nav button:nth-child(4)');
await page.waitForSelector('.file-button');
await shot('13-settings');

note('errors', log.errors.length ? JSON.stringify(log.errors) : 'none');
console.log(JSON.stringify(log, null, 1));
await browser.close();
