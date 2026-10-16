# 设计依据：五种公开可查的权威来源

> 本流程不是拍脑袋设计的，而是从五种已经在工业界正式执行、可公开查证的流程/规范里抽取共性，
> 再针对「agent 未理解意图就直接动手」这一具体失败模式做了强化。
> 记录在此，用于解释「为什么这样设计」，也便于向他人说明这套流程的来源。
>
> 来源清单：GitHub Spec Kit（141,528★）· **Anthropic 官方渠道（Claude Code 官方指南 + 官方 `skill-creator` 的 skill 写作规范，同一个发布方，算一项）** · obra/superpowers（300,496★，机制权威源） · Amazon Working Backwards
>
> 计数口径：**按发布方算，不按文档算** —— Anthropic 出品的两份文档合起来算一项，所以是「五种来源」。

---

## 一、GitHub Spec Kit（Spec-Driven Development）

来源：<https://github.github.io/spec-kit/> ｜ 141,528 GitHub star，38 个 agent 集成，**321 位贡献者**（`api.github.com/repos/github/spec-kit/contributors?per_page=1&anon=1` 的 Link 头实测，含匿名贡献者；不含匿名的口径为 270+）

### 核心流程

**短路径**（较小特性）：`Specify → Plan → Tasks → Implement → Converge`

**完整路径**（生产级特性，加三道质量门禁）：

```
/speckit-constitution   （每项目一次）
/speckit-specify
/speckit-clarify        ← 消除歧义
/speckit-plan
/speckit-checklist      ← "需求的单元测试"
/speckit-tasks
/speckit-analyze        ← 跨产物一致性检查
/speckit-implement
/speckit-converge       ← 收敛
```

### 本流程采纳的关键机制

| 机制 | 原文要点 | 采纳到哪里 |
|---|---|---|
| **Constitution（根准则）** | 建立项目指导原则，**之后每一步都拿它来评判**。每个项目只运行一次 | ② 2.4 维护根准则 |
| **Clarify 折叠回写** | "asks targeted questions about anything underspecified and **folds your answers back into the spec**, so you're not planning on top of ambiguity" | ① 与 ② 之间，澄清清单的「折叠」硬要求 |
| **What / How 分离** | 规范阶段 "Focus on the **what** and **why**, not the tech stack" | ② 2.2，PRD 只写 What/Why |
| **阶段产物链** | "Each phase produces a Markdown artifact that feeds the next — giving your AI coding agent structured context instead of ad-hoc prompts" | 全套 `assets/` 模板 |
| **Checklist 是需求的单元测试** | 自定义质量清单，"mark an item `[x]` only when the reviewer determines that requirement-quality criterion is satisfied" | 意图契约的验收标准一节 |
| **Analyze 只读** | 报告冲突/缺口/歧义，"It's read-only — if it flags issues, fix them at the source and re-run" | ④ 4.3 双轴评审（只报不改） |
| **Converge 缺口回流** | 拿代码库比对 spec/plan/tasks，"If it finds gaps, it appends new tasks to `tasks.md`"，重跑 implement 直到报 **Converged** | ④ 4.5 收敛 + `convergence-report.md` |
| **Implement 的 checklist 门禁** | 实现前读 checklist 勾选状态作为门禁，有未勾选项时**先询问**再继续 | 门禁 0 与 ④ 前的自检清单 |
| **垂直切片** | 任务按依赖排序、可独立认领 | ③ 3.1 垂直切片 |

### Bug Fixing 扩展（assess → fix → test）

来源：<https://github.github.io/spec-kit/guides/bugfix.html>

| 机制 | 原文要点 | 采纳到哪里 |
|---|---|---|
| **Assess 阶段禁改代码** | "The agent investigates the code and writes `assessment.md`. **It does not change source code.**" | ① 1.2 排查简报 |
| **诊断未证实不得施工** | "do not proceed with an unsupported diagnosis" | ① 1.2 假设必须可观察 |
| **只有 Fix 阶段改代码** | "This is the only stage that edits source code." | ① / ④ 阶段职责分离 |
| **越界必须记录** | "If new evidence requires work outside the assessed scope, the agent must **record that deviation** rather than silently expanding the repair." | ④ 4.1 偏离记录；收敛报告第 6 节范围蔓延检查 |
| **Test 阶段不许改代码** | "This stage records evidence; **it does not edit source code to make a failing test pass.**" | ④ 4.4 出示证据 |
| **三档判定** | `verified` / `partial` / `failed` | `acceptance-evidence.md` 的判定列 |
| **回归的硬要求** | "A passing test suite alone is not enough if the original reproduction was never exercised." | 排查简报第 7 节回归 |
| **证据可追溯** | "Keep the assessment, fix record, and test report together so a reviewer can trace the repair from symptom to evidence." | 证据编号 E1/E2 机制 |

---

## 二、Anthropic Claude Code 官方工作流

来源：<https://code.claude.com/docs/en/best-practices>

### 核心流程

`Explore → Plan → Implement → Commit`

### 采纳的关键机制

| 机制 | 原文要点 | 采纳到哪里 |
|---|---|---|
| **不先给检查就不算能交付** | "Claude stops when the work looks done. Without a check it can run, 'looks done' is the only signal available, and **you become the verification loop**" | ② 2.2 无验收标准不许进入 ③ |
| **出示证据而非声称成功** | "Have Claude show evidence rather than asserting success: the test output, the command it ran and what it returned, or a screenshot" | ④ 4.4 闭环反馈 |
| **让 agent 反过来面试用户** | "have Claude interview you first... Ask about technical implementation, UI/UX, edge cases, concerns, and tradeoffs. **Don't ask obvious questions, dig into the hard parts I might not have considered.**" | ① 1.1 提问要求 |
| **追问到问透为止** | "Keep interviewing until we've covered everything, then write a complete spec" | ① 1.1 问到共识为止 |
| **换干净上下文执行** | "Once the spec is complete, **start a fresh session** to execute it. The new session has clean context focused entirely on implementation" | ⑤ 沉淀复用；交接物即下一轮输入 |
| **spec 要自包含** | "name the files and interfaces involved, **state what is out of scope**, and end with an end-to-end verification step" | 意图契约的边界与验收标准 |
| **分离研究与规划，避免解错问题** | "Separate research and planning from implementation to avoid solving the wrong problem" | 门禁 0 |
| **规划有开销，简单任务别规划** | "For tasks where the scope is clear and the fix is small... ask Claude to do it directly"、"If you could describe the diff in one sentence, skip the plan" | 门禁 0 的**微小改动**豁免（判定标准即取自这句） |
| **对抗性评审** | "have a subagent review the diff in a fresh context and report gaps"、"a reviewer running in a fresh context sees only the diff and the criteria you give it" | ④ 4.3 需求轴 |
| **⚠️ 评审者的过度报告** | "A reviewer prompted to find gaps will usually report some, even when the work is sound, **because that is what it was asked to do.** Chasing every finding leads to over-engineering: extra abstraction layers, defensive code, and tests for cases that can't happen. Tell the reviewer to flag only gaps that affect correctness or the stated requirements" | ④ 4.3 的明确约束（这条最容易被忽略，代价是过度工程） |
| **根因而非症状** | 官方示例：`"the build fails with this error: [paste error]. fix it and verify the build succeeds. **address the root cause, don't suppress the error**"` | ① 1.2 根因 > 猜测 |
| **失败模式清单** | kitchen sink session / 反复纠正（两次就 `/clear`）/ 过长的 CLAUDE.md / **trust-then-verify gap**（看起来对但没处理边界）/ 无限探索 | 门禁 0 与自检清单 |
| **提供具体上下文** | "The more precise your instructions, the fewer corrections you'll need"、描述症状 + 可能位置 + 「修好了是什么样」 | ① 提问方式 |
| **规则太长会被忽略** | "If Claude keeps doing something you don't want despite having a rule against it, the file is probably too long and the rule is getting lost" | 本流程刻意保持精简、可扫读 |

---

## 四、Anthropic 官方 skill-creator —— **格式与写作规范的权威源**

来源：<https://github.com/anthropics/skills> → `skills/skill-creator/SKILL.md`（33KB，Anthropic 自己用来写 skill 的 skill）
Agent Skills 格式规范：<https://agentskills.io/specification>（`anthropics/skills/spec/agent-skills-spec.md` 已指向此处）

一个 skill 就是一个带 `SKILL.md` 的文件夹，frontmatter 只强制两个字段：`name`、`description`。

### 三级渐进披露（Progressive Disclosure）

| 层级 | 内容 | 何时进入上下文 |
|---|---|---|
| 1 | 元数据（name + description） | **始终**在上下文（约 100 词） |
| 2 | `SKILL.md` 正文 | 触发时载入（**理想 < 500 行**） |
| 3 | 捆绑资源 | 按需载入（`scripts/` 可执行而不载入） |

配套规矩：正文接近上限时**加一层目录 + 明确的指针**告诉模型下一步读哪个文件；大文件（>300 行）要带目录；多领域/多框架时**按变体分文件**（`references/aws.md`、`gcp.md`、`azure.md`），只读相关那一份。

### 本流程采纳的关键机制

| 机制 | 原文要点 | 采纳到哪里 |
|---|---|---|
| **description 是唯一的触发机制，且必须「推」** | "This is the primary triggering mechanism - include both what the skill does AND specific contexts for when to use it. **All 'when to use' info goes here, not in the body.**" 并明确警告："currently Claude has a tendency to **undertrigger** skills -- to not use them when they'd be useful. To combat this, please make the skill descriptions a little bit **'pushy'**" | SKILL.md frontmatter 的 description（罗列具体触发情形 + 反免责声明） |
| **写作风格：讲道理，不要堆 MUST** | "Try to explain to the model **why** things are important in lieu of heavy-handed musty MUSTs. Use theory of mind and try to make the skill general and not super-narrow to specific examples." | 全文（每条硬规则后都给了原因） |
| **定义输出格式** | 用 "ALWAYS use this exact template:" + 模板本体 | `assets/` 各模板 |
| **输入/输出示例** | 用 `**Example 1:** Input: … Output: …` 的对照 | 澄清清单与排查简报 |
| **可测量的 skill 才算做完** | 建议用真实用户口吻写 2–3 条测试 prompt，**同一轮里同时跑「带 skill」和「不带 skill」两组**做对照，再用断言打分；主观类（写作风格、美术）不做强制断言 | 本流程自身的验收方式（见文末） |

> 注：官方 skill-creator 还包含 eval 循环、盲测对比、description 触发优化等工程化步骤，本流程未采纳 —— 它们是给「开发并长期维护一个 skill」用的，超出本流程的适用范围。

---

## 五、obra/superpowers —— **机制最强的开源实现**

来源：<https://github.com/obra/superpowers>（300,496 star，MIT，15 个 skill）

它解决的问题与本流程**高度重叠**，但在三处比本流程原来的写法更强，已全部吸收。

### 采纳的关键机制

| 机制 | 原文要点 | 采纳到哪里 |
|---|---|---|
| **HARD-GATE（硬门禁）** | `<HARD-GATE> Nothing gets built until your human partner approves the full description: in chat for a small change, the document for a project. **Building includes writing product code, scaffolding, installing dependencies, creating projects, and invoking an implementation skill.** Reading and exploring are fine.` 并明确两条例外：用户放弃提问 / 用户同意的 spike（且 spike 产物若要保留＝新请求，需重新过门禁） | 门禁 0（把「改变状态的操作」逐项列举，正是取自这段） |
| **Play-Back（回述确认）** | "describe THAT part back in ~200-300 words, then return to questions about the next part… **Mark anything you're guessing as your guess; only what they said goes in as theirs. End each chunk by asking what's wrong or missing.**" | ① 1.3 回述确认 |
| **Builder-Check（独立复读）** | 把设计文档交给一个**全新 subagent** 审读，并把它的问题**分三堆**：已回答 → 把答案写进文档；小事 → 自己定掉并在文档里标注为「执行者的判断」；只有用户能答 → 攒成一批一次问完。**"Don't hand over the document until the check is back."** | ② 2.3 独立复读 |
| **Iron Law（铁律）** | `NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE` + "If you haven't run the verification command **in this message**, you cannot claim it passes." + "Violating the letter of this rule is violating the spirit of this rule." | ④ 4.4 |
| **Gate Function（门禁函数）** | 声称任何状态前五步：IDENTIFY 哪条命令能证明 → RUN 完整跑（新鲜、完整）→ READ 读完整输出/退出码/失败数 → VERIFY 输出是否真的支持 → ONLY THEN 才开口。"**Skip any step = lying, not verifying**" | ④ 4.4 |
| **常见混淆表** | 「测试通过」需要「0 个失败」的输出，**不算**「上次跑的结果、应该能过」；「构建成功」需要退出码 0，**不算**「静态检查通过、日志正常」；「子 agent 完成」需要看 diff，**不算**「它说自己成功了」；「需求满足」需要逐条核对，**不算**「测试通过」 | ④ 4.4 的对照表 |
| **托词对照表** | 「我很有把握」→ 有把握≠有证据；「静态检查过了」→ 静态检查≠编译；「就这一次」→ 没有例外；「抽查够了」→ 抽查什么也证明不了；「换个说法这条就不适用了」→ **看精神不看字面** | ④ 4.4 的危险信号与托词对照 |
| **Size the Work（判体量）** | 三档：清楚的小事 → 请求本身即完整描述 → 直接做；小改动 → 对话里说清楚 → 不落正式文档，但流程照走；有书面设计的项目 → 设计文档 → 完整计划。**"If it grows mid-task, stop, say so, and step up a size."** 若其实是几个独立项目：说明并商定先后，一个一个来 | 开篇「判体量」 |
| **先问「我到底知道什么」** | 三分类：(a) 关键信息都在请求里 → 直接做并说明做了什么；(b) 缺了非琐碎的东西 → 开始对话。**"People often haven't finished working out what they want. Good questions help them think it through."** | 开场第一动作 |
| **提问的节奏与话术** | 每条消息**只问一个问题**、结尾必须是一个问题、**不给示例答案清单**（问了就变成引导）；"**never use process jargon**"；先开放后收敛，只有在对方卡住时才给短菜单；"A guess they can correct often beats a question"；具体化的话术："Walk me through the last time…"、"If it could only do one of these well, which?"、"**What would make you wince if I got it wrong?**"；**"Ground to cover. This is territory, not a script. Never read these out as questions."** | ① 1.1 提问要求 |
| **默认值必须说出口** | "I'll fill in sensible defaults" → "Good. **Say them out loud. A default they never heard is one they couldn't reject.**" | ② 2.2 假设清单 |
| **「感觉不错」不等于批准** | "They said 'sounds good' to the idea" → "**Approval covers what you showed them. A description you haven't written isn't approved.**" | 门禁 0 |
| **计划是「实现者无法独自做的决定的集合」** | Step 粒度＝**一个动作 + 可检验的结果**（写失败测试 / 跑它确认失败 / 写最小实现 / 跑测试确认通过 / 提交）；"A plan longer than the code it describes **has written the code instead**"；反向失败是「什么都没决定的行」（TBD、『处理边界情况』、『加上适当的校验』） | ③ 3.1 切片粒度 |
| **自检覆盖五件事** | 规范覆盖（每条需求能指到任务）／步骤扫描（既不能什么都没决定，也不能是代码誊抄）／**类型一致性**（Task 3 叫 `clearLayers()`、Task 7 叫 `clearFullLayers()` 就是 bug）／未覆盖输入类／**篇幅比例**（计划比规范长几倍就是誊抄） | 自检清单 |

---

## 六、Amazon Working Backwards（PR/FAQ）

来源：<https://workingbackwards.com/resources/working-backwards-pr-faq/>

**核心做法**：**先写新闻稿和 FAQ，再决定做不做。**

从「客户看到的结果」往回推导需求，而不是从「我们能做什么」往前推。写不出令人信服的新闻稿，就说明这个东西还不该做。

**采纳的核心思想**：**倒着推 —— 先定「什么算成功」，再定「怎么做」。**

这直接对应本流程的两个设计：

1. ② 理解问题必须先写**验收标准**，而 ③ 才允许写实现方案
2. ② 2.2 要求先写「成功之后，用户会看到什么不一样」

**未采纳的部分**：完整的新闻稿文体（面向对外发布的产品，对多数 agent 任务过重）。取其「以终为始」的机制，不取其形式。

---

## 七、相对原始计划的改动

用户原始计划（① 接收诉求 → ② 理解问题 → ③ 拆分问题 → ④ 执行并验证 → ⑤ 沉淀复用）的骨架是成立的，两个核心判断也是对的：**根因 > 猜测**、**没写过失败测试不许写实现**。

本流程在其基础上补强了四处：

| 补强 | 原因 |
|---|---|
| **加入门禁 0（强制停顿）** | 原计划没有强制停顿机制。实测发现，不强制停下来的话，agent 会在输出澄清文档的同一轮里接着把活干完，门禁形同虚设 |
| **加入根准则层** | 原计划是纯流程，没有项目级准则。缺这一层，同一套流程在不同任务上会漂移（取自 Spec Kit 的 constitution） |
| **加入收敛环节（④ 4.5）** | 原计划的「验证」没有缺口回流机制。发现缺口后怎么处理没定义，容易变成「做完了」而非「做对了」（取自 Spec Kit 的 converge） |
| **What / How 分离 + 产物链** | 原计划把 PRD 和实现计划混在一层。拆成独立产物并明确「规范阶段不写技术栈」，且每个产物喂给下一阶段 |

另外把散落的做法归位：原计划的「非代码场景盘问」「先搜再问」「证据分级」归入 ① ②，「垂直切片」「双轴评审」「闭环反馈」归入 ③ ④，并补上了每处的**强制动作**（如「折叠回产物」「偏离必须记录」「证据须为原始输出」）—— 原计划写了要做什么，但没写做不到时算不算过。

---

## 八、与五个来源的关系

| 来源 | 本流程取它什么 |
|---|---|
| GitHub Spec Kit | 阶段产物链、根准则、Clarify 折叠、Converge 回流、bug 三阶段的职责分离与偏离记录 |
| Anthropic Claude Code | 门禁与停顿、面试式提问、证据优先、对抗性评审及其过度报告警告、**微小改动**豁免判定 |
| **Anthropic skill-creator** | SKILL.md 格式与写作规范、description 是唯一触发机制且需「推」、讲道理不堆 MUST、三级渐进披露 |
| **obra/superpowers** | HARD-GATE、Play-Back 回述、Builder-Check 独立复读、Iron Law + 门禁函数、判体量三档、提问节奏与话术 |
| Amazon Working Backwards | 以终为始：先定成功标准，再定实现 |

**本流程相对它们的差异**：Spec Kit 面向「从零构建一个功能/项目」，Anthropic 的指南面向「用 Claude Code 写代码」。本流程面向更窄也更常见的一个问题 —— **agent 在没有理解意图的情况下就直接动手**，因此把「强制停顿」和「意图契约」提到了流程首要位置，并且适用场景扩展到非代码任务（方案、文档、调研）。

---

## 九、本包对 Agent Skills 官方规范的合规点

来源：[agentskills.io/specification](https://agentskills.io/specification) 与 [skill-creation/best-practices](https://agentskills.io/skill-creation/best-practices)、[optimizing-descriptions](https://agentskills.io/skill-creation/optimizing-descriptions)。

| 规范要求 | 本包的落实 |
|---|---|
| `name` 1–64 字符，仅小写字母数字与连字符，不得连续连字符、不得首尾连字符，**且必须与父目录名一致** | 目录名与 `name` 同为 `intent-first-delivery` |
| `description` 1–1024 字符，须同时写清**做什么**与**何时用**，使用祈使句，宁可「推」一点 | **467 字符**（v6），同时给出「何时该触发」与「何时别拿流程挡路」两侧边界，并按官方方法实测评过 6 版（v1–v6，分数与证据见 `evals/final-report.md`） |
| 渐进披露三级：metadata（~100 token，常驻）→ SKILL.md 正文（建议 < 5000 token）→ 资源文件按需加载 | SKILL.md 正文 246 行 / 约 5K token（中文密度高，token 口径比行数更紧，落在建议线上）；8 个模板在 `assets/`、设计依据在 `reference/`、评测与工具在 `evals/`，均按需读取 |
| **主 SKILL.md 保持 500 行以内**，详细材料移出 | 本包正文当前 246 行，并在文末写死这条维护要求（`evals/tools/validate-spec.mjs` 会机械检查这一条） |
| 引用一律用相对技能根的路径，且只一层深，避免多级跳转 | 全部为 `assets/...` / `reference/...` / `evals/...` 形式，无嵌套链 |
| 要**告诉 agent 何时**去读每个文件，而不是笼统说「见 references/」 | 文末「分发约定」逐条给出触发条件，包含 `evals/` 的读取时机 |
| Gotchas（环境特有的反直觉事实）是最高价值内容，且必须留在 SKILL.md 里 —— 放进参考文件可能永远不会被加载 | 「踩坑清单」放在 SKILL.md 正文最前，12 条实测坑 |
| 提供默认值而非菜单；按脆弱度校准自由度（易错的步骤给死命令，多解的地方讲清道理） | 门禁与停顿点给死，提问话术与档位判定讲道理 |
| 规范提供 `skills-ref validate` 校验 frontmatter 与命名 | **本包自带等价校验器** `evals/tools/validate-spec.mjs`（官方 `skills-ref` 在本环境无法安装运行，故自己按规范条款实现了一份，分三档——规范要求/官方建议/自定义——发布目录下全绿） |

**未采纳的一项**：`license` 字段（规范建议填写）。本包尚未确定分发许可，留空比填错好 —— 由发布者自行决定后补上。

---

## 十、`description` 不是写出来的，是测出来的

官方 [optimizing-descriptions](https://agentskills.io/skill-creation/optimizing-descriptions) 的核心论断是：**description 是技能唯一的触发机制，因此它必须经过实测，而不是凭感觉写。** 本包的 `description` 按这套方法跑了 6 版（v1–v6），最终发布 v6。

**先说口径**：本环境的判定器是「只看 `name + description` 的全新上下文 subagent」，所以测得的是**描述分类的代理指标**，不是真实端到端触发率——后者需要可编程的 agent 运行器，本环境没有。代理指标能回答「这段描述会不会让一个 agent 想去加载这个技能」，回答不了「加载后行为是否达标」。这一点如实写在 `evals/final-report.md`。

方法（与官方 agent 版 `skill-creator` 的 5 步一致，但用 subagent 替代其 `claude -p` 运行器）：

1. 建 22 条查询的触发集：10 条应触发、12 条不应触发，每条附「为什么」。覆盖用户真实口吻的各类说法。
2. **划 train / validation**（13 / 9），改描述只看 train。
3. 每条查询跑 3 次独立试次 —— 单次判定不稳定，必须看触发率是否跨过 0.5 阈值。
4. 判定器是一个**全新上下文的 subagent**，只拿到候选 description 与查询本身，输出 YES/NO + 理由。
5. 唯一验收指标是 **validation 通过率**；train 满分不算收敛。

**这轮跑下来最值钱的三条经验：**

| 经验 | 证据 |
|---|---|
| **只看 train 会误判收敛** | v2 把 train 打到 13/13，validation 却掉分，且它新引入的边界句造成一处漏触发（T4） |
| **近义误触发是最有价值的一类负例** | 明确不该触发的负例大多全过，稳定反复失败的是不可逆删除类（N9 / N13）——它贴着技能的适用边界，才暴露真实分歧 |
| **不要照着失败查询改描述** | 官方明确警告这是过拟合。删除类失败多次仍不把「删除」写死成豁免，改从正文的「批量/不可逆默认问法」解决 |
| **单条粒度有判定器抽样噪声** | N6、N10 在同一段 description 的两次运行里从 0/3 正确翻成 3/3 误触发——两次只差一个与它们无关的词。所以区分 21/22 和 19/22 无意义，看「召回是否 100%」和「稳定误触发类」才有意义 |

评测集、迭代记录与逐条判定明细都在 `evals/`，可复跑。**这条方法本身也可以套用到任何技能上** —— 包括未来给这个包新增的兄弟技能。
