#!/usr/bin/env node
// validate-spec.mjs — 按 Agent Skills 官方规范的机械条款自检本包。
//
// 为什么有它：官方校验器 skills-ref 在部分环境装不上（本包写作时也装不上）。
// 「装不上」≠「不校验」≠「口头声称合规」。把规范里可机械判定的条款抽出来自查，
// 输出落盘当证据。
//
// ==================== 解析边界（必须读）====================
// 本脚本【零依赖】，frontmatter 用正则解析，只支持**单行标量值**：
//   name: xxx            （值在同一行，无引号或单引号）
//   description: xxx     （值在同一行，不能是 | 或 > 块标量，不能跨行）
// 下列构造在边界之外，会被误读，脚本会单独标出「边界外，结果可能不可信」：
//   - description 用 | 或 > 开头的块标量 / 跨行折叠
//   - 值里含 " #"（会被当成注释截断）
//   - 值带双引号且内含转义（\" 等）
// 本包 description 是单行 467 字符，落在边界内；若你改成块标量，请先升级解析器再跑。
// ==========================================================
//
// 检查项分三档，输出按档分组：
//   [规范要求]   agentskills.io/specification 的硬条款（不满足即不合规）
//   [官方建议]   progressive-disclosure 等建议（<500 行、引用单层、目录约定）
//   [自定义]     本包自加的检查（文件数、全文件行数、description 语义启发式）
//
// 用法：node evals/tools/validate-spec.mjs [技能根目录]
// 退出码：0 = 无 FAIL；1 = 有 FAIL。

import { readFileSync, existsSync, statSync, readdirSync } from 'node:fs'
import { dirname, resolve, basename, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const root = resolve(process.argv[2] ?? join(here, '..', '..'))
const skillFile = join(root, 'SKILL.md')

const results = []
const record = (tier, id, ok, detail) => results.push({ tier, id, ok, detail })

if (!existsSync(skillFile)) {
  console.error(`找不到 ${skillFile}`)
  process.exit(1)
}
const raw = readFileSync(skillFile, 'utf8')

// ---- 全文件行数（自定义）----
const totalLines = raw.replace(/\r?\n$/, '').split(/\r?\n/).length
record('自定义', 'SKILL.md 全文件总行数', totalLines > 0, `${totalLines} 行（含 frontmatter）`)

// ---- frontmatter ----
const fm = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/)
let desc = ''
if (!fm) {
  record('规范要求', 'frontmatter 存在', false, 'SKILL.md 开头没有 --- 包裹的 YAML frontmatter')
} else {
  const body = fm[1]
  // 解析边界探测：块标量指示符 / 行内注释 / 双引号值
  const boundaryWarns = []
  if (/^\s*(description|license|metadata|allowed-tools)\s*:\s*[>|]\s*$/m.test(body)) boundaryWarns.push('检测到 | 或 > 块标量')
  if (/(?<!\\)"#/.test(body) || /"\s*#\s/.test(body)) boundaryWarns.push('值内出现 " #"（可能被当作注释）')
  if (boundaryWarns.length) record('自定义', '解析边界', false, boundaryWarns.join('；') + ' → 以下 frontmatter 结论不可信，请升级解析器')

  const keys = [...body.matchAll(/^([A-Za-z_][\w-]*)\s*:/gm)].map((m) => m[1])
  const name = (body.match(/^name\s*:\s*(.+)$/m)?.[1] ?? '').trim()
  desc = (body.match(/^description\s*:\s*(.+)$/m)?.[1] ?? '').trim()
  const dirName = basename(root)

  record('规范要求', 'frontmatter 存在', true, `解析到 ${keys.length} 个键`)

  const allowed = new Set(['name', 'description', 'license', 'compatibility', 'metadata', 'allowed-tools'])
  const extra = keys.filter((k) => !allowed.has(k))
  record('规范要求', 'frontmatter 键合法', extra.length === 0, extra.length ? `不认识的键: ${extra.join(', ')}` : `键 = ${keys.join(', ')}`)

  record('规范要求', 'name 非空且 ≤64 字符', name.length >= 1 && name.length <= 64, `name = "${name}" (${name.length} 字符)`)
  record('规范要求', 'name 字符合法（小写字母/数字/连字符）', /^[a-z0-9-]+$/.test(name), `实际: "${name}"`)
  record('规范要求', 'name 不以连字符开头或结尾', /^[a-z0-9]/.test(name) && /[a-z0-9]$/.test(name), `实际: "${name}"`)
  record('规范要求', 'name 无连续连字符', !name.includes('--'), `实际: "${name}"`)
  record('规范要求', 'name 与父目录名一致', name === dirName, `name="${name}" vs 目录="${dirName}"`)

  const dLen = [...desc].length // 按码点计，中文一字算一个
  record('规范要求', 'description 非空且 ≤1024 字符', dLen >= 1 && dLen <= 1024, `${dLen} 字符（上限的 ${(dLen / 1024 * 100).toFixed(0)}%）`)
  // 语义「做什么 + 什么时候用」无法机械判定，本项是启发式，归入自定义
  const whatOk = /先确认|对齐意图|动手之前/.test(desc)
  const whenOk = /这几种|情形|反过来|用户已经说清/.test(desc)
  record('自定义', 'description 语义含「做什么」与「什么时候用」（启发式）', whatOk && whenOk, `做什么: ${whatOk}；什么时候用: ${whenOk}`)
}

// ---- body（官方建议）----
const bodyStart = raw.indexOf('\n---\n')
const body = bodyStart >= 0 ? raw.slice(bodyStart + 5) : raw
const bodyLines = body.replace(/\r?\n$/, '').split(/\r?\n/).length
record('官方建议', 'SKILL.md 正文 < 500 行', bodyLines < 500, `${bodyLines} 行`)

// ---- references ----
const refs = new Set()
// 只认「带目录的相对路径」。裸文件名（如 `config.json`）可能是正文业务示例，不算引用。
for (const m of raw.matchAll(/`((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:md|mjs|json|sh|py|txt))`|(?<![\w`./-])((?:[A-Za-z0-9_.-]+\/)+[A-Za-z0-9_.-]+\.(?:md|mjs|json|sh|py|txt))/g)) {
  const p = m[1] ?? m[2]
  if (p.startsWith('..')) { record('官方建议', `引用 ${p} 不越出技能根`, false, '出现 ../ 越级引用'); continue }
  refs.add(p)
}
const missing = []
const deep = []
// evals/tools/ 只豁免「深度」检查，不豁免「存在性」检查：被引用的工具文件必须真实存在。
const depthExempt = (p) => p.startsWith('evals/tools/')
for (const p of [...refs].sort()) {
  if (!existsSync(join(root, p))) missing.push(p)
  if (p.split('/').length > 2 && !depthExempt(p)) deep.push(p)
}
record('官方建议', `引用的文件都存在（${refs.size} 个）`, missing.length === 0, missing.length ? `缺失: ${missing.join(', ')}` : [...refs].sort().join(', '))
record('官方建议', '引用深度不超过一层', deep.length === 0, deep.length ? `过深: ${deep.join(', ')}` : '全部为 assets/x 或 reference/x 或 evals/x 形式')

// ---- 目录约定 + 实际文件数（官方建议 + 自定义）----
let totalFiles = 0
for (const d of ['assets', 'reference', 'evals']) {
  const dir = join(root, d)
  const ok = existsSync(dir) && statSync(dir).isDirectory()
  const n = ok ? readdirCount(dir) : 0
  if (ok) totalFiles += n
  record('官方建议', `约定目录 ${d}/ 存在`, ok, ok ? `${n} 个文件` : '不存在')
}
// 递归统计整个技能根下的文件数（含 SKILL.md / README.md 等根文件）
const rootFileCount = countFilesRecursive(root)
record('自定义', '包内实际文件总数（递归）', rootFileCount > 0, `${rootFileCount} 个`)

function readdirCount(dir) {
  try { return readdirSync(dir).length } catch { return 0 }
}
function countFilesRecursive(p) {
  try {
    const st = statSync(p)
    if (st.isFile()) return 1
    if (st.isDirectory()) return readdirSync(p).reduce((acc, e) => acc + countFilesRecursive(join(p, e)), 0)
  } catch {}
  return 0
}

// ---- 输出（按档分组）----
const pad = (s, n) => s + ' '.repeat(Math.max(0, n - [...s].length))
console.log(`\n技能根: ${root}`)
console.log(`规范依据: https://agentskills.io/specification`)
console.log(`解析边界: 见本文件顶部注释（仅支持单行标量值）\n`)

for (const tier of ['规范要求', '官方建议', '自定义']) {
  const tierResults = results.filter((r) => r.tier === tier)
  if (!tierResults.length) continue
  console.log(`== ${tier} ==`)
  for (const r of tierResults) {
    console.log(`  ${pad(r.id, 44)} ${pad(r.ok ? 'PASS' : 'FAIL', 6)} ${r.detail}`)
  }
  console.log('')
}

const failed = results.filter((r) => !r.ok)
console.log(`合计: ${results.length - failed.length}/${results.length} 通过${failed.length ? `，失败: ${failed.map((f) => f.id).join(' / ')}` : ''}`)
console.log('\n未覆盖（规范不校验或无法机械判定）: 正文写法质量、description 语义质量、触发率。')
console.log('触发率见: evals/trigger_queries.json + evals/tools/score.mjs\n')
process.exit(failed.length ? 1 : 0)
