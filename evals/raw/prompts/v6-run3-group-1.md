# 任务：判断技能触发（纯判断，不要执行任何真实任务）

你在模拟一个 agent 在接到用户消息后的**第一个决策**：查一遍可用技能目录，决定要不要加载某个技能。

## 可用技能目录（只有这两个）

<available_skills>
- `diagnose-windows-sandbox-acl`: Use on Windows for unexpected DSH sandbox access denials: workspace writes or listing fail, or an ordinarily readable path cannot be read. One bundled command inspects the path and every ancestor and repairs the ACL problems it proves in that same run. Expected confinement denials need no ACL repair.
- `intent-first-delivery`: 动手之前，先确认「做成什么样才算对」——这一步不能跳。用户派下来的活，只要「要什么、做成什么样」还没定死，就先对齐意图、定下验收标准，拿到明确批准再开工：做需求、写功能、调研、排障、出文档、做方案、改流程，无论软件还是非软件。判断标准只有一条：还有没有必须靠猜才能定的决定？有，就先问清楚——最贵的返工都发生在自以为清楚的时候。以下情形几乎一定属于「得靠猜」：同一句话有两种以上理解；任务跨多个文件或要花几小时；用户说过「上次做的不是我想要的」；交付物要给别的人或别的 agent 用；用户自己也没想清楚要什么（含用户主动说「先探索一下」「我也不知道要什么」，此时按「用户批准的探索」走，不是跳过流程）；不可逆的操作，哪怕范围看起来清楚（删除、覆盖、发布、付款、对外发送）——范围、可逆性、误伤面要当面确认。注意「把 X 修好」「验证 X 能用」这类说法给的是目标不是标准——怎么算修好、验到什么程度，仍要问清楚。反过来，用户已经说清改哪里、改成什么、怎么算完成，而且照着做不会撞上别的选择的活，直接干完回话就行，别拿这套流程去挡它。
</available_skills>

## 决策规则（严格按此执行）

你唯一的判断依据是上面技能目录里的 `name` 和 `description`。**不要去读这两个技能的文件**，不要用任何工具，不要联网。
你**不要执行用户消息里的任务**，只回答一个问题：看到这条用户消息，我会不会调用 `skill` 工具去加载 `intent-first-delivery`？

判断时只问自己：这条消息要产出东西吗？「要什么、做成什么样」定了吗？还有没有必须靠猜才能定的决定？
注意：只要用户已经说清「改哪里、改成什么、怎么算完成」，就不该触发。

## 你要判断的消息（共 4 条，每条独立判断 3 次）

--- 消息 T1 ---
帮我把这个项目的日志模块重构一下，现在是到处 print，我想要个统一的东西

--- 消息 T2 ---
我们的用户老是说找不到想要的东西，你帮我看看该怎么办

--- 消息 T3 ---
调查一下现在国内做 AI Agent 的公司都在用什么记忆方案，整理一份给我，下周要给老板讲

--- 消息 T4 ---
导出 CSV 的功能上周还好好的，今天客户说导出来的文件打不开，你修一下

## 输出格式（严格）

每条消息输出 3 行，格式为：
[消息 <ID>] trial1: YES|NO | 不超过 20 字的理由
[消息 <ID>] trial2: YES|NO | ...
[消息 <ID>] trial3: YES|NO | ...
3 次判断必须彼此独立，不要参考同一条消息的前几次结论。

## 落盘要求

判断完成后，把上面全部输出**原样写入这个文件**：
F:\Agents\Outputs\intent-first-delivery-v2\evals\raw\prompts\v6-run3-group-1.txt
（只写那些 trial 行。如果写文件失败，就把同样内容作为你的回答正文返回。）