# 意图优先交付流程（Intent-First Delivery）

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Release](https://img.shields.io/github/v/release/Neo0715/intent-first-delivery?sort=semver)](https://github.com/Neo0715/intent-first-delivery/releases)
[![Stars](https://img.shields.io/github/stars/Neo0715/intent-first-delivery)](https://github.com/Neo0715/intent-first-delivery/stargazers)
![Agent Skills](https://img.shields.io/badge/Agent%20Skills-compatible-2ea44f.svg)

<img src="assets/cover.jpg" alt="意图优先交付 —— 动手之前，先确认「做成什么样才算对」" width="400">

一个 agent skill 包，解决一个具体问题：**agent 没搞清你要什么就开始做，交付后才发现不是你要的。**

## 装到哪里

解压后把整个 `intent-first-delivery/` 目录放进目标 agent 的 skills 目录：

| Agent | 目标路径 |
|---|---|
| DeepSeek Harness | 该 profile 配置的 skills 目录 |
| Claude Code | `.claude/skills/`（项目级）或 `~/.claude/skills/`（个人级） |
| 兼容 Agent Skills 规范的其他 agent | 对应的 skills 目录 |

目录名 `intent-first-delivery` 与 `SKILL.md` 里的 `name` 字段一致，不要改名。

## 目录结构

```
intent-first-delivery/
├── SKILL.md                          主流程（①→⑤ + 门禁 0）
├── README.md                         本文件
├── assets/                           配套模板
│   ├── intent-contract.md            意图契约（目标/边界/验收标准/假设）
│   ├── clarification-checklist.md    澄清清单（歧义清单 + 提问 + 折叠）
│   ├── diagnosis-brief.md            排查简报（复现→最小化→假设→插桩→修复→回归）
│   ├── implementation-plan.md        实施计划（垂直切片 + 依赖 + 风险）
│   ├── prd.md                        需求文档（只写 What/Why）
│   ├── acceptance-evidence.md        验收证据（逐条对照 + 原始输出）
│   ├── convergence-report.md         收敛报告（缺口回流直至收敛）
│   ├── quick-reference.md            一页速查
│   └── cover.jpg                     封面图（README 展示用，流程不引用）
├── evals/                            评测集（可复跑）
│   ├── trigger_queries.json          迭代集：22 条 + 应触发标注 + 理由 + train/validation 划分
│   ├── regression_queries.json       回归集：12 条（原 fresh_queries.json，已按审计改标）
│   ├── generalization_queries.json   泛化集：10 条（本版新写、只跑过一轮，一次性）
│   ├── output_evals.json             2 个输出质量用例 + 断言
│   ├── final-report.md               完整报告：口径 + 证据边界 + 逐条结果 + 失败项分类 + 局限
│   ├── README.md                     评测方法、迭代记录、复跑与回归审计方法
│   ├── raw/                          原始材料（复算分数的唯一依据）
│   │   ├── descriptions.txt          v4 / v5 / v6 的 description 原文 + v5→v6 逐字差异
│   │   ├── v4/                       v4 的 4 份判定输出 + 4 份判定器提示词（本版补进包内）
│   │   ├── v5-raw.txt / v6-raw.txt   v5 与 v6 第 1 轮（迭代集 + 回归集）
│   │   ├── v6-run2-raw.txt           v6 第 2 轮（迭代集）
│   │   ├── v6-run3-raw.txt           v6 第 3 轮（迭代集）
│   │   ├── gen-v6-raw.txt            v6 泛化集原始输出
│   │   ├── prompts/                  各轮判定提示词与分组登记
│   │   ├── output-quality/           输出质量对照产物（每格仅 1 次）
│   │   └── run-manifest.md           运行日期（按文件 mtime）、判定器模型字段的可靠性说明
│   └── tools/                        包内自带、无外部依赖的六个脚本
│       ├── build-judge-prompt.mjs    生成判定器提示词
│       ├── build-prompts.mjs         批量生成自包含判定提示词（可归档）
│       ├── score.mjs                 解析判定器输出、按三个集合分流打分
│       ├── variance.mjs              同一版本多轮运行之间的翻转项
│       ├── audit-current.mjs         回归审计：现在这版描述还是被评过的那版吗
│       └── validate-spec.mjs         规范合规机械检查（三档：规范要求/官方建议/自定义）
└── reference/
    └── industry-flows.md             设计依据：五种公开可查的权威来源
```

## 怎么用

**正常情况**：什么都不用做。agent 遇到目标不清、边界不明、结果难以一次验收的任务时，会自动加载这个 skill。

**想强制触发**：直接说「按意图优先流程做这个任务」。

**只看速查**：单独把 `assets/quick-reference.md` 给人看，一页讲清全流程。

**想省事但要保证质量**：说「直接做，但做完把假设列给我」—— 这会触发**「用户已授权」豁免，只跳过 ① 的提问环节**，②③ 该做的照做（假设要列全，计划仍要过目）。真正想连计划都不看，就直接说「别走流程，直接做完给我」—— 注意**证据这一步永远不豁免**。

**复制下面这段直接用**（发给任何装了本技能的 agent 都行）：

```text
帮我把这件事做对：<你要做的事>。
动手之前，先按「意图优先交付」跟我对齐——要什么、做成什么样才算对、哪些不能碰，拿到我的确认再开工。
```

## 自检这个包是否合规

它按 Agent Skills 官方规范（agentskills.io）编写，并**自带一个机械校验器** `evals/tools/validate-spec.mjs`：

```bash
node evals/tools/validate-spec.mjs .
```

检查分三档——**规范要求**（`name` 字符合法且与父目录一致、`description` ≤1024 字符、正文 <500 行、引用一层深且都真实存在）、**官方建议**、**本包自定义**（总文件数、整份 `SKILL.md` 行数）。每档独立报 PASS/FAIL。

> 注意：`name` 必须与**所在目录名**一致。若你把目录名改掉（例如在工作目录 `intent-first-delivery-v2` 里跑），这一条会如实报 FAIL——这正是它该抓的问题。发布时目录叫 `intent-first-delivery` 即全绿。

## 四种可豁免的例外

| 豁免 | 什么时候用 | 代价 |
|---|---|---|
| **微小改动** | 一句话说得清 diff 且单点可验证 | 无，但误判代价高 |
| **用户已授权** | 你说了「直接做」「别问了」 | 必须事后列出全部假设供你确认 |
| **紧急止损** | 故障扩大中，必须立刻回滚 | 事后补齐契约 |
| **用户批准的探索** | 你也不知道要什么，且明确同意先只探一条路 | 声明「这轮不是最终目标」+ 给本轮边界；②③ 照走 |

含**不可逆步骤**（删除、发布、付款、对外发送）的任务**不适用**「微小改动」「用户已授权」两种豁免，必须在契约里单独列出该步骤并单独取确认。

## 它到底强制了什么

核心是**门禁 0**：未完成「意图契约 + 计划」并获你批准之前，禁止任何改变状态的操作。

外加两个真实停顿点：

- ① 产出澄清清单后 → **停下等你确认**
- ③ 产出计划后 → **停下等你批准**

（这两个停顿是必需的，且**不许合并成一轮**。实测发现，不强制停下来的话，agent 会在输出澄清文档的同一轮里接着把活干完，门禁形同虚设。）

## 它有没有用，是量过的

**先说清口径，再给数字。** 下面测的是「description 的分类能力」：一个只看 `name + description` 的全新上下文 subagent，判断「这条用户消息会不会让我去加载这个技能」。这是官方评测方法在「没有可编程 agent 运行器」的环境下的替代，是**描述质量的代理指标，不是真实端到端触发率**，也**不是触发率的下界**——本环境测不了真实触发率，所以不声称测了。

**三套查询集，口径不同，别混用**：

- **迭代集**（`evals/trigger_queries.json`，22 条）——v1–v6 就是对着它迭代的，**不能当泛化证据**。
- **回归集**（`evals/regression_queries.json`，12 条）——**就是原来的「泛化集」（`fresh_queries.json`）**。因为 v5→v6 的改动理由**引用了其中的 N14**，它已不满足「未参与优化」，本版按审计要求改标为回归集，**只用于防止回退**。
- **泛化集**（`evals/generalization_queries.json`，10 条）——**本版新写的一批，只跑过这一轮**。包内可核实的是：G1–G10 没出现在 v1–v6 任何一轮的判定材料里；「新写、且定稿前未被用来改描述」属**过程声明**，见 `evals/final-report.md` 第 3 节。

**触发准确率**（每条 3 次独立试次，触发率 ≥ 0.5 判触发；发布版 description = v6，467 字符）：

| 评测集 | 通过率 | 召回率（该触发） | 特异度（不该触发） |
|---|---|---|---|
| 迭代集 22 条 · 第 1 轮 | **19/22 = 86.4%** | 100% (10/10) | 75% (9/12) |
| 迭代集 22 条 · 第 2 轮 | **20/22 = 90.9%** | 100% (10/10) | 83% (10/12) |
| 迭代集 22 条 · 第 3 轮 | **22/22 = 100%** | 100% (10/10) | 100% (12/12) |
| 回归集 12 条 | **10/12 = 83.3%** | 100% (4/4) | 75% (6/8) |
| 泛化集 10 条（本版新写，只跑过这一轮） | **8/10 = 80.0%** | 100% (5/5) | 60% (3/5) |

**在这几轮里，正例每一轮都全部触发**——这是本代理指标下的一条**观测事实**，**不等于真实召回率，也不是触发率的下界**。

**失败项分两类**（逐条理由见 `evals/final-report.md` 第 6 节）：

- **已接受的偏差（有意保守，不修）**：**N9 / N13 / G9**——三条都是不可逆删除。要压掉它们就得删掉「不可逆操作也要当面确认」这句，而宁可多问一句正是本流程的价值所在。
- **原因未定 / 待复测**：
  - **N6 / N10**——v6 三轮里在轮次间**翻转**过（N6: 是/是/否；N10: 是/否/否），属判定器噪声，不是描述的稳定属性。N6 的负例标签本身也可争议：判定器指出「PR 还是直改」确实是真实歧义。
  - **N14 / G10**——「批量 / 所有」这一族在**单轮内 3/3 误触发**（尚无跨轮证据）。**v5→v6 的改动理由正是引用 N14，但 v6 下它仍然 3/3 误触发**，即那条改动理由**没有被证据支持**；本版如实记录，不粉饰。

> ⚠ **不许把 19–22 说成「误差 ±2」。** 那只是同一版本 3 轮内的**观测范围**（n=3），不是方差的统计估计。
> 也**不许说「v6 比 v5 好/差」**：v5 只有 1 轮、v6 有 3 轮，不足以把「描述改动」与「判定器噪声」分开。
> 复跑 `node evals/tools/audit-current.mjs .` 会对上面「原因未定」那 4 条报 **`⚠ ATTENTION`**（exit 1）——**这是刻意如此**：工具不会因为某个失败 ID 在文档里被提到过就替它放行。
> 审计**逐集合各挑自己的主运行文件**（迭代 / 回归 → `v6-raw.txt` 第 1 轮；泛化 → `gen-v6-raw.txt`），所以 G9 / G10 也在审计范围内，汇总口径是 19/22 + 10/12 + 8/10 = **37/44**。

**改过 `description` 之后，必须做三件事**：① 另写一批从未用过的新泛化查询（旧的随即降级为回归集）；② 重跑触发评测；③ 跑 `audit-current.mjs` 确认新描述确实被测过。

**迭代史**（description 是唯一触发机制，每改一版旧分数作废；只有有原始输出落盘的分数才可信）：

| 版 | 可复核？ | 结果 |
|---|---|---|
| v1–v3 | ⚠ 不可独立复核 | 包内无 v1/v3 原始输出；v2 的 validation 文件与 v1 逐字节相同（数据完整性错误）。不引用做结论 |
| v4 | ✅ 可复核 | 21/22（train 13/13、validation 8/9，仅 N9）—— 原始输出本版已补进包内 `evals/raw/v4/` |
| v5 | ✅ 本次重跑 | 迭代 21/22（N9）、回归 10/12（N13+N14） |
| **v6（发布）** | ✅ 本次重跑 | **迭代 19 / 20 / 22（三轮）、回归 10/12、泛化 8/10** |

**输出质量（带技能 / 不带技能对照，各跑 1 次/格——未达每格 3 次的稳健标准，数字是提示不是结论）**：

| 用例 | 带技能 | 不带技能 |
|---|---|---|
| 非代码类：写环境搭建文档 | **4/4** | **0/4** |
| 代码类：日志模块重构 | 4/5 | 5/5 |

- 非代码类差距最大：不带技能那组第一轮就把整份通用教程写完落盘（零提问）；带技能那组先问 9 条、一个文件没动。
- 代码类差距为零：不带技能那组自己也先侦察、问了 6 个问题。技能在这个用例上没有增量。
- 带技能那组唯一失分断言是「本轮没有写文件」——它写了 `clarification-checklist.md`，那是流程自身产物不是实现代码。断言已修正（见 `evals/final-report.md`）。
- 读法：技能最大增量在「非代码 / 文档类」任务；代码类任务上模型本来就会先问时增量接近零。要下结论得每格跑满 3 次——**这一步还没做，如实标注，不编造**。

## 设计来源

按五组**公开可查**的权威来源抽取共性设计：

| 来源 | 规模 | 取了什么 |
|---|---|---|
| **GitHub Spec Kit** | 141,528 star | 阶段产物链、根准则、Clarify 折叠、Converge 回流、bug 三阶段职责分离 |
| **Anthropic Claude Code 官方工作流** | 官方文档 | 门禁与停顿、面试式提问、证据优先、对抗性评审 |
| **Anthropic `skill-creator` + Agent Skills 官方规范/创作指南** | 官方仓库与 agentskills.io | SKILL.md 格式与写作规范、description 是唯一触发机制、渐进披露、评测方法 |
| **obra/superpowers** | 300,496 star | HARD-GATE、Play-Back 回述、Builder-Check 独立复读、铁律 + 门禁函数、判体量三档 |
| **Amazon Working Backwards** | 公开方法论 | 以终为始：先定成功标准再定实现 |

**Agent Skills 官方规范**（agentskills.io/specification）与官方 skill 创作指南（skill-creation/*）也逐条比对过并已合规，对照表见 `reference/industry-flows.md` 第九节。

## 分发给别的 agent

**整个目录就是技能本身** —— 把 `intent-first-delivery/` 完整拷进目标 agent 的 skills 根目录就行（DSH 用项目里的 `.dsh/skills/` 或 `.agents/skills/`，也可以放用户级的 `<dsh-home>/skills/`）。

- frontmatter 里的 `name` 必须始终与目录名完全一致，所以**不要把文件夹改名**；
- 技能**不需要安装任何东西** —— 它只是指令加模板，没有依赖、没有构建步骤；
- 想确认拷过去的副本没缺东西：在副本目录里跑 `node evals/tools/validate-spec.mjs`。

## 一句话总结

**没搞清楚要什么之前，不许动手；做完了要拿证据说话，并且回头核对是不是真做对了。**

---

封面图由豆包（Doubao）生成。
