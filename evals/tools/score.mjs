// score.mjs —— 解析判定器输出（每条消息 3 行: "<ID> trialN: YES|NO | reason"）并打分。
//
// 随包分发，自包含：标准答案与划分都从同包 JSON 读取，全部路径从脚本自身位置解析。
//   trigger_queries.json        迭代集 22 条（含 train / validation 划分）
//   regression_queries.json     回归集 12 条（v4 后保留，已参与过优化决策）
//   generalization_queries.json 泛化集 10 条（从未参与任何一轮 description 修改）
//
// 三个集合各自单独报分，最后给一个合计。每条查询的试次数取自 defaults.runs_per_query，
// 不足时在该行标 ⚠ 并在末尾警告——**试次不足的查询不应被当作通过**。
//
// 用法: node tools/score.mjs <judge-output-file> [<judge-output-file> ...]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVALS = path.resolve(HERE, '..');

const load = (name) => {
  const p = path.join(EVALS, name);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};

const iter = load('trigger_queries.json');
const regression = load('regression_queries.json');
const generalization = load('generalization_queries.json');

const THRESHOLD = iter?.defaults?.pass_threshold ?? 0.5;
const RUNS = iter?.defaults?.runs_per_query ?? 3;
const split = iter?.split ?? {};

// id -> { should, set }
const meta = new Map();
const register = (data, setLabel) => {
  for (const q of (data?.queries ?? [])) {
    meta.set(String(q.id).toUpperCase(), { should: !!q.should_trigger, set: setLabel });
  }
};
register(iter, 'iteration');
register(regression, 'regression');
register(generalization, 'generalization');

const SET_LABEL = { iteration: '迭代集', regression: '回归集', generalization: '泛化集' };
const SET_ORDER = ['iteration', 'regression', 'generalization'];

const lineRe = /^\s*\[?\s*消息?\s*([A-Z]{1,2}\d{1,2})\s*\]?\s*trial\s*([1-9])\s*[:：]\s*(YES|NO|是|否)\s*(?:\|\s*(.*))?$/i;
const lineReBare = /^\s*\[?\s*([A-Z]{1,2}\d{1,2})\s*\]?\s*trial\s*([1-9])\s*[:：]\s*(YES|NO|是|否)\s*(?:\|\s*(.*))?$/i;

const results = new Map(); // id -> { trials: {n: bool}, reasons: [] }
let unparsed = 0;

for (const file of process.argv.slice(2)) {
  const text = fs.readFileSync(file, 'utf8');
  for (const raw of text.split(/\r?\n/)) {
    const m = raw.match(lineRe) || raw.match(lineReBare);
    if (!m) {
      if (raw.trim() && /trial/i.test(raw)) { unparsed++; console.log('UNPARSED:', raw.trim().slice(0, 120)); }
      continue;
    }
    const id = m[1].toUpperCase();
    const trial = Number(m[2]);
    const yes = /^(YES|是)$/i.test(m[3]);
    const reason = (m[4] || '').trim();
    if (!results.has(id)) results.set(id, { trials: {}, reasons: [] });
    const r = results.get(id);
    r.trials[trial] = yes;
    if (trial === 1) r.reasons.push(reason);
  }
}

const rows = [];
for (const [id, r] of results) {
  const m = meta.get(id);
  if (!m) continue; // 不在任何已知集合里，忽略
  const trials = [1, 2, 3, 4, 5].map((t) => r.trials[t]).filter((v) => v !== undefined);
  const trig = trials.filter(Boolean).length;
  const rate = trials.length ? trig / trials.length : 0;
  const predicted = rate >= THRESHOLD;
  const pass = predicted === m.should;
  rows.push({ id, set: m.set, should: m.should, rate, trig, runs: trials.length, predicted, pass, reason: r.reasons[0] || '' });
}
rows.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

console.log('\n| 消息 | 集合 | 应触发 | 触发率 | 判定 | 结果 | 理由(judge) |');
console.log('|---|---|---|---|---|---|---|');
for (const r of rows) {
  const short = r.runs < RUNS ? ` ⚠试次不足(${r.runs})` : '';
  console.log(`| ${r.id} | ${SET_LABEL[r.set]} | ${r.should ? '是' : '否'} | ${r.trig}/${r.runs} = ${r.rate.toFixed(2)} | ${r.predicted ? '触发' : '不触发'} | ${r.pass ? '✅' : '❌'}${short} | ${r.reason} |`);
}

function stats(subset) {
  const total = subset.length;
  const passed = subset.filter((r) => r.pass).length;
  const pos = subset.filter((r) => r.should);
  const neg = subset.filter((r) => !r.should);
  const fn = subset.filter((r) => r.should && !r.predicted);
  const fp = subset.filter((r) => !r.should && r.predicted);
  const recall = pos.length ? pos.filter((r) => r.predicted).length / pos.length : 0;
  const specificity = neg.length ? neg.filter((r) => !r.predicted).length / neg.length : 0;
  return { total, passed, pos, neg, fn, fp, recall, specificity };
}

function reportSet(label, subset, note = '') {
  if (!subset.length) { console.log(`\n=== ${label} ===\n（本次判定器输出里没有该集合的查询，未评测）`); return; }
  const s = stats(subset);
  console.log(`\n=== ${label}${note ? '（' + note + '）' : ''} ===`);
  console.log(`通过: ${s.passed}/${s.total} = ${(s.passed / s.total * 100).toFixed(1)}%`);
  console.log(`该触发召回率 (recall):        ${(s.recall * 100).toFixed(1)}%  (${s.pos.length - s.fn.length}/${s.pos.length})`);
  console.log(`不该触发特异度 (specificity): ${(s.specificity * 100).toFixed(1)}%  (${s.neg.length - s.fp.length}/${s.neg.length})`);
  if (s.fn.length) console.log(`漏触发 (false negative): ${s.fn.map((r) => r.id).join(', ')}`);
  if (s.fp.length) console.log(`误触发 (false positive): ${s.fp.map((r) => r.id).join(', ')}`);
}

for (const name of Object.keys(split)) {
  const ids = new Set(split[name]);
  const subset = rows.filter((r) => r.set === 'iteration' && ids.has(r.id));
  if (!subset.length) { console.log(`\n=== 划分 ${name} ===\n（本次判定器输出里没有该划分的查询，未评测；共 ${ids.size} 条）`); continue; }
  reportSet(`划分 ${name}`, subset);
}

reportSet('迭代集 全部', rows.filter((r) => r.set === 'iteration'), '22 条：10 该触发 / 12 不该');
reportSet('回归集', rows.filter((r) => r.set === 'regression'), '12 条：4 该触发 / 8 不该；已参与 v5→v6 优化，不构成泛化证据');
reportSet('泛化集', rows.filter((r) => r.set === 'generalization'), '10 条：5 该触发 / 5 不该；从未参与任何一轮 description 修改');

const s = stats(rows);
console.log('\n=== 汇总（本次输出里出现的全部查询）===');
console.log(`通过: ${s.passed}/${s.total} = ${(s.passed / s.total * 100).toFixed(1)}%`);
console.log(`该触发召回率 (recall):        ${(s.recall * 100).toFixed(1)}%  (${s.pos.length - s.fn.length}/${s.pos.length})`);
console.log(`不该触发特异度 (specificity): ${(s.specificity * 100).toFixed(1)}%  (${s.neg.length - s.fp.length}/${s.neg.length})`);
if (s.fn.length) console.log(`漏触发 (false negative): ${s.fn.map((r) => r.id).join(', ')}`);
if (s.fp.length) console.log(`误触发 (false positive): ${s.fp.map((r) => r.id).join(', ')}`);

const insufficient = rows.filter((r) => r.runs < RUNS);
console.log('\n=== 证据完整性 ===');
if (insufficient.length) {
  console.log(`⚠ 以下 ${insufficient.length} 条查询试次不足 ${RUNS}（这些行不得视为通过）:`);
  for (const r of insufficient) console.log(`  - ${r.id}: ${r.runs}/${RUNS} 次`);
} else {
  console.log(`OK: 本次输出里每条查询都凑满 ${RUNS} 次试次。`);
}
const missing = [...meta.keys()].filter((id) => !rows.some((r) => r.id === id));
if (missing.length) console.log(`（另：有 ${missing.length} 条已知查询完全没出现在本次输出里：${missing.join(', ')}）`);
if (unparsed) console.log(`警告: ${unparsed} 行无法解析`);
