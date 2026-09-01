/* Focused browser verification for the review fixes:
   A  P2-4 document lang/title/description follow the UI language
   B  P2-5 locked lesson nodes are disabled with a locked accessible label
   C  P1-1 a match mispair records the exact confusion pair (answer, conceptIds,
      confusionPairId, mastery lapse) and the lapse survives the corrective rerun
   D  P1-2 a malformed import (attempts: [{eventId:"x"}]) is rejected with the
      friendly message — no crash, live state untouched
   E  P1-3 the update banner activates the waiting service worker (two builds) */

import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright-core';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const BASE = 'http://localhost:5210/';

const course = JSON.parse(
  fs.readFileSync(path.join(REPO, 'content/packs/hedge-or-pledge/zh-CN/course.json'), 'utf8'),
);
const ALL_PROMPTS = course.lessons.flatMap((l) => l.prompts);
const CONCEPT_IDS = new Set(course.concepts.map((c) => c.id));

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, pass: Boolean(cond) });
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${cond ? '' : '  -> ' + detail}`);
}
const sleep = (ms) => page.waitForTimeout(ms);
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

const kickerType = {
  词义辨析: 'meaning',
  判断正误: 'truefalse',
  补全句子: 'fill',
  真实情境: 'scenario',
  配对练习: 'match',
};

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
  if (type === 'fill')
    return ALL_PROMPTS.find((p) => p.type === 'fill' && story && story.startsWith(p.story.split('____')[0]));
  if (type === 'truefalse') return ALL_PROMPTS.find((p) => p.type === 'truefalse' && p.stem === stem);
  return ALL_PROMPTS.find((p) => p.type === type && p.stem === stem && fingerprint(p) === sig);
}

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
    const pairs = publishedMatch
      ? publishedMatch.pairs
      : ALL_PROMPTS.filter((p) => p.type === 'match').flatMap((p) => p.pairs);
    if (forceWrong) {
      // Pick two different published concepts. Pseudo-term mispairs are valid
      // raw attempts but intentionally do not create schedulable mastery.
      const leftPair = pairs.find((p) => visible.left.includes(p.left) && CONCEPT_IDS.has(p.id));
      const wrongPair = pairs.find(
        (p) => visible.right.includes(p.right) && CONCEPT_IDS.has(p.id) && p.id !== leftPair?.id,
      );
      if (!leftPair || !wrongPair) throw new Error('no real-concept mispair for this prompt');
      await jsClickText('.match > div:nth-child(1) .mchip', leftPair.left);
      await jsClickText('.match > div:nth-child(2) .mchip', wrongPair.right);
      return { leftId: leftPair.id, rightId: wrongPair.id };
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
    return null;
  }
  if (type === 'truefalse') {
    const stem = await page.$eval('.stem', (el) => el.textContent.trim());
    const published = findPublished(type, { stem });
    if (!published) throw new Error('unknown truefalse: ' + stem);
    const want = forceWrong ? !published.answer : published.answer;
    await jsClickText('.tf .opt.tile .cap', want ? 'True' : 'False');
    return null;
  }
  if (type === 'fill') {
    const story = await page.$eval('.story', (el) => el.textContent.trim());
    const published = findPublished(type, { story });
    if (!published) throw new Error('unknown fill: ' + story.slice(0, 40));
    const word = forceWrong ? published.bank.find((w) => w !== published.answer) : published.answer;
    await jsClickText('.bank .bank-chip', word);
    return null;
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
  return null;
}

async function driveSession({ mispairOnce = false } = {}) {
  let mispaired = null;
  let mispairSpent = false;
  for (let step = 0; step < 60; step += 1) {
    if (await page.$('.hero')) return mispaired;
    if (await page.$('.sheet')) {
      await page.click('.sheet .btn');
      await sleep(200);
      continue;
    }
    await page.waitForSelector('.prompt:not(.teach)');
    const kicker = await page.$eval('.kicker2', (el) => el.textContent.trim());
    const type = kickerType[kicker];
    const forceWrong = type === 'match' && mispairOnce && !mispairSpent;
    const picked = await solveCurrent(forceWrong);
    if (picked) {
      mispaired = picked;
      mispairSpent = true;
    }
    if (type !== 'match') {
      await sleep(120);
      await page.click('.foot .btn');
    }
    await sleep(200);
  }
  throw new Error('session did not reach the hero screen');
}

async function exitTeach() {
  while (await page.$('.prompt.teach')) {
    await page.click('.foot .btn');
    await sleep(200);
  }
}

async function readLearnerState() {
  return page.evaluate(async () => {
    const db = await new Promise((resolve, reject) => {
      const open = indexedDB.open('kachi-learning');
      open.onsuccess = () => resolve(open.result);
      open.onerror = () => reject(open.error);
    });
    const read = (store, key) =>
      new Promise((resolve, reject) => {
        const req =
          key === undefined
            ? db.transaction(store, 'readonly').objectStore(store).getAll()
            : db.transaction(store, 'readonly').objectStore(store).get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    const profile = await read('snapshots', 'local-profile');
    const events = await read('events');
    db.close();
    return { profile, events };
  });
}

const consoleProblems = [];
const dialogMessages = [];
let page;
async function newPage(ctx) {
  const p = await ctx.newPage();
  p.on('console', (m) => {
    if (m.type() === 'error') consoleProblems.push('console: ' + m.text());
  });
  p.on('pageerror', (e) => consoleProblems.push('pageerror: ' + e.message));
  p.on('dialog', (d) => {
    dialogMessages.push(d.message());
    d.accept().catch(() => {});
  });
  return p;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });

/* ---- A: document metadata follows the UI language (P2-4) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await newPage(ctx);
  await page.goto(BASE);
  await page.waitForSelector('.path');
  const zh = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
  }));
  check('A zh fresh load: html lang is zh-CN', zh.lang === 'zh-CN', JSON.stringify(zh));
  check('A zh fresh load: Chinese title', zh.title === 'Kachi — 财经英语学习', zh.title);
  check('A zh fresh load: Chinese description', /财经英语/.test(zh.description ?? ''), zh.description);

  await page.click('.nav button:nth-child(4)');
  await page.waitForSelector('.lang-switch');
  await page.click('.lang-switch button:has-text("English")');
  await sleep(300);
  const en = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
  }));
  check('A switched to English: html lang is en-US', en.lang === 'en-US', JSON.stringify(en));
  check(
    'A switched to English: English title',
    /[A-Za-z]/.test(en.title) && !/[\u4e00-\u9fff]/.test(en.title),
    en.title,
  );
  check(
    'A switched to English: English description',
    /[A-Za-z]/.test(en.description ?? '') && !/[\u4e00-\u9fff]/.test(en.description ?? ''),
    en.description,
  );

  await page.reload();
  await page.waitForSelector('.path');
  const enAfterReload = await page.evaluate(() => ({
    lang: document.documentElement.lang,
    title: document.title,
    description: document.querySelector('meta[name="description"]')?.getAttribute('content'),
  }));
  check(
    'A English persists across reload (initial effect)',
    enAfterReload.lang === 'en-US' && enAfterReload.title === en.title,
    JSON.stringify(enAfterReload),
  );
  await ctx.close();
}

/* ---- B: locked lesson nodes are real disabled buttons (P2-5) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await newPage(ctx);
  await page.goto(BASE);
  await page.waitForSelector('.path');
  const nodes = await page.evaluate(() =>
    Array.from(document.querySelectorAll('.path .node')).map((el) => ({
      className: el.className,
      disabled: el.disabled,
      aria: el.getAttribute('aria-label'),
      tag: el.tagName,
    })),
  );
  const locked = nodes.filter((n) => n.className.includes('locked'));
  check('B 16 locked nodes rendered', locked.length === 16, String(locked.length));
  check(
    'B every locked node is a disabled button',
    locked.every((n) => n.tag === 'BUTTON' && n.disabled),
    JSON.stringify(locked.slice(0, 2)),
  );
  check(
    'B locked nodes announce they are locked',
    locked.every((n) => /（未解锁）$/.test(n.aria ?? '')),
    JSON.stringify(locked[1]?.aria),
  );
  const next = nodes.find((n) => n.className.includes('next'));
  check(
    'B the up-next node stays enabled',
    next && !next.disabled && next.aria && !/未解锁/.test(next.aria),
    JSON.stringify(next),
  );
  check(
    'B zero console errors so far',
    consoleProblems.length === 0,
    JSON.stringify(consoleProblems.slice(0, 3)),
  );
  await ctx.close();
}

/* ---- C: a match mispair records the exact confusion pair (P1-1) ---- */
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
  });
  page = await newPage(ctx);
  await page.goto(BASE);
  await page.waitForSelector('.path');
  await jsClick('button.node.next'); // u1l1
  await page.waitForSelector('.prompt.teach');
  await exitTeach();
  const mispaired = await driveSession({ mispairOnce: true });
  check('C a mispair was actually played', Boolean(mispaired), JSON.stringify(mispaired));
  await page.waitForSelector('.hero');

  const { profile, events } = await readLearnerState();
  const matchEvents = events.filter((e) => e.exerciseId === 'u1l1f');
  const wrong = matchEvents.find((e) => !e.correct);
  const rerun = matchEvents.find((e) => e.correct);
  check(
    'C the mispair attempt is on record',
    Boolean(wrong),
    JSON.stringify(matchEvents.map((e) => e.correct)),
  );
  check('C the corrective rerun is on record', Boolean(rerun));

  const ids = wrong.answer.split(':'); // "match:<leftId>:<rightId>"
  check(
    'C the wrong answer carries both selected ids (structured)',
    ids[0] === 'match' && ids.length === 3 && ids[1] !== ids[2],
    wrong.answer,
  );
  check(
    'C the answer carries exactly the picked left/right ids',
    ids[1] === mispaired.leftId && ids[2] === mispaired.rightId,
    `${wrong.answer} vs ${JSON.stringify(mispaired)}`,
  );
  const pairId = ids.slice(1).sort().join('::');
  check(
    'C the attempt pins the exact confusion pair',
    wrong.confusionPairId === pairId,
    `${wrong.confusionPairId} vs ${pairId}`,
  );
  const expectedConcepts = ids
    .slice(1)
    .filter((id) => CONCEPT_IDS.has(id))
    .sort();
  check(
    'C attempt conceptIds are exactly the confused (published) concepts',
    JSON.stringify([...wrong.conceptIds].sort()) === JSON.stringify(expectedConcepts),
    JSON.stringify(wrong.conceptIds),
  );

  const mastery = profile.mastery[pairId];
  check(
    'C the exact pair has a mastery entry',
    Boolean(mastery),
    JSON.stringify(Object.keys(profile.mastery)),
  );
  // later correct hedge/pledge prompts may walk the ladder back up, but the
  // mispair lapse itself must stay on record and keep the pair scheduled
  check(
    'C the entry carries exactly the mispair lapse',
    mastery && mastery.lapses === 1,
    JSON.stringify(mastery),
  );
  const dueIn = mastery ? (Date.parse(mastery.dueAt) - Date.now()) / 3_600_000 : NaN;
  check(
    'C the pair is scheduled for future review',
    Number.isFinite(dueIn) && dueIn > 0 && dueIn < 24 * 31,
    String(dueIn),
  );
  check(
    'C zero console errors so far',
    consoleProblems.length === 0,
    JSON.stringify(consoleProblems.slice(0, 3)),
  );
  await ctx.close();
}

/* ---- D: a malformed import is rejected, not fatal (P1-2) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  page = await newPage(ctx);
  await page.goto(BASE);
  await page.waitForSelector('.path');
  const xpBefore = Number((await page.$eval('.stat.xp', (el) => el.textContent)).replace(/\D/g, ''));

  await page.click('.nav button:nth-child(4)');
  await page.waitForSelector('.file-button');
  const malformed = {
    schemaVersion: 1,
    learnerState: {
      version: 1,
      xp: 999,
      streak: 3,
      completedLessonIds: [],
      seenConceptIds: [],
      mastery: {},
      attempts: [{ eventId: 'x' }],
    },
  };
  await page.setInputFiles('.file-button input', {
    name: 'malformed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(malformed)),
  });
  await sleep(400);
  check(
    'D the import is refused with the friendly message',
    dialogMessages.some((m) => m.includes('不是兼容')),
    JSON.stringify(dialogMessages),
  );

  await page.reload();
  await page.waitForSelector('.path');
  const xpAfter = Number((await page.$eval('.stat.xp', (el) => el.textContent)).replace(/\D/g, ''));
  check('D the live state is untouched (xp unchanged)', xpAfter === xpBefore, `${xpBefore} -> ${xpAfter}`);
  check(
    'D no page errors from the malformed import',
    consoleProblems.length === 0,
    JSON.stringify(consoleProblems.slice(0, 3)),
  );
  await ctx.close();
}

/* ---- E: the update banner activates the waiting service worker (P1-3) ---- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  page = await newPage(ctx);
  await page.goto(BASE);
  await page.waitForSelector('.path');
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => true));
  await page.reload();
  await page.waitForSelector('.path');
  const v1 = await page.evaluate(
    () => document.querySelector('meta[name="build-marker"]')?.getAttribute('content') ?? 'v1',
  );

  // ship "v2": marker in index.html changes the precache revision -> waiting worker
  const indexHtml = path.join(REPO, 'apps/web/index.html');
  const original = fs.readFileSync(indexHtml, 'utf8');
  fs.writeFileSync(
    indexHtml,
    original.replace(
      '<meta name="theme-color"',
      '<meta name="build-marker" content="v2" /><meta name="theme-color"',
    ),
  );
  try {
    execSync('npx vite build', { cwd: REPO, stdio: 'pipe' });
    await page.reload();
    await page.waitForSelector('.path');
    await page.waitForSelector('.update', { timeout: 10000 });
    check('E the update banner appears for the waiting worker', true);
    await page.click('.update');
    await page.waitForFunction(
      () => document.querySelector('meta[name="build-marker"]')?.getAttribute('content') === 'v2',
      null,
      { timeout: 15000 },
    );
    check('E the new worker took over: the reloaded page is v2', true);
    const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
    check('E the page is still SW-controlled after the update', controlled);
  } catch (error) {
    check('E update flow reached v2', false, String(error.message ?? error).slice(0, 200));
  } finally {
    fs.writeFileSync(indexHtml, original);
    execSync('npx vite build', { cwd: REPO, stdio: 'pipe' }); // restore dist to the committed sources
  }
  check(
    'E zero console errors so far',
    consoleProblems.length === 0,
    JSON.stringify(consoleProblems.slice(0, 3)),
  );
  await ctx.close();
}

await browser.close();

const failed = results.filter((r) => !r.pass);
console.log(
  `\n==== verify-fixes summary: ${results.length - failed.length}/${results.length} checks passed ====`,
);
if (failed.length) {
  failed.forEach((f) => console.log('FAILED:', f.name));
  process.exit(1);
}
