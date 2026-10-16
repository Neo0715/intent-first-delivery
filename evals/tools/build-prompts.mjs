// build-prompts.mjs —— 为某一版 description + 某一组查询生成【自包含】的判定提示词文件。
//
// 每个提示词文件里已经嵌好了：可用技能目录（含该版 description 全文）、决策规则、
// 待判消息、输出格式、以及结果落盘路径。判定器子 agent 只需要「读这个文件 → 照做 → 写结果」，
// 因此这批提示词本身就是可归档、可复核的原始材料（谁、拿哪版描述、判了哪些消息，一目了然）。
//
// 用法: node build-prompts.mjs <queries.json> <vN> <runLabel> [outDir]
//   例: node tools/build-prompts.mjs generalization_queries.json v6 gen-v6
//       node tools/build-prompts.mjs trigger_queries.json v6 v6-run2
//
// 输出: <outDir>/<runLabel>-group-<n>.md   每个判定器的完整提示词
//       <outDir>/<runLabel>-group-<n>.txt  该判定器要写入的结果路径（提示词里已指明）
//       <outDir>/<runLabel>-manifest.json  本次运行的版本/哈希/分组登记
// 默认 outDir = evals/raw/prompts。路径都从脚本自身位置解析，与本包一起分发。

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const EVALS = path.resolve(HERE, '..');
const RAW = path.join(EVALS, 'raw');
const DESCRIPTIONS = path.join(RAW, 'descriptions.txt');

const [queriesArg, version, runLabel, outDirArg] = process.argv.slice(2);
if (!queriesArg || !version || !runLabel) {
  console.error('usage: node build-prompts.mjs <queries.json> <vN> <runLabel> [outDir]');
  process.exit(1);
}
const queriesFile = path.resolve(process.cwd(), queriesArg);
const outDir = outDirArg ? path.resolve(process.cwd(), outDirArg) : path.join(RAW, 'prompts');
fs.mkdirSync(outDir, { recursive: true });

const squash = (s) => s.replace(/\s+/g, '');

// --- 1. 取出该版 description 原文 ---
function pickDescription(version) {
  const lines = fs.readFileSync(DESCRIPTIONS, 'utf8').split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^===\s*(v\d+)\s*\((\d+)\s*字符\)\s*===\s*$/);
    if (!m || m[1] !== version) continue;
    for (let j = i + 1; j < lines.length; j++) {
      const t = lines[j].trim();
      if (!t) continue;
      if (t.startsWith('===')) break;
      return t;
    }
  }
  return null;
}
const desc = pickDescription(version);
if (!desc) { console.error(`descriptions.txt 里找不到 ${version} 段`); process.exit(2); }
// 版本哈希：对「压缩空白后的文本」取 sha256，这样换行/缩进差异不会改变同一段文本的身份
const descHash = crypto.createHash('sha256').update(squash(desc), 'utf8').digest('hex');

// --- 2. 取查询并按 4 条一组切分 ---
const data = JSON.parse(fs.readFileSync(queriesFile, 'utf8'));
const queries = data.queries ?? [];
const runs = data.defaults?.runs_per_query ?? 3;
if (!queries.length) { console.error(`${queriesFile} 里没有 queries`); process.exit(2); }
const CHUNK = 4;
const groups = [];
for (let i = 0; i < queries.length; i += CHUNK) groups.push(queries.slice(i, i + CHUNK));

// --- 3. 生成提示词 ---
const DISTRACTOR = 'diagnose-windows-sandbox-acl`: Use on Windows for unexpected DSH sandbox access denials: workspace writes or listing fail, or an ordinarily readable path cannot be read. One bundled command inspects the path and every ancestor and repairs the ACL problems it proves in that same run. Expected confinement denials need no ACL repair.';

const manifest = {
  runLabel, version, descChars: desc.length, descHash,
  queriesFile: path.basename(queriesFile),
  runs_per_query: runs, pass_threshold: data.defaults?.pass_threshold ?? 0.5,
  groups: [],
};

groups.forEach((g, gi) => {
  const n = gi + 1;
  const outFile = path.join(outDir, `${runLabel}-group-${n}.txt`);
  const L = [];
  L.push('# 任务：判断技能触发（纯判断，不要执行任何真实任务）', '');
  L.push('你在模拟一个 agent 在接到用户消息后的**第一个决策**：查一遍可用技能目录，决定要不要加载某个技能。', '');
  L.push('## 可用技能目录（只有这两个）', '');
  L.push('<available_skills>');
  L.push(`- \`${DISTRACTOR}`);
  L.push(`- \`intent-first-delivery\`: ${desc}`);
  L.push('</available_skills>', '');
  L.push('## 决策规则（严格按此执行）', '');
  L.push('你唯一的判断依据是上面技能目录里的 `name` 和 `description`。**不要去读这两个技能的文件**，不要用任何工具，不要联网。');
  L.push('你**不要执行用户消息里的任务**，只回答一个问题：看到这条用户消息，我会不会调用 `skill` 工具去加载 `intent-first-delivery`？', '');
  L.push('判断时只问自己：这条消息要产出东西吗？「要什么、做成什么样」定了吗？还有没有必须靠猜才能定的决定？');
  L.push('注意：只要用户已经说清「改哪里、改成什么、怎么算完成」，就不该触发。', '');
  L.push(`## 你要判断的消息（共 ${g.length} 条，每条独立判断 ${runs} 次）`, '');
  for (const q of g) { L.push(`--- 消息 ${q.id} ---`, q.query, ''); }
  L.push('## 输出格式（严格）', '');
  L.push(`每条消息输出 ${runs} 行，格式为：`);
  L.push('[消息 <ID>] trial1: YES|NO | 不超过 20 字的理由');
  L.push('[消息 <ID>] trial2: YES|NO | ...');
  L.push('[消息 <ID>] trial3: YES|NO | ...');
  L.push(`${runs} 次判断必须彼此独立，不要参考同一条消息的前几次结论。`, '');
  L.push('## 落盘要求', '');
  L.push(`判断完成后，把上面全部输出**原样写入这个文件**：`);
  L.push(outFile);
  L.push('（只写那些 trial 行。如果写文件失败，就把同样内容作为你的回答正文返回。）');

  fs.writeFileSync(path.join(outDir, `${runLabel}-group-${n}.md`), L.join('\n'), 'utf8');
  manifest.groups.push({ group: n, ids: g.map((q) => q.id), prompt: path.join(outDir, `${runLabel}-group-${n}.md`), out: outFile });
  console.log(`wrote ${runLabel}-group-${n}.md  [${g.map((q) => q.id).join(', ')}]  -> ${path.basename(outFile)}`);
});

fs.writeFileSync(path.join(outDir, `${runLabel}-manifest.json`), JSON.stringify(manifest, null, 2), 'utf8');
console.log(`\n${version}: ${desc.length} 字符  hash(squash)=${descHash}`);
console.log(`wrote ${runLabel}-manifest.json（${groups.length} 组 / ${queries.length} 条 / ${runs} 次）`);
