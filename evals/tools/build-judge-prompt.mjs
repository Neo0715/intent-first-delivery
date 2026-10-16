// 生成触发评测的「判定器提示词」。随包分发，自包含：查询集与默认试次数都从包内读取。
//
// 用法: node tools/build-judge-prompt.mjs <descFile.txt> <outFile> [id,id,id...]
//   <descFile.txt>  只含候选 description 值的纯文本文件（不要 frontmatter）
//   <outFile>       写出的提示词文件；若该路径没有任何扩展名，自动补 .md
//   [id,id,...]     可选。只评测这些查询 id；省略则用 trigger_queries.json 里的全部查询
//
// 依赖: 同包内的 ../trigger_queries.json（相对本脚本位置解析，无绝对路径）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const QUERIES_PATH = path.resolve(HERE, '..', 'trigger_queries.json');

const [descFile, outArg, idsArg] = process.argv.slice(2);
if (!descFile || !outArg) {
  console.error('usage: node tools/build-judge-prompt.mjs <descFile> <outFile> [id,id,...]');
  process.exit(1);
}

const data = JSON.parse(fs.readFileSync(QUERIES_PATH, 'utf8'));
const RUNS = data.defaults?.runs_per_query ?? 3;

const DESCRIPTION = fs.readFileSync(path.resolve(process.cwd(), descFile), 'utf8').trim();
if (DESCRIPTION.length > 1024) throw new Error(`description is ${DESCRIPTION.length} chars — over the 1024 limit`);

const byId = new Map(data.queries.map((q) => [q.id, q]));
const ids = (idsArg ? idsArg.split(',') : data.queries.map((q) => q.id)).map((s) => s.trim()).filter(Boolean);
const picked = ids.map((id) => {
  const q = byId.get(id);
  if (!q) throw new Error(`unknown query id ${id}`);
  return q;
});

const TRIAL_LIST = Array.from({ length: RUNS }, (_, i) => i + 1).join('/');
// 与历史判定器提示词逐字一致：试次数为 3 时这里用中文数字「三」
const CN = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];
const RUNS_CN = CN[RUNS] ?? String(RUNS);

const CATALOG = `<available_skills>
- \`diagnose-windows-sandbox-acl\`: Use on Windows for unexpected DSH sandbox access denials: workspace writes or listing fail, or an ordinarily readable path cannot be read. One bundled command inspects the path and every ancestor and repairs the ACL problems it proves in that same run. Expected confinement denials need no ACL repair.
- \`intent-first-delivery\`: ${DESCRIPTION}
</available_skills>`;

const PROMPT = `# 任务：判断技能触发（纯判断，不要执行任何真实任务）

你在模拟一个 agent 在接到用户消息后的**第一个决策**：查一遍可用技能目录，决定要不要加载某个技能。

## 可用技能目录（只有这两个）

${CATALOG}

## 决策规则（严格按此执行）

你唯一的判断依据是上面技能目录里的 \`name\` 和 \`description\`。**不要去读这两个技能的文件，不要用任何工具探索，不要试图真的完成用户的请求。** 你只需要回答一个问题：

> 看到这条用户消息，我会不会调用 \`skill\` 工具去加载 \`intent-first-delivery\`？

判断标准：这条消息要的东西，是否**必须先澄清意图 / 先定验收标准 / 先取证**才能保证做对？

## 独立试次

每条消息要**独立判断 ${RUNS} 次**（记为 trial ${TRIAL_LIST}）。三次之间**必须互不影响**：不要把前一次的判断当成依据，不要为了凑数而改口，也不要假设三次应该一致。每次都在心里重新做一遍这个决策。

## 输出格式（严格遵守，不要加别的段落）

对你收到的每条消息，输出${RUNS_CN}行：

\`\`\`
${Array.from({ length: RUNS }, (_, i) => `[消息编号] trial${i + 1}: YES|NO | 一句话理由（≤20字）`).join('\n')}
\`\`\`

YES = 会加载 intent-first-delivery；NO = 不会加载。
最后不要写总结、不要写建议、不要评价这套技能好不好。

---

# 你要判断的消息（共 ${picked.length} 条，每条判断 ${RUNS} 次）

${picked.map((q) => `--- 消息 ${q.id} ---\n${q.query}`).join('\n\n')}
`;

const out = path.extname(outArg) ? outArg : `${outArg}.md`;
fs.mkdirSync(path.dirname(path.resolve(process.cwd(), out)), { recursive: true });
fs.writeFileSync(path.resolve(process.cwd(), out), PROMPT, 'utf8');
console.log(`wrote ${out}  (${picked.length} messages: ${ids.join(', ')})  desc=${DESCRIPTION.length} chars  runs=${RUNS}`);
