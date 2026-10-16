# 任务：判断技能触发（纯判断，不要执行任何真实任务）

你在模拟一个 agent 在接到用户消息后的**第一个决策**：查一遍可用技能目录，决定要不要加载某个技能。

## 可用技能目录（只有这两个）

<available_skills>
- `diagnose-windows-sandbox-acl`: Use on Windows for unexpected DSH sandbox access denials: workspace writes or listing fail, or an ordinarily readable path cannot be read. One bundled command inspects the path and every ancestor and repairs the ACL problems it proves in that same run. Expected confinement denials need no ACL repair.
- `intent-first-delivery`: 动手之前，先确认「做成什么样才算对」——这一步不能跳。用户派下来的活，只要「要什么、做成什么样」还没定死，就先对齐意图、定下验收标准，拿到明确批准再开工：做需求、写功能、调研、排障、出文档、做方案、改流程，无论软件还是非软件。判断标准只有一条：还有没有必须靠猜才能定的决定？有，就先问清楚——最贵的返工都发生在自以为清楚的时候。以下情形几乎一定属于「得靠猜」：同一句话有两种以上理解；任务跨多个文件或要花几小时；用户说过「上次做的不是我想要的」；交付物要给别的人或别的 agent 用；用户自己也没想清楚要什么；批量或不可逆的操作，范围或影响说不清。注意「把 X 修好」「验证 X 能用」这类说法给的是目标不是标准——怎么算修好、验到什么程度，仍要问清楚。反过来，用户已经说清改哪里、改成什么、怎么算完成，而且照着做不会撞上别的选择的活，直接干完回话就行，别拿这套流程去挡它。
</available_skills>

## 决策规则（严格按此执行）

你唯一的判断依据是上面技能目录里的 `name` 和 `description`。**不要去读这两个技能的文件，不要用任何工具探索，不要试图真的完成用户的请求。** 你只需要回答一个问题：

> 看到这条用户消息，我会不会调用 `skill` 工具去加载 `intent-first-delivery`？

判断标准：这条消息要的东西，是否**必须先澄清意图 / 先定验收标准 / 先取证**才能保证做对？

## 独立试次

每条消息要**独立判断 3 次**（记为 trial 1/2/3）。三次之间**必须互不影响**：不要把前一次的判断当成依据，不要为了凑数而改口，也不要假设三次应该一致。每次都在心里重新做一遍这个决策。

## 输出格式（严格遵守，不要加别的段落）

对你收到的每条消息，输出三行：

```
[消息编号] trial1: YES|NO | 一句话理由（≤20字）
[消息编号] trial2: YES|NO | 一句话理由（≤20字）
[消息编号] trial3: YES|NO | 一句话理由（≤20字）
```

YES = 会加载 intent-first-delivery；NO = 不会加载。
最后不要写总结、不要写建议、不要评价这套技能好不好。

---

# 你要判断的消息（共 7 条，每条判断 3 次）

--- 消息 N1 ---
把 README 里第 12 行那个 Geting Started 改成 Getting Started

--- 消息 N4 ---
python 里怎么把 dict 按 value 排序，我老忘

--- 消息 N6 ---
在 https://github.com/foo/bar/blob/main/README.md 这个文件里，把 Installation 那一节改成用 pnpm 安装的说明，内容我写好了：pnpm add foo

--- 消息 N8 ---
给我写个快排，输入是 int 数组，输出从小到大的数组

--- 消息 N10 ---
帮我把这份 json 转成 yaml，文件在 ~/data/config.json

--- 消息 N12 ---
介绍下你自己

--- 消息 N5 ---
把 conf/app.toml 里的 timeout 从 30 调到 60，然后重启一下服务
