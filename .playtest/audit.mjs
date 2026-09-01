import fs from 'node:fs';

const html = fs.readFileSync('../Hedge-or-Pledge.html', 'utf8');
// extract the data section (TERMS through LESSONS) and eval it standalone
const start = html.indexOf('const TERMS = {');
const end = html.indexOf('/* ========== STATE');
const code = html.slice(start, end);
// TERM_ART etc live later in the file; data section only needs M/T/F/S/K which are inside the slice
const TERMSx = {};
eval(code + '\nglobalThis.__T = TERMS; globalThis.__U = UNITS; globalThis.__L = LESSONS;');
const TERMS = globalThis.__T,
  UNITS = globalThis.__U,
  LESSONS = globalThis.__L;

const allPrompts = LESSONS.flatMap((l) => l.prompts);
console.log('lessons:', LESSONS.length, 'unique prompts:', new Set(allPrompts.map((p) => p.id)).size);
console.log('terms:', Object.keys(TERMS).length);

// term coverage
const count = {};
for (const p of allPrompts) for (const id of p.termIds || []) count[id] = (count[id] || 0) + 1;
const under = Object.keys(TERMS).filter((id) => (count[id] || 0) < 2);
console.log('terms with <2 prompts:', under.length ? under : 'none');

// exercise types per lesson
for (const l of LESSONS) {
  const types = [...new Set(l.prompts.map((p) => p.type))];
  const flags = [];
  if (types.length < 3) flags.push('LESS THAN 3 TYPES');
  if (!l.review && l.id !== 'u1l1' && !types.includes('scenario'))
    flags.push('NO SCENARIO (mandatory after U1L1)');
  if (types.length === 1 && types[0] === 'match') flags.push('MATCHING-ONLY');
  console.log(l.id, l.prompts.length, 'prompts,', types.join('+'), flags.join(' ') || 'ok');
}

// content rules per term
for (const [id, t] of Object.entries(TERMS)) {
  const miss = [];
  if (!t.definition) miss.push('def');
  if (!t.example) miss.push('example');
  if (!t.mixUp) miss.push('mixUp');
  if (!t.caption) miss.push('caption');
  if (!TERMS[t.mixUp]) miss.push('mixUp not a term: ' + t.mixUp);
  if (miss.length) console.log('TERM', id, 'missing:', miss.join(', '));
}
// lesson/unlock chain sanity
console.log(
  'unit review callbacks: u2r has pledge prompt?',
  LESSONS.find((l) => l.id === 'u2r').prompts.some((p) => p.termIds.includes('pledge')),
);
// hearts/XP constants vs PRD
console.log('---');
console.log(
  'bank sizes (fill):',
  allPrompts
    .filter((p) => p.type === 'fill')
    .map((p) => p.bank.length)
    .join(','),
);
console.log(
  'option counts (meaning/scenario):',
  [...new Set(allPrompts.filter((p) => p.options).map((p) => p.options.length))].join(','),
);
console.log(
  'match pair counts:',
  [...new Set(allPrompts.filter((p) => p.type === 'match').map((p) => p.pairs.length))].join(','),
);
