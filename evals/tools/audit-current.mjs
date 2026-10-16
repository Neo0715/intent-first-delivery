// audit-current.mjs —— 把 SKILL.md 里【当前正在发布】的 description，对回已归档的判定器证据。
//
// 它回答 score.mjs 答不了的问题：**现在随包发布的这段 description，是不是被评测过的那段？**
// 评测后只要改过 description，手上所有数字就不再描述正在发布的东西。
//
// 判定顺序（任何一步不过，都不给 PASS）：
//   1. 从 SKILL.md frontmatter 取 description（只支持单行标量；块标量/多行在边界外，见文件末注释）
//   2. 与 evals/raw/descriptions.txt 里各版按「压缩空白后逐字符相等」匹配 → 得到版本号 + 版本哈希
//   3. 找到该版本的原始判定输出（raw/<vN>-raw.txt，兼容 raw/<vN>/*.txt 与 raw/<vN>-runN-raw.txt）
//   4. 【试次完整性】被覆盖的每个查询集，每条查询都必须凑满 defaults.runs_per_query 次有效试次；
//      有任何一条缺失 → 直接判 TRIALS MISSING，**不得 PASS**
//   5. 打分；把失败项分成两类：
//        · 已接受偏差 —— 该 id 出现在 final-report.md 的「已接受的偏差」小节里（不是出现在文档任意位置）
//        · 待处理 —— 其余失败，一律算「原因未定 / 待复测」
//   6. 若同一版本有多轮独立运行，额外报出运行间翻转的查询（方差）
//
// 用法: node audit-current.mjs [技能根目录]
// 退出码: 0 = 通过（PASS / PASS WITH ACCEPTED DEVIATION）；2 = 未匹配到任何记录；1 = 其他问题。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(process.argv[2] ?? path.join(here, '..', '..'));
const skillFile = path.join(root, 'SKILL.md');
const evalsDir = path.join(root, 'evals');
const rawDir = path.join(evalsDir, 'raw');
const descriptionsFile = path.join(rawDir, 'descriptions.txt');
const finalReport = path.join(evalsDir, 'final-report.md');

const squash = (s) => s.replace(/\s+/g, '');
const sha256 = (s) => crypto.createHash('sha256').update(s, 'utf8').digest('hex');
const SETS = [
  { file: 'trigger_queries.json', label: '迭代集', key: 'iteration' },
  { file: 'regression_queries.json', label: '回归集', key: 'regression' },
  { file: 'generalization_queries.json', label: '泛化集', key: 'generalization' },
];

// ---------- 1. live description ----------
// 边界：只解析 frontmatter 里的单行标量 `description: <文本>`（本包各版都是这种形式）。
// 不处理块标量（`description: |`）、YAML 引号转义、行内注释——遇到这些形式会明确报错而不是猜。
function liveDescription(file) {
  const text = fs.readFileSync(file, 'utf8');
  const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!fm) return { error: 'SKILL.md 开头没有闭合的 frontmatter 块' };
  const line = fm[1].split(/\r?\n/).find((l) => /^description\s*:/.test(l));
  if (!line) return { error: 'frontmatter 里没有 description 行' };
  if (/^description\s*:\s*[|>]/.test(line)) return { error: 'description 是块标量，本脚本的解析边界之外（拒绝猜测）' };
  return { value: line.replace(/^description\s*:\s*/, '').replace(/\s+#.*$/, '').trim() };
}

const live = liveDescription(skillFile);
if (live.error) { console.error(`无法取得当前 description：${live.error}`); process.exit(1); }
const liveKey = squash(live.value);
const liveHash = sha256(liveKey);
console.log(`live description: ${live.value.length} 字符`);
console.log(`  hash(squashed)=${liveHash}`);
console.log(`  "${live.value.slice(0, 56)}..."`);

// ---------- 2. 匹配版本 ----------
function parseDescriptions() {
  if (!fs.existsSync(descriptionsFile)) return [];
  const lines = fs.readFileSync(descriptionsFile, 'utf8').split(/\r?\n/);
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^===\s*(v\d+)\s*\((\d+)\s*字符\)\s*===\s*$/);
    if (!m) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t) continue;
      if (t.startsWith('===')) break;
      out.push({ name: m[1], len: Number(m[2]), text: t, hash: sha256(squash(t)) });
      break;
    }
  }
  return out;
}
const versions = parseDescriptions();
if (!versions.length) { console.error('未找到 descriptions.txt 或其中没有版本记录'); process.exit(2); }
const match = versions.find((v) => v.hash === liveHash);
if (!match) {
  console.log('\n❌ 没有任何已记录版本与当前 description 相符。');
  console.log('   => SKILL.md 里的这段 description 从未被评测，或评测后被改过。');
  console.log('   在信任本次构建前，用 build-prompts.mjs 重生成判定提示词并重跑。');
  process.exit(2);
}
console.log(`\n匹配到记录: ${match.name}（记录 ${match.len} 字符 / live ${live.value.length} 字符）→ 版本哈希相符`);

// ---------- 3. 找该版本的原始输出 ----------
const runRe = new RegExp(`^${match.name}(-run\\d+)?(-raw)?\\.txt$`, 'i');
const candidates = [];
const versionDir = path.join(rawDir, match.name);
if (fs.existsSync(versionDir)) {
  for (const f of fs.readdirSync(versionDir)) if (f.endsWith('.txt')) candidates.push(path.join(versionDir, f));
}
for (const f of fs.readdirSync(rawDir)) {
  if (!f.endsWith('.txt')) continue;
  if (f === `${match.name}-raw.txt` || new RegExp(`^${match.name}-run\\d+(-raw)?\\.txt$`, 'i').test(f)) {
    candidates.push(path.join(rawDir, f));
  }
}
const primary = path.join(rawDir, `${match.name}-raw.txt`);
const primaryFiles = fs.existsSync(primary) ? [primary] : candidates;
if (!primaryFiles.length) { console.error(`❌ 缺少 ${match.name} 的原始判定输出（raw/${match.name}-raw.txt 或 raw/${match.name}/*.txt）`); process.exit(1); }
const runs = [...new Set([primaryFiles[0], ...candidates])];
console.log(`原始输出：${runs.map((f) => path.relative(rawDir, f)).join(', ')}`);

// ---------- 4. 标准答案 + 逐轮解析 ----------
const RE_A = /^\s*\[?\s*消息?\s*([A-Z]{1,2}\d{1,2})\s*\]?\s*trial\s*([1-9])\s*[:：]\s*(YES|NO|是|否)\s*(?:\|\s*(.*))?$/i;
const RE_B = /^\s*\[?\s*([A-Z]{1,2}\d{1,2})\s*\]?\s*trial\s*([1-9])\s*[:：]\s*(YES|NO|是|否)\s*(?:\|\s*(.*))?$/i;

function parseRaw(file) {
  const map = new Map();
  for (const raw of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = raw.match(RE_A) || raw.match(RE_B);
    if (!m) continue;
    const id = m[1].toUpperCase();
    if (!map.has(id)) map.set(id, { trials: {}, reason: '' });
    const e = map.get(id);
    e.trials[Number(m[2])] = /^(YES|是)$/i.test(m[3]);
    if (!e.reason && m[4]) e.reason = m[4].trim();
  }
  return map;
}

const sets = SETS.map((s) => {
  const p = path.join(evalsDir, s.file);
  if (!fs.existsSync(p)) return { ...s, queries: [] };
  return { ...s, queries: JSON.parse(fs.readFileSync(p, 'utf8')).queries ?? [] };
});
const iterDefaults = JSON.parse(fs.readFileSync(path.join(evalsDir, 'trigger_queries.json'), 'utf8')).defaults ?? {};
const RUNS_EXPECTED = iterDefaults.runs_per_query ?? 3;
const THRESHOLD = iterDefaults.pass_threshold ?? 0.5;

const perRun = runs.map((f) => ({ file: f, map: parseRaw(f) }));

// 每个集合各自选「该集合的主运行文件」：
//   迭代集 / 回归集 → <vN>-raw.txt（primary）
//   泛化集         → gen-<vN>-raw.txt
// 这样泛化集的失败项（G*）也会进入失败分类，不会被「未评测」蒙混过去。
const genFile = path.join(rawDir, `gen-${match.name}-raw.txt`);
const genRun = fs.existsSync(genFile) ? { file: genFile, map: parseRaw(genFile) } : null;
if (genRun) console.log(`泛化集原始输出：${path.relative(rawDir, genRun.file)}`);
else console.log(`泛化集原始输出：未找到 raw/gen-${match.name}-raw.txt —— 泛化集不会被审计到`);

const primaryFile = primaryFiles[0];
const primaryRun = { file: primaryFile, map: perRun[0].map };
const sourceOf = (s) => (s.key === 'generalization' ? genRun : primaryRun);

const coveredSets = sets.filter((s) => {
  const src = sourceOf(s);
  return src && s.queries.some((q) => src.map.has(String(q.id).toUpperCase()));
});
if (!coveredSets.length) {
  console.error('❌ 主运行里没有出现任何已知查询'); process.exit(1);
}

// ---------- 5. 试次完整性（硬门禁）----------
const incomplete = [];
const rows = [];
for (const s of coveredSets) {
  const src = sourceOf(s);
  for (const q of s.queries) {
    const id = String(q.id).toUpperCase();
    const e = src.map.get(id);
    const n = e ? Object.keys(e.trials).length : 0;
    if (n < RUNS_EXPECTED) incomplete.push({ id, set: s.label, got: n, expected: RUNS_EXPECTED });
    const yes = e ? Object.values(e.trials).filter(Boolean).length : 0;
    const rate = n ? yes / n : 0;
    const predicted = rate >= THRESHOLD;
    rows.push({ id, set: s.label, should: !!q.should_trigger, rate, n, predicted, pass: predicted === !!q.should_trigger, reason: e?.reason ?? '', src: path.relative(rawDir, src.file) });
  }
}
rows.sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));

const stat = (sub) => {
  const pos = sub.filter((r) => r.should), neg = sub.filter((r) => !r.should);
  return {
    total: sub.length, passed: sub.filter((r) => r.pass).length,
    recall: pos.length ? pos.filter((r) => r.predicted).length / pos.length : NaN,
    spec: neg.length ? neg.filter((r) => !r.predicted).length / neg.length : NaN,
  };
};
const usedFiles = [...new Set(rows.map((r) => r.src))];
console.log(`\n=== ${match.name} 主运行打分（${usedFiles.join('  +  ')}）===`);
for (const s of coveredSets) {
  const sub = rows.filter((r) => r.set === s.label);
  const t = stat(sub);
  console.log(`${s.label}: ${t.passed}/${t.total} = ${(t.passed / t.total * 100).toFixed(1)}%  recall ${(t.recall * 100).toFixed(1)}%  specificity ${(t.spec * 100).toFixed(1)}%`);
}
const all = stat(rows);
console.log(`合计: ${all.passed}/${all.total} = ${(all.passed / all.total * 100).toFixed(1)}%`);
const notCovered = sets.filter((s) => !coveredSets.includes(s));
if (notCovered.length) console.log(`（未评测的集合：${notCovered.map((s) => s.label).join(', ')}）`);

// ---------- 6. 失败分类 ----------
const failures = rows.filter((r) => !r.pass);
function acceptedIds(report) {
  if (!report) return new Set();
  const ids = new Set();
  let inSec = false;
  for (const line of report.split(/\r?\n/)) {
    const h = line.match(/^(#{2,5})\s*(.+?)\s*$/);
    if (h) {
      if (/已接受的偏差|已接受偏差|accepted deviation/i.test(h[2])) { inSec = true; continue; }
      if (inSec) inSec = false;
      continue;
    }
    if (inSec) for (const mm of line.matchAll(/\b([A-Z]{1,2}\d{1,2})\b/g)) ids.add(mm[1]);
  }
  return ids;
}
const report = fs.existsSync(finalReport) ? fs.readFileSync(finalReport, 'utf8') : '';
const accepted = acceptedIds(report);
const acceptedFailures = failures.filter((f) => accepted.has(f.id));
const unresolved = failures.filter((f) => !accepted.has(f.id));

console.log(`\n=== 失败项分类（共 ${failures.length}）===`);
console.log(`  已接受的偏差（写在 final-report.md「已接受的偏差」小节里）: ${acceptedFailures.length ? acceptedFailures.map((f) => f.id).join(', ') : '无'}`);
console.log(`  原因未定 / 待复测（不得算作已处理）: ${unresolved.length ? unresolved.map((f) => f.id).join(', ') : '无'}`);
for (const f of failures) {
  const kind = f.should ? '漏触发(FN)' : '误触发(FP)';
  const tag = accepted.has(f.id) ? '已接受偏差' : '待处理';
  console.log(`    - [${f.id}] ${kind} | ${f.set} | ${f.rate.toFixed(2)}（${f.n} 次）| ${tag} | ${f.reason}`);
}

// ---------- 7. 方差（同一版本多轮）----------
if (perRun.length > 1) {
  const common = rows.map((r) => r.id).filter((id) => perRun.every((p) => p.map.has(id)));
  const flips = common.filter((id) => {
    const preds = perRun.map((p) => {
      const e = p.map.get(id);
      const t = Object.values(e.trials);
      return t.filter(Boolean).length / t.length >= THRESHOLD;
    });
    return preds.some((x) => x !== preds[0]);
  });
  const totals = perRun.map((p) => common.filter((id) => {
    const e = p.map.get(id);
    const t = Object.values(e.trials);
    const predicted = t.filter(Boolean).length / t.length >= THRESHOLD;
    const should = rows.find((r) => r.id === id).should;
    return predicted === should;
  }).length);
  console.log(`\n=== 运行间方差（同一版本 ${perRun.length} 轮）===`);
  totals.forEach((t, i) => console.log(`  r${i + 1}（${path.basename(perRun[i].file)}）: ${t}/${common.length}`));
  console.log(`  通过数范围: ${Math.min(...totals)}–${Math.max(...totals)}`);
  console.log(`  判定翻转的查询: ${flips.length ? flips.join(', ') : '无'}`);
}

// ---------- 8. verdict ----------
console.log('\n=== verdict ===');
if (incomplete.length) {
  console.log(`❌ TRIALS MISSING：以下查询没有凑满 ${RUNS_EXPECTED} 次有效试次，本次审计不得判 PASS：`);
  for (const i of incomplete) console.log(`    - [${i.id}] ${i.set}: ${i.got}/${i.expected} 次`);
  process.exit(1);
} else if (!failures.length) {
  console.log('✅ PASS：当前 description 与记录一致，覆盖到的每个查询都通过，且试次完整。');
  process.exit(0);
} else if (!unresolved.length) {
  console.log('✅ PASS WITH ACCEPTED DEVIATION：所有失败项都在 final-report.md 的「已接受的偏差」里写明了接受理由。');
  process.exit(0);
} else {
  console.log(`⚠ ATTENTION：有 ${unresolved.length} 条失败没有书面处置（${unresolved.map((f) => f.id).join(', ')}）。`);
  console.log('   要么修 description，要么把决策写进 final-report.md 的「已接受的偏差」小节。');
  process.exit(1);
}
