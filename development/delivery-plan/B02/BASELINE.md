# B02 固定基线和能力差距

类型：事实记录。以下读取基于 `59579599fa34b6fff47b1c4d525459d2148eb1f8`；后续变化写入实际执行记录，不覆盖本页。

## 1. B01接收口径

PR #13 的实际远端 HEAD 为上述完整SHA，仍draft，base为 `feat/multi-agent-company-nodes`，未合并。CP-F提交parent为 `9fec63de9056c140c155ab51da52a41b2fcd6a72`，tree为 `edc3955c26a6d8da120533087cd509debd277b8f`。

已读取 [W13裁决](../../delivery-runs/B01/B01-20260919-01/W13/review/hard-review-round1.md)：记录实际OpenCode `--variant max`、exit0及PASS，但明确只对候选与证据链给出裁决，阶段仍为PARTIAL_WITH_BLOCKERS。该文件没有把U1安全子项、原生对话框人验、安装器条件或后继CI复验写成已关闭。本次没有重跑其审核、363文件核验或本机桌面操作。

所有者转交的本地回执称已产生 `C:\dsh-b01-w07\product\win-unpacked\` 预览产物、W00—W13全部终结、32项产品AC分布为accepted0/partial8/reusable8/blocked8/unassessed8。这里保留为本地报告；终结不是全部产品能力完成，包体980MB不是功能丰富度证明。

已重新读取最终HEAD的workflow列表：主CI [35464685823](https://github.com/wmqfl861/dsh861/actions/runs/35464685823)（run45）completed/failure。本次未下载其artifact或逐项重计失败；不得把回执中run43的结果直接写成run45结果。B02不是新一轮全仓CI清零任务。

## 2. 已存在、可复用的真实能力

| 固定源码/文档 | 已有行为 | 不能据此声称已有 |
|---|---|---|
| [agent-team README](../../../packages/experimental/agent-team/README.md) | 同一根Session内Lead、命名成员、持久消息、CAS任务板、明确Lead权限 | 跨进程团队一致性、隔离工作区、桌面完整管理中心 |
| [TeamService](../../../packages/experimental/agent-team/src/index.ts) blob `2ccbbe95cafadf727ceb8c93376f8bd0a8e82bb3` | `spawnTeammate/sendMessage/interrupt`为Host方法；Remote目前为`view/createTask/updateTask` | 所有Host操作已安全暴露给桌面；浏览器可以直接传伪造Agent |
| [ui-subagent](../../../packages/client/ui-subagent/README.md) | 子会话目录、继续对话和当前轮Stop；one-shot记录只读 | 随意接管其他终端中的CLI；所有provider支持续接 |
| [workflow](../../../packages/workflow/workflow/README.md) | `agent/parallel/pipeline`脚本编排及caller持有的run | 模板持久化、可视编辑、跨重启执行续跑、跨子调用预算 |
| [ui-workflow-run](../../../packages/client/ui-workflow-run/README.md) | 展示已记录run/phase/member身份与状态 | 图编辑、脚本/输出/错误/用量/流程控制 |
| [schedule](../../../packages/schedule/schedule/README.md) | 根Session内固定间隔提醒、持久化、live owner才投递 | 工作流调度服务、关机继续运行、任意cron或补跑所有错过任务 |
| [ui-schedule](../../../packages/client/ui-schedule/README.md) | 已启用overlay后的只读提醒目录 | 新建/编辑/暂停/取消流程计划的控制页 |

这说明功能少不是靠切换一个隐藏设置就能完全解决；需要在已有服务上补可操作Remote、可编辑定义、运行控制与权限验证。不得重新实现消息、取消和Session持久化来替换已验证底座，也不能把提醒等同完整工作流循环。

## 3. 盘点发现的产品前置

[W09复用与缺口](../../delivery-runs/B01/B01-20260919-01/W09/reuse-and-gaps.md) 已列Codex/Claude产品适配、通用ACP、team/workflow执行原语和UI底座；OpenCode/Grok完整受管产品验收、成员岗位模型、规则管理及公司控制台仍有缺件。

[W10准入](../../delivery-runs/B01/B01-20260919-01/W10/p0-b-readiness.md) 区分旧开发CLI认证与当前受管产品凭据/轮换/传输前置。禁止把开发过程中能调用Codex/OpenCode推断为交付产品配置已获授权，更不能使用聊天暴露的旧Key。

原规格要求公司平台状态使用PostgreSQL、GBrain独立账号库，当前环境未部署；本包不偷偷改成“SQLite就是正式平台主库”。B02先做本地、项目/Session作用域的桌面控制和流程定义，现有Session继续作为实际执行事实来源；将来接公司平台的存储/身份接口必须显式隔离。新公司数据库或跨机器调度不在本包默认执行范围。

## 4. 本次变更依据与历史附件

本次新依据是所有者关于桌面组队、操作其他Agent、工作流和循环的明确需求。B01只做预览的范围不能继续作为不做产品功能的理由；它也不能被改写成原本已经承诺并完成这些功能。

聊天附带的r44b4/S3材料属于旧候选、旧manifest和已处置的历史审核，不是B01终态或本次产品需求批准。保持历史文件冻结，不重新开启那一轮追认、认证或参数核实。
