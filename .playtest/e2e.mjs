import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const BASE = 'http://localhost:5210/';
const SHOTS = path.resolve(HERE, 'shots-e2e');
fs.mkdirSync(SHOTS, { recursive: true });

const course = JSON.parse(
  fs.readFileSync(path.join(REPO, 'content/packs/hedge-or-pledge/zh-CN/course.json'), 'utf8'),
);
const ALL_PROMPTS = course.lessons.flatMap((l) => l.prompts);
const ALL_PAIRS = ALL_PROMPTS.filter((p) => p.type === 'match').flatMap((p) => p.pairs);

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: Boolean(cond) });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + detail}`);
}
const sleep = (ms) => page.waitForTimeout(ms);
async function shot(name) {
  await page.screenshot({ path: path.join(SHOTS, name + '.png') });
}
const jsClick = (sel) =>
  page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error('no el: ' + s);
    el.click();
  }, sel);
const jsClickText = (sel, text) =>
  page.evaluate(
    ([s, t]) => {
      const el = Array.from(document.querySelectorAll(s)).find((n) => n.textContent.trim() === t);
      if (!el) throw new Error(`no ${s} with text ${t}`);
      el.click();
    },
    [sel, text],
  );

const fingerprint = (p) =>
  (p.options || [])
    .map((o) => o.text)
    .sort()
    .join('|');
async function visibleOptions() {
  return page.$$eval('.opts .opt.tile .cap', (els) =>
    els
      .map((e) => e.textContent.trim())
      .sort()
      .join('|'),
  );
}

function findPublished(type, { stem, story, sig }) {
  if (type === 'scenario') return ALL_PROMPTS.find((p) => p.type === 'scenario' && p.story === story);
  // the rendered fill story has the blank filled in, so match on the prefix before ____
  if (type === 'fill')
    return ALL_PROMPTS.find((p) => p.type === 'fill' && story && story.startsWith(p.story.split('____')[0]));
  if (type === 'truefalse') return ALL_PROMPTS.find((p) => p.type === 'truefalse' && p.stem === stem);
  return ALL_PROMPTS.find((p) => p.type === type && p.stem === stem && fingerprint(p) === sig);
}

const kickerType = {
  词义辨析: 'meaning',
  判断正误: 'truefalse',
  补全句子: 'fill',
  真实情境: 'scenario',
  配对练习: 'match',
};

async function readXp() {
  return Number((await page.$eval('.stat.xp', (el) => el.textContent)).replace(/\D/g, ''));
}

// Answer the prompt currently on screen. forceWrong picks a guaranteed wrong
// answer from published data (match prompts get a deliberate mispair instead).
async function solveCurrent(forceWrong) {
  const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
  const type = kickerType[kicker];
  if (!type) throw new Error('unknown kicker: ' + kicker);
  if (type === 'match') {
    const visible = await page.evaluate(() => ({
      left: Array.from(document.querySelectorAll('.match > div:nth-child(1) .mchip'))
        .filter((c) => !c.disabled)
        .map((c) => c.textContent.trim()),
      right: Array.from(document.querySelectorAll('.match > div:nth-child(2) .mchip'))
        .filter((c) => !c.disabled)
        .map((c) => c.textContent.trim()),
    }));
    // prefer the pairs of the exact visible prompt; fall back to the course-wide union
    const lefts = [...visible.left].sort().join('|');
    const rights = [...visible.right].sort().join('|');
    const publishedMatch = ALL_PROMPTS.find(
      (p) =>
        p.type === 'match' &&
        p.pairs
          .map((x) => x.left)
          .sort()
          .join('|') === lefts &&
        p.pairs
          .map((x) => x.right)
          .sort()
          .join('|') === rights,
    );
    const pairs = publishedMatch ? publishedMatch.pairs : ALL_PAIRS;
    if (forceWrong) {
      const leftPick = visible.left[0];
      const leftId = pairs.find((p) => p.left === leftPick).id;
      const wrongRight = visible.right.find(
        (t) => pairs.find((p) => p.left === leftPick && p.right === t) === undefined,
      );
      if (!wrongRight) throw new Error('no wrong right chip for ' + leftPick);
      await jsClickText('.match > div:nth-child(1) .mchip', leftPick);
      await jsClickText('.match > div:nth-child(2) .mchip', wrongRight);
      return;
    }
    for (;;) {
      const remaining = await page.evaluate(() => ({
        left: Array.from(document.querySelectorAll('.match > div:nth-child(1) .mchip'))
          .filter((c) => !c.disabled)
          .map((c) => c.textContent.trim()),
        right: Array.from(document.querySelectorAll('.match > div:nth-child(2) .mchip'))
          .filter((c) => !c.disabled)
          .map((c) => c.textContent.trim()),
      }));
      if (!remaining.left.length) break;
      const pair = pairs.find((p) => remaining.left.includes(p.left) && remaining.right.includes(p.right));
      if (!pair) throw new Error('no pair for ' + JSON.stringify(remaining));
      await jsClickText('.match > div:nth-child(1) .mchip', pair.left);
      await jsClickText('.match > div:nth-child(2) .mchip', pair.right);
      await sleep(120);
      if (await page.$('.sheet')) break;
    }
    return;
  }
  if (type === 'truefalse') {
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = findPublished(type, { stem });
    if (!published) throw new Error('unknown truefalse: ' + stem);
    const want = forceWrong ? !published.answer : published.answer;
    await jsClickText('.tf .opt.tile .cap', want ? 'True' : 'False');
    return;
  }
  if (type === 'fill') {
    const story = await page.$eval('.story', (el) => el.textContent.trim());
    const published = findPublished(type, { story });
    if (!published) throw new Error('unknown fill: ' + story.slice(0, 40));
    const word = forceWrong ? published.bank.find((w) => w !== published.answer) : published.answer;
    await jsClickText('.bank .bank-chip', word);
    return;
  }
  const stem = await page.$eval('.stem', (el) => el.textContent.trim());
  const story = (await page.$('.story'))
    ? await page.$eval('.story', (el) => el.textContent.trim())
    : undefined;
  const sig = await visibleOptions();
  const published = findPublished(type, { stem, sig, story });
  if (!published) throw new Error(`unknown ${type}: ` + stem);
  const wrong = published.options.find((o) => o.text !== published.options[published.answer].text);
  await jsClickText('.opts .opt.tile', forceWrong ? wrong.text : published.options[published.answer].text);
}

// Drive the active session to the complete/fail hero. wrongIds: prompt ids to
// answer wrong once; mispairIds: match prompt ids to mispair once (first sight).
async function driveSession({ wrongIds = [], mispairIds = [], maxSteps = 40 } = {}) {
  const wrongDone = new Set();
  const mispairDone = new Set();
  const verdicts = [];
  for (let step = 0; step < maxSteps; step += 1) {
    if (await page.$('.hero')) return verdicts;
    if (await page.$('.sheet')) {
      const ok = await page.$eval('.sheet', (el) => el.classList.contains('ok'));
      verdicts.push(ok);
      await page.click('.sheet .btn');
      await sleep(200);
      continue;
    }
    await page.waitForSelector('.prompt:not(.teach)');
    const stemOrStory = await page.evaluate(() => {
      const stem = document.querySelector('.stem');
      const story = document.querySelector('.story');
      return { stem: stem && stem.textContent.trim(), story: story && story.textContent.trim() };
    });
    const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
    const type = kickerType[kicker];
    let id = null;
    if (type === 'match') {
      // fingerprint the visible match by its two columns
      const lefts = await page.$$eval('.match > div:nth-child(1) .mchip', (els) =>
        els
          .map((e) => e.textContent.trim())
          .sort()
          .join('|'),
      );
      const rights = await page.$$eval('.match > div:nth-child(2) .mchip', (els) =>
        els
          .map((e) => e.textContent.trim())
          .sort()
          .join('|'),
      );
      const publishedMatch = ALL_PROMPTS.find(
        (p) =>
          p.type === 'match' &&
          p.pairs
            .map((x) => x.left)
            .sort()
            .join('|') === lefts &&
          p.pairs
            .map((x) => x.right)
            .sort()
            .join('|') === rights,
      );
      id = publishedMatch ? publishedMatch.id : null;
    } else {
      const published = findPublished(type, {
        stem: stemOrStory.stem,
        story: type === 'scenario' || type === 'fill' ? stemOrStory.story : undefined,
        sig: type === 'meaning' || type === 'scenario' ? await visibleOptions() : undefined,
      });
      id = published ? published.id : null;
    }
    const forceWrong =
      (wrongIds.includes(id) && !wrongDone.has(id)) ||
      (type === 'match' && mispairIds.includes(id) && !mispairDone.has(id));
    if (wrongIds.includes(id)) wrongDone.add(id);
    if (type === 'match' && mispairIds.includes(id)) mispairDone.add(id);
    await solveCurrent(forceWrong);
    if (type !== 'match') {
      await sleep(120);
      await page.click('.foot .btn');
    }
    await sleep(200);
  }
  throw new Error('session did not reach the hero screen');
}

async function exitTeach() {
  let cards = 0;
  while (await page.$('.prompt.teach')) {
    await page.click('.foot .btn');
    cards += 1;
    await sleep(200);
  }
  return cards;
}

async function readComplete() {
  await page.waitForSelector('.hero');
  const h1 = await page.$eval('.hero h1', (el) => el.textContent.trim());
  const sub = await page.$eval('.hero .sub', (el) => el.textContent.trim());
  const rows = await page.$$eval('.xp-row', (els) => els.map((el) => el.textContent.trim()));
  const numbers = rows.map((r) => Number(r.match(/\+(\d+)/)?.[1]));
  const xpTotal = numbers.pop();
  const answers = Number(sub.match(/(\d+)\/(\d+)/)?.[2]); // "73% 正确率 · 8/11"
  return { h1, sub, rows, sum: numbers.reduce((a, b) => a + b, 0), xpTotal, answers };
}

let page, context;
const consoleProblems = [];
async function newPage(ctx) {
  const p = await ctx.newPage();
  p.on('console', (m) => {
    if (m.type() === 'error') consoleProblems.push('console: ' + m.text());
  });
  p.on('pageerror', (e) => consoleProblems.push('pageerror: ' + e.message));
  p.on('dialog', (d) => d.accept().catch(() => {}));
  return p;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
  acceptDownloads: true,
});
page = await newPage(context);

/* ---- S1: fresh home ---- */
await page.goto(BASE);
await page.waitForSelector('.path');
{
  const nodes = await page.$$('.node');
  check('S1 home renders 17 lesson nodes', nodes.length === 17, String(nodes.length));
  const nextCount = await page.$$eval('.node.next', (els) => els.length);
  const lockedCount = await page.$$eval('.node.locked', (els) => els.length);
  check(
    'S1 exactly one next node and 16 locked',
    nextCount === 1 && lockedCount === 16,
    `next=${nextCount} locked=${lockedCount}`,
  );
  check('S1 header XP is 0', (await readXp()) === 0);
  check('S1 title is the Kachi app', (await page.title()) === 'Kachi — 财经英语学习');
  const hLock = await page.evaluate(() => {
    const el = document.querySelector('.scroll');
    el.scrollLeft = 999;
    return el.scrollLeft;
  });
  check('S1 the path cannot scroll horizontally', hLock === 0, String(hLock));
  await shot('01-home-fresh');
}

/* ---- S2: u1l1 with one deliberate wrong + one match mispair ---- */
{
  const xpBefore = await readXp();
  await jsClick('button.node.next');
  await page.waitForSelector('.prompt.teach');
  const teachCards = await exitTeach();
  check('S2 u1l1 teaches 2 terms', teachCards === 2, String(teachCards));
  check('S2 hearts start at 5', (await page.$$eval('.hearts .ht.full', (els) => els.length)) === 5);
  await shot('02-quiz');
  const verdicts = await driveSession({ wrongIds: ['u1l1a'], mispairIds: ['u1l1f'] });
  const complete = await readComplete();
  check('S2 complete verdict is 课程完成 (not flawless)', complete.h1 === '课程完成。', complete.h1);
  check('S2 accuracy line is 9/11 (requeued match re-run)', complete.sub.includes('9/11'), complete.sub);
  check(
    'S2 xp rows sum to the total (90+20=110)',
    complete.xpTotal === complete.sum && complete.xpTotal === 110,
    JSON.stringify(complete.rows),
  );
  const chips = await page.$$eval('.chip', (els) => els.map((el) => el.textContent.trim()));
  check('S2 mix-up chips name hedge vs pledge', chips.includes('hedge vs pledge'), JSON.stringify(chips));
  check('S2 three path buttons offered', (await page.$$eval('.hero .btn', (els) => els.length)) === 3);
  check(
    'S2 verdict stream holds 1 mispair wrong + rerun correct',
    verdicts.filter((v) => !v).length === 2,
    JSON.stringify(verdicts),
  );
  const heroLock = await page.evaluate(() => {
    const el = document.querySelector('.hero');
    el.scrollLeft = 999;
    return el.scrollLeft;
  });
  check(
    'S2 the complete screen cannot scroll horizontally (confetti overflow locked)',
    heroLock === 0,
    String(heroLock),
  );
  await shot('03-complete');

  // 练一练这些 -> focused practice round
  await page.click('.hero .btn-green');
  await page.waitForSelector('.prompt:not(.teach)');
  const focusVerdicts = await driveSession({});
  const practiceComplete = await readComplete();
  check(
    'S2b focused practice completes (这轮复习完成。)',
    practiceComplete.h1 === '这轮复习完成。',
    practiceComplete.h1,
  );
  check(
    'S2b practice pays per-answer only',
    practiceComplete.rows.length === 2 && practiceComplete.xpTotal === practiceComplete.sum,
    JSON.stringify(practiceComplete.rows),
  );
  check(
    'S2b focused round was 10/10',
    focusVerdicts.length === 10 && focusVerdicts.every(Boolean),
    String(focusVerdicts.length),
  );
  await page.click('.hero .btn-ghost'); // 回到路径
  await page.waitForSelector('.path');
  check(
    'S2 header XP = before + 110 + practice total',
    (await readXp()) === xpBefore + 110 + practiceComplete.xpTotal,
    String(await readXp()),
  );
  const states = await page.$$eval('.node', (els) => els.slice(0, 2).map((el) => el.className));
  check(
    'S2 path: u1l1 done, u1l2 next',
    states[0].includes('done') && states[1].includes('next'),
    JSON.stringify(states),
  );
}

/* ---- S3: flawless u1l2 -> u1l3 -> u1r recap -> into u2l1 ---- */
{
  const xpAtUnitStart = await readXp();
  let unitGained = 0;
  let firstIteration = true;
  for (const [lessonId, expectReview] of [
    ['u1l2', false],
    ['u1l3', false],
    ['u1r', true],
  ]) {
    if (firstIteration) {
      await jsClick('button.node.next');
      firstIteration = false;
    }
    await page.waitForSelector('.lesson');
    if (expectReview) {
      const pills = await page.$$eval('.recap-item', (els) => els.map((el) => el.textContent.trim()));
      check('S3 u1r recap shows all six unit-1 terms', pills.length === 6, JSON.stringify(pills));
      check(
        'S3 u1r recap button says 该你了',
        (await page.$eval('.foot .btn', (el) => el.textContent.trim())) === '该你了',
      );
      await shot('04-recap');
    }
    const teachCards = await exitTeach();
    if (!expectReview) check(`S3 ${lessonId} taught its fresh terms`, teachCards === 2, String(teachCards));
    await driveSession({});
    const complete = await readComplete();
    check(`S3 ${lessonId} flawless verdict`, complete.h1 === '完美。', complete.h1);
    check(
      `S3 ${lessonId} no-mistake bonus paid`,
      complete.rows.some((r) => r.includes('全对奖励')),
      JSON.stringify(complete.rows),
    );
    check(`S3 ${lessonId} xp math`, complete.xpTotal === complete.sum, JSON.stringify(complete.rows));
    unitGained += complete.xpTotal;
    await page.click('.hero .btn-gold'); // 下一课：… chains straight on
    await sleep(300);
    check(`S3 after ${lessonId} the next lesson opened`, (await page.$('.lesson')) !== null);
  }
  // we are now inside u2l1 teach; exit to the path
  await page.click('.xbtn');
  await page.waitForSelector('.path');
  check(
    'S3 unit-1 chain banked exactly the sum of its complete screens',
    (await readXp()) === xpAtUnitStart + unitGained,
    `${await readXp()} vs ${xpAtUnitStart + unitGained}`,
  );
  const states = await page.$$eval('.node', (els) => els.slice(0, 5).map((el) => el.className));
  check(
    'S3 first five nodes: 4 done + u2l1 next',
    states.slice(0, 4).every((s) => s.includes('done')) && states[4].includes('next'),
    JSON.stringify(states),
  );
}

/* ---- S4: persistence across reload ---- */
{
  const xpBefore = await readXp();
  await page.reload();
  await page.waitForSelector('.path');
  check('S4 XP survives reload', (await readXp()) === xpBefore, String(await readXp()));
  const streak = await page.$eval('.stat.streak', (el) => el.textContent.replace(/\D/g, ''));
  check('S4 streak is 1 after today’s lessons', streak === '1', streak);
  const states = await page.$$eval('.node', (els) => els.slice(0, 5).map((el) => el.className));
  check(
    'S4 path state survives reload',
    states.slice(0, 4).every((s) => s.includes('done')) && states[4].includes('next'),
    JSON.stringify(states),
  );
  await shot('05-persisted-path');
}

/* ---- S5: practice tab round + glossary seen marks ---- */
{
  const xpBefore = await readXp();
  await page.click('.nav button:nth-child(2)');
  await page.waitForSelector('.prac-hero');
  await page.click('.prac-hero .btn');
  await page.waitForSelector('.prompt:not(.teach)');
  await driveSession({});
  const complete = await readComplete();
  check(
    'S5 practice round completes per-answer only',
    complete.rows.length === 2 && complete.xpTotal === complete.sum,
    JSON.stringify(complete.rows),
  );
  await page.click('.hero .btn-gold'); // 再来一轮 starts a fresh round
  await page.waitForSelector('.prompt:not(.teach)');
  check('S5 practice again starts a new round', (await page.$('.kicker2')) !== null);
  await page.click('.xbtn');
  await page.waitForSelector('.path');

  await page.click('.nav button:nth-child(3)');
  await page.waitForSelector('.g-list');
  const seenCount = await page.$$eval('.g-card .seen', (els) => els.length);
  check('S5 glossary marks seen terms from unit 1', seenCount >= 6, String(seenCount));
  await page.fill('.g-search input', 'zzzz');
  await sleep(150);
  check('S5 glossary empty state on nonsense query', (await page.$('.g-empty')) !== null);
  await shot('06-glossary-empty');
  await page.click('.nav button:nth-child(1)');
  await page.waitForSelector('.path');
  check(
    'S5 header XP grew by the practice round',
    (await readXp()) === xpBefore + complete.xpTotal,
    String(await readXp()),
  );
}

/* ---- S6: keyboard-only u2l1 ---- */
{
  await jsClick('button.node.next'); // u2l1 (mouse setup; keyboard cannot start from home)
  await page.waitForSelector('.prompt.teach');
  let guard = 0;
  while ((await page.$('.prompt.teach')) && guard < 8) {
    await page.keyboard.press('Enter');
    guard += 1;
    await sleep(200);
  }
  check('S6 Enter walked the teach cards into the quiz', (await page.$('.prompt:not(.teach)')) !== null);

  let verdicts = 0;
  for (let step = 0; step < 40; step += 1) {
    if (await page.$('.hero')) break;
    if (await page.$('.sheet')) {
      await page.keyboard.press('Enter');
      verdicts += 1;
      await sleep(200);
      continue;
    }
    const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
    const type = kickerType[kicker];
    if (type === 'match') {
      await solveCurrent(false); // match needs the mouse; every other type is keyboard-driven
      continue;
    }
    // press the number key that holds the CORRECT answer (keyboard answers must not flake)
    let key;
    if (type === 'truefalse') {
      const stem = await page.$eval('.stem', (el) => el.textContent.trim());
      key = findPublished('truefalse', { stem }).answer ? '1' : '2';
    } else if (type === 'fill') {
      const story = await page.$eval('.story', (el) => el.textContent.trim());
      const published = findPublished('fill', { story });
      // bank chips contain an art span (empty text) before the word span — drop the empties
      const chips = (
        await page.$$eval('.bank .bank-chip span', (els) => els.map((e) => e.textContent.trim()))
      ).filter((t) => t);
      key = String(chips.indexOf(published.answer) + 1);
    } else {
      const stem = await page.$eval('.stem', (el) => el.textContent.trim());
      const story = (await page.$('.story'))
        ? await page.$eval('.story', (el) => el.textContent.trim())
        : undefined;
      const published = findPublished(type, { stem, sig: await visibleOptions(), story });
      const correct = published.options[published.answer].text;
      const caps = await page.$$eval('.opts .opt.tile .cap', (els) => els.map((e) => e.textContent.trim()));
      key = String(caps.indexOf(correct) + 1);
    }
    await page.keyboard.press(key);
    await sleep(120);
    const disabled = await page.$eval('.foot .btn', (el) => el.disabled);
    check('S6 digit key armed the check button', !disabled);
    await page.keyboard.press('Enter'); // check
    await page.waitForSelector('.sheet');
  }
  const complete = await readComplete();
  check(
    'S6 keyboard-only lesson reached the complete screen',
    complete.h1 === '完美。' || complete.h1 === '课程完成。',
    complete.h1,
  );
  check(
    'S6 every prompt got a verdict sheet (Enter-driven)',
    verdicts === complete.answers,
    `${verdicts}/${complete.answers}`,
  );
  await page.keyboard.press('Enter'); // presses the primary hero button
  await sleep(300);
  check('S6 Enter fired the next-lesson chain', (await page.$('.lesson')) !== null);
  await shot('07-keyboard-next-lesson');
  await page.click('.xbtn');
  await page.waitForSelector('.path');
}

/* ---- S7: settings export / import ---- */
{
  const xpBefore = await readXp(); // settings header has no stats bar — read on the path first
  await page.click('.nav button:nth-child(4)');
  await page.waitForSelector('.file-button');
  const [download] = await Promise.all([page.waitForEvent('download'), page.click('.btn-green')]);
  const exported = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
  check('S7 export envelope carries schemaVersion 1', exported.schemaVersion === 1);
  check(
    'S7 export carries the live learner state',
    exported.learnerState.xp === xpBefore,
    String(exported.learnerState?.xp),
  );
  check(
    'S7 export logs every attempt',
    Array.isArray(exported.learnerState.attempts) && exported.learnerState.attempts.length > 50,
    String(exported.learnerState?.attempts?.length),
  );

  const tampered = { ...exported, learnerState: { ...exported.learnerState, xp: 999 } };
  await page.setInputFiles('.file-button input', {
    name: 'kachi-import.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(tampered)),
  });
  await sleep(400);
  await page.reload();
  await page.waitForSelector('.path');
  check(
    'S7 import replaces the live state and persists across reload',
    (await readXp()) === 999,
    String(await readXp()),
  );
  await shot('08-imported');
}

/* ---- S10: abandon mid-lesson leaves the lesson uncompleted ---- */
{
  const xpBefore = await readXp();
  await jsClick('button.node.next'); // u2l2
  await page.waitForSelector('.lesson');
  await exitTeach();
  // answer two prompts correctly, then walk out
  for (let i = 0; i < 2; i += 1) {
    await page.waitForSelector('.prompt:not(.teach)');
    await solveCurrent(false);
    await sleep(120);
    await page.click('.foot .btn');
    await sleep(150);
    await page.click('.sheet .btn');
    await sleep(150);
  }
  await page.click('.xbtn');
  await page.waitForSelector('.path');
  const states = await page.$$eval('.node', (els) => els.map((el) => el.className));
  check('S10 abandoned lesson is not marked done', !states[5].includes('done'), states[5]);
  check('S10 abandoned lesson stays unlocked', !states[5].includes('locked'), states[5]);
  check(
    'S10 partial XP from correct answers is kept (incremental engine)',
    (await readXp()) === xpBefore + 20,
    `${await readXp()} vs ${xpBefore + 20}`,
  );
}

/* ---- S11: drain hearts in a lesson -> fail -> retry refills -> complete ---- */
{
  const lesson = course.lessons.find((l) => l.id === 'u2l2');
  const wrongIds = lesson.prompts.map((p) => p.id);
  await jsClick('button.node.next');
  await page.waitForSelector('.lesson');
  await exitTeach();
  const verdicts = await driveSession({ wrongIds });
  const failH1 = await page.$eval('.hero h1', (el) => el.textContent.trim());
  check('S11 five wrongs end the lesson on the fail screen', failH1 === '爱心用完了。', failH1);
  check(
    'S11 exactly five verdicts before the fail screen',
    verdicts.filter((v) => !v).length === 5 && verdicts.length === 5,
    JSON.stringify(verdicts),
  );
  await shot('10-fail');
  await page.click('.hero .btn'); // 重试本课
  await page.waitForSelector('.lesson');
  await exitTeach(); // hearts live in the quiz header, not the teach header
  check(
    'S11 retry refills hearts immediately',
    (await page.$$eval('.hearts .ht.full', (els) => els.length)) === 5,
  );
  await driveSession({});
  const complete = await readComplete();
  check(
    'S11 retried lesson completes',
    complete.h1 === '课程完成。' || complete.h1 === '完美。',
    complete.h1,
  );
  await page.click('.hero .btn-ghost');
  await page.waitForSelector('.path');
  const states = await page.$$eval('.node', (els) => els.map((el) => el.className));
  check('S11 retried lesson now marked done', states[5].includes('done'), states[5]);
}

/* ---- S9: language switch (zh <-> en), shared progress, persisted choice ---- */
{
  const xpBefore = await readXp();
  await page.click('.nav button:nth-child(4)');
  await page.waitForSelector('.lang-switch');
  await page.click('.lang-switch button:has-text("English")');
  await sleep(250);
  // chrome switched
  const navLabels = await page.$$eval('.nav button', (els) => els.map((el) => el.textContent.trim()));
  check(
    'S9 nav labels switch to English',
    JSON.stringify(navLabels) === JSON.stringify(['Learn', 'Practice', 'Glossary', 'Settings']),
    JSON.stringify(navLabels),
  );
  // course content switched: open the next lesson and read the teach card
  await page.click('.nav button:nth-child(1)');
  await page.waitForSelector('.path');
  const nodeLabel = await page.evaluate(
    () =>
      document.querySelector('.node.next')?.closest('.node-wrap')?.querySelector('.node-label')?.textContent,
  );
  check('S9 the up-next label is English', /Up next · /.test(nodeLabel ?? ''), nodeLabel ?? 'none');
  await jsClick('button.node.next');
  await page.waitForSelector('.prompt.teach');
  const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
  const term = await page.$eval('.teach-term', (el) => el.textContent.trim());
  const def = await page.$eval('.teach-def', (el) => el.textContent.trim());
  check('S9 teach card kicker is English', kicker === 'New word', kicker);
  check(
    'S9 teach content comes from the en pack (no Chinese in the definition)',
    /[a-z]/i.test(def) && !/[\u4e00-\u9fff]/.test(def),
    `${term}: ${def.slice(0, 40)}`,
  );
  await shot('11-english-teach');
  await page.click('.xbtn');
  await page.waitForSelector('.path');
  check('S9 XP is shared across languages', (await readXp()) === xpBefore, String(await readXp()));
  // persists across reload
  await page.reload();
  await page.waitForSelector('.path');
  const navAfterReload = await page.$$eval('.nav button', (els) => els.map((el) => el.textContent.trim()));
  check('S9 language choice survives reload', navAfterReload[0] === 'Learn', JSON.stringify(navAfterReload));
  // back to Chinese
  await page.click('.nav button:nth-child(4)');
  await page.waitForSelector('.lang-switch');
  await page.click('.lang-switch button:has-text("中文")');
  await sleep(250);
  const navZh = await page.$$eval('.nav button', (els) => els.map((el) => el.textContent.trim()));
  check('S9 switching back restores Chinese chrome', navZh[0] === '学习', JSON.stringify(navZh));
}

/* ---- S13: keyboard focus reaches the nav (a11y spot check) ---- */
{
  await page.reload();
  await page.waitForSelector('.path');
  await page.keyboard.press('Tab');
  const focused = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    aria: document.activeElement?.getAttribute('aria-label'),
    visible: document.activeElement?.matches(':focus-visible'),
  }));
  check(
    'S13 first Tab lands on a labelled button',
    focused.tag === 'BUTTON' && Boolean(focused.aria),
    JSON.stringify(focused),
  );
  check('S13 focused button shows the focus ring', focused.visible === true);
}

await context.close();

/* ---- S12: desktop viewport shows the centered phone frame ---- */
{
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p = await desktop.newPage();
  p.on('pageerror', (e) => consoleProblems.push('pageerror: ' + e.message));
  await p.goto(BASE);
  await p.waitForSelector('.path');
  const box = await p.$eval('#root', (el) => {
    const rect = el.getBoundingClientRect();
    return { x: rect.x, width: rect.width, height: rect.height };
  });
  check('S12 phone frame is 420px wide on desktop', Math.round(box.width) === 420, String(box.width));
  check('S12 phone frame is horizontally centered', Math.abs(box.x - (1280 - 420) / 2) < 2, String(box.x));
  check(
    'S12 frame fills the viewport height minus padding',
    Math.abs(box.height - (800 - 48)) < 2,
    String(box.height),
  );
  await p.screenshot({ path: path.join(SHOTS, '12-desktop.png') });
  await desktop.close();
}

/* ---- S8: production PWA boots offline (fresh context, preview server) ---- */
{
  const offlineContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const p = await newPage(offlineContext);
  const savedPage = page;
  page = p;
  await p.goto(BASE);
  await p.waitForSelector('.path');
  await p.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await p.reload();
  await p.waitForSelector('.path');
  const controlled = await p.evaluate(() => Boolean(navigator.serviceWorker.controller));
  check('S8 service worker controls the page after reload', controlled);

  await offlineContext.setOffline(true);
  await p.reload();
  await p.waitForSelector('.path', { timeout: 15000 });
  check('S8 app boots offline from the precache', (await page.$('.path')) !== null);
  check('S8 offline header starts from a fresh local state', (await readXp()) === 0);
  await jsClick('button.node.next'); // a lesson starts offline too
  await p.waitForSelector('.prompt.teach', { timeout: 5000 });
  check('S8 teach card renders offline', (await p.$('.teach-term')) !== null);
  await shot('09-offline');
  await offlineContext.setOffline(false);
  await offlineContext.close();
  page = savedPage;
}

check(
  'E2E zero console errors across all scenarios',
  consoleProblems.length === 0,
  JSON.stringify(consoleProblems.slice(0, 4)),
);
await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(`\n==== e2e summary: ${results.length - failed.length}/${results.length} checks passed ====`);
if (failed.length) {
  failed.forEach((f) => console.log('FAILED:', f.name));
  process.exit(1);
}
