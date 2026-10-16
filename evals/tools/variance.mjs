// variance.mjs —— 对【同一个 description 版本】的多轮独立运行做运行间方差分析。
//
// 为什么需要它：拿两版不同 description 的各一次运行去比较，得到的差异里既含「描述改动的影响」
// 也含「判定器本身的运行间噪声」，两者分不开。只有对同一版 description 跑多轮，才能把噪声量出来。
//
// 用法: node tools/variance.mjs <raw1> <raw2> [<raw3> ...]
//   例: node tools/variance.mjs raw/v6-raw.txt raw/v6-run2-raw.txt raw/v6-run3-raw.txt
// 只统计【在所有给定文件里都出现】的查询（这样多轮之间才可比）。

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVALS = path.resolve(HERE, '..');

const load = (n) => {
  const p = path.join(EVALS, n);
  return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
};
const iter = load('trigger_queries.json');
const regression = load('regression_queries.json');
const generalization = load('generalization_queries.json');

const meta = new Map();
const reg = (d, s) => { for (const q of (d?.queries ?? [])) meta.set(String(q.id).toUpperCase(), { should: !!q.should_trigger, set: s }); };
reg(iter, 'iteration'); reg(regression, 'regression'); reg(generalization, 'generalization');
const SET_LABEL = { iteration: '迭代集', regression: '回归集', generalization: '泛化集' };
const THRESHOLD = iter?.defaults?.pass_threshold ?? 0.5;
const RUNS = iter?.defaults?.runs_per_query ?? 3;

const RE_A = /^\s*\[?\s*消息?\s*([A-Z]{1,2}\d{1,2})\s*\]?\s*trial\s*([1-9])\s*[:：]\s*(YES|NO|是|否)/i;
const RE_B = /^\s*\[?\s*([A-Z]{1,2}\d{1,2})\s*\]?\s*trial\s*([1-9])\s*[:：]\s*(YES|NO|是|否)/i;

const files = process.argv.slice(2);
if (files.length < 2) { console.error('至少给两个 raw 文件才能算方差'); process.exit(1); }

const perRun = files.map((f) => {
  const map = new Map();
  for (const raw of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = raw.match(RE_A) || raw.match(RE_B);
    if (!m) continue;
    const id = m[1].toUpperCase();
    if (!meta.has(id)) continue;
    if (!map.has(id)) map.set(id, { yes: 0, total: 0 });
    const e = map.get(id); e.total++;
    if (/^(YES|是)$/i.test(m[3])) e.yes++;
  }
  return map;
});

const common = [...perRun[0].keys()].filter((id) => perRun.every((m) => m.has(id)));
if (common.length < 2) { console.error('各文件里共同出现的查询少于 2 条，无法比较'); process.exit(1); }

const rows = common.map((id) => {
  const rates = perRun.map((m) => { const e = m.get(id); return e.total ? e.yes / e.total : NaN; });
  const preds = rates.map((r) => r >= THRESHOLD);
  const stable = preds.every((p) => p === preds[0]);
  const trials = perRun.map((m) => m.get(id).total);
  return { id, set: meta.get(id).set, should: meta.get(id).should, rates, preds, stable, trials };
}).sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

const pct = (x) => (x * 100).toFixed(0) + '%';

console.log(`\n运行间方差：同一版本 ${files.length} 轮独立运行，共同查询 ${common.length} 条`);
console.log(`文件：${files.map((f) => path.basename(f)).join('  |  ')}\n`);

console.log(`| 消息 | 集合 | 应触发 | ${files.map((_, i) => 'r' + (i + 1)).join(' | ')} | 判定稳定? | 结果 |`);
console.log(`|---|---|---|${files.map(() => '---').join('|')}|---|---|`);
for (const r of rows) {
  const cells = r.rates.map((x) => pct(x));
  const verdict = r.stable ? '稳定' : '**翻转**';
  console.log(`| ${r.id} | ${SET_LABEL[r.set]} | ${r.should ? '是' : '否'} | ${cells.join(' | ')} | ${verdict} | ${r.stable && r.preds[0] === r.should ? '✅' : '⚠'} |`);
}

console.log('\n=== 每轮通过数 ===');
const runTotals = perRun.map((_, i) => {
  const passed = rows.filter((r) => r.preds[i] === r.should).length;
  return { passed, total: rows.length };
});
runTotals.forEach((t, i) => console.log(`  r${i + 1}: ${t.passed}/${t.total} = ${(t.passed / t.total * 100).toFixed(1)}%   (${path.basename(files[i])})`));
const ps = runTotals.map((t) => t.passed);
console.log(`  通过数范围: ${Math.min(...ps)} – ${Math.max(...ps)}（极差 ${Math.max(...ps) - Math.min(...ps)} 条 / ${rows.length} 条）`);

const flipped = rows.filter((r) => !r.stable);
console.log(`\n=== 判定翻转的查询（${flipped.length} / ${rows.length}）===`);
if (!flipped.length) console.log('  无：这一版 description 在这几轮里每条查询的判定都一致。');
for (const r of flipped) {
  const kind = r.should ? '该触发' : '不该触发';
  console.log(`  - ${r.id}（${kind}）：${r.rates.map(pct).join(' / ')} → 判定 ${r.preds.map((p) => (p ? '触发' : '不触发')).join(' / ')}`);
}

const pos = rows.filter((r) => r.should);
const neg = rows.filter((r) => !r.should);
const recallStable = pos.every((r) => r.preds.every((p) => p));
const posUnstable = pos.filter((r) => !r.stable);
const negUnstable = neg.filter((r) => !r.stable);

console.log('\n=== 可以下的结论（只看这几轮证据）===');
console.log(`  正例（该触发）共 ${pos.length} 条：${recallStable ? '在这几轮里每一轮都全部触发（这是观测事实，不等于真实召回率，也不是触发率下界）' : '存在漏触发，召回率不稳定'}${posUnstable.length ? `（其中 ${posUnstable.map((r) => r.id).join(', ')} 有翻转）` : ''}`);
console.log(`  负例（不该触发）共 ${neg.length} 条：${negUnstable.length ? `有 ${negUnstable.length} 条出现翻转：${negUnstable.map((r) => r.id).join(', ')}` : '每轮判定都一致'}`);
console.log(`  单条查询的试次：${[...new Set(rows.flatMap((r) => r.trials))].join('/')} 次（期望 ${RUNS}）`);
const short = rows.filter((r) => r.trials.some((t) => t < RUNS));
if (short.length) console.log(`  ⚠ 试次不足的查询：${short.map((r) => r.id).join(', ')}`);
console.log('\n  注意：以上都是【描述分类代理指标】的运行间噪声，不是真实 agent 的端到端触发率。');
