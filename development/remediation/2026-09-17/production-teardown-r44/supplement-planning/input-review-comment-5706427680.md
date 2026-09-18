## r44-A 已接收；plan.v1 全文远端审阅完成；core 扩围建议与实施前补项

### 1. 归档接收完成，不再重复归档

远端 HEAD **`e8d1858ca6a65710c346007e48809580f6064beb`**，相对源码基线 **`9d0db65683b7925e37dc84578e23cba2a83e589c`** compare ahead1/behind0。返回的13个文件全部为新增、均在 `development/remediation/2026-09-17/production-teardown-r44/` 内，合计+1381/-0；没有源码、测试、配置、工作流或旧证据变化。PR仍draft，base `feat/multi-agent-company-nodes`未变，未合并，P0-B blocked。

本会话已分段连续读取 [plan.v1 全文](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/planning/plan.v1.md) 第1–724行，读取完整[归档索引](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/archive-receipt.v1.md)及[独立审计发布副本](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/development/remediation/2026-09-17/production-teardown-r44/review/r44-independent-audit.published.v1.md)。计划各段返回的Git blob均为 **`e28695c08b43cec50c196f3fa252543a014ce847`**，与索引一致；索引记录51955 bytes、SHA-256 **`4b666af39f993ac1253c079786d1bc87391caf8d91abcff35b4f25f3fa41141c`**。

核验口径：本次完成远端提交/文件范围、计划全文、Git blob与索引交叉核对；容器公开Raw下载实际DNS失败，**未重新计算全计划或13件归档的SHA-256、未读取仓库外raw，也不冒称再次完成本地脱敏往返验证**。索引的SHA-256是本地归档/审计证据提供的身份值。3个未跟踪本地原件继续保留，不视为垃圾。审计发布副本明确来自会话转录且非指定硬审，按其实际性质接收。冻结件的断链/本机路径已披露，不为美化归档而改写原始计划。

### 2. 文档推送的CI已结束；不把它当生产修复

[run **35164395956**](https://github.com/wmqfl861/dsh861/actions/runs/35164395956)，attempt1、run number34、head e8d，最新直接读取 **completed/failure**。UTC 2026-09-16 23:55:43 至2026-09-17 00:10:39，即Asia/Taipei **9月17日07:55:43–08:10:39**。

17个jobs为 **14 success / 3 failure**：Linux coverage **105022106101**、Windows coverage **105022106052**、汇总 **105025412760**失败；static **105022105940**、consumers **105022105764**及其余作业成功。本次读取到作业/步骤层，没有下载或统计这次coverage artifacts，不给旧失败数量换上新run标签，不宣称Web历史间歇根因消失。文档增量未修改生产/测试字节，归档完成不等于两个teardown缺陷修复。

### 3. 计划方向审阅：支持有限扩围候选，不是替所有者批准

我支持计划优先解决真实所有权、共享关闭事务、异常安全和timeout/静止分离，而不是弱化r43观察器或让缺失投影默认成空。原40个用例与3个afterDispose回调、child-first、权限、持久事件、终态唯一性和正式硬审核要求均应保留。

三个core候选的必要性已经不是无内容的请求：

| 候选文件 / 当前blob | 本会话核对的理由 | 尚须真实验证 |
| --- | --- | --- |
| `packages/core/agent/src/index.ts` / `21c95b5c600d393d3cfd2bf37f76f40fea22cb58` | 现有create/resume/AgentHandle接口没有计划提出的begin/beforeRelease参与点；若采用该设计，必须把共享完成/身份约束放在声明层，不可由领域包猜私有状态 | 不提供hooks的调用者兼容；提供hooks的真实factory不得忽略；回调和completion不能形成自等 |
| `packages/core/agent-loop/src/index.ts` / `6c30f0413593ae171aed09e35e68eb1f5946a4d9` | prepare在ownerCtx.effect内构造使用loopCtx的ReactLoopAgent；scope由loopCtx创建。不同fiber下collect精确disposer只能删除当前fiber列表中的那一项，不能自动迁移另一个parent的注册。现有memoized IIFE也先执行abort等同步动作再完成赋值 | R1真实factory/consumer/scope时序；可重入前发布completion；所有owner等待完整释放，不仅方法已返回 |
| `packages/core/agent-loop/src/agent.ts` / `06e1f51b57277ba296698b6c8b810f0e455e3695` | cancel先inbox.clear再abort；clear抛错会跳过后面的取消动作 | 保留原错误、仍发出取消并等待真实退出；不得改成keepInbox或吞错 |

辅助核对：[scope实现](https://github.com/wmqfl861/dsh861/blob/e8d1858ca6a65710c346007e48809580f6064beb/packages/core/scope/src/index.ts)返回fiber.dispose作为rawDispose，并在传入ctx下创建fiber；其blob **`ef64440ac4c4aa579cc95898a467a91ff76bc4c3`**。原有两项disposer身份校正保留，不能退回“所有effect都独立并发”或“yield任何包装就能转移所有权”的概括。

这些是源码证据及设计评估，不是已经完成的Node26真实时序实验，也不证明一定必须选择新增公共hooks这一种设计。按plan §5.3，真实轨迹仍是扩围实施前置；范围批准本身不免除该验证。

### 4. 实施前应纳入正式计划的三项补充/澄清

**R44-REVIEW-01｜R1必须可在旧接口上取证。** plan §5.2引用K01–K03作为实施前真实轨迹依据，但K01/K03又涉及尚不存在的beforeRelease/begin接口。须将“旧实现、现有公开入口上的所有权/释放顺序轨迹”与“新hooks实施后的K验收”分列。旧实现基线不能因新增字段不编译/接口不存在而算有效首失，不能先改受保护core以便证明core需要改。可复用现有scope-lifecycle测试设施、真实事件、实例级包装和deferred握手；不得复制生产算法或仅比静态字符串。此为计划执行顺序的澄清，不是更改已冻结v1。

**R44-REVIEW-02｜补明确的factory多handle失败等待验收。** 当前 `FactoryOwnership.dispose()` 对全部liveAgents/startupTasks使用`Promise.all`。单个Promise拒绝会使这个聚合方法先结束，而其他已启动工作可能仍未完成。v1有单handle逐项收尾和child分支失败要求，但应明确列出“两个互不为父子的handle，由同一factory持有：A先失败，B的真实清理尚被gate阻挡”这一factory层验收，避免只证明每个handle内部完整而遗漏上层owner等待。

本会话用该方法的可执行主体（仅去TS注解）及受控owned-task输入，在容器 **Node22.16.0** 做了两个隔离对照：

| 实现 | B的gate放行前方法已settle | B已完成 |
| --- | --- | --- |
| 当前Promise.all主体 | true（带A原sentinel拒绝） | false |
| all-settled收集的控制版本 | false | false |

两场景finally均放行B、等待测试工作完成，并确认最终仍拒绝同一个A sentinel。没有sleep/耗时门槛、真实模型或用户进程操作。**这只是局部方法控制流试验，没有导入Cordis/AgentLoop，不等于已证明真实整个provider fiber提前结束。** 真实外层还可能通过其他结构性disposer等待，必须由后续实际factory回归核清。目标是各已启动任务全settle后再报告全部原错误，不是机械把一个关键字换掉就宣告修复；startupTasks与同步抛错分支也应按实际契约纳入评估。

**R44-REVIEW-03｜批准单需覆盖完整且有限的支持范围。** plan §10.2除3个core文件外，还拟修改 **`scripts/smoke-python-runtime.py`**（增加测试专用built-CLI场景），并新增SDK/Session快照。它不是生产core文件，但仍是已有可执行测试支持脚本，不能从“仅批准3个core”默推获得修改权。建议范围表同时列明：原3个领域生产目标；3个core扩展；确有必要的该脚本；owner-local测试、相关README/JSDoc/双语架构说明、plan明列的新快照路径。生成文件/新支持adapter若超出列明路径，先报告，不给全scripts或全SDK写权限。新快照须真实触发关闭并观察实际追加/持久化的终态，不能仅重放预制完成日志自证。

以上是主会话远端审阅输入，**不是正式Codex计划v2或OpenCode硬审**。v1保持冻结；必要补订由已授权的指定规划者形成版本化短补充，不重跑40分钟全量规划、不用新调用伪补原argv/exit。

### 5. 现在需要的所有者决定

建议维持既定审核者，在用户本人控制下完成本机OpenCode的既定provider认证，而不是为绕过阻断改审核者。助手/agent不接收Key、不代登录、不反复查凭据，不以已经发现的缺失状态再跑一轮探测。

core扩围建议：**同意作为有条件、有限的修复范围候选；实施仍须所有者明确批准上述完整范围、R1轨迹支持、适用的指定计划/审核条件就绪。** 这里的技术建议不是批准记录。目前没有收到解除范围或认证阻断的新指示，不启动生产编辑或新的模型调用。

原Codex调用完整argv/exit仍MISSING；本轮读到正文也不能补成exit0。新补充调用必须独立记录自身身份与退出码，不能替换旧调用证据；原缺口对节点准入的处理须按治理决定，不由执行者悄悄豁免。

### 6. 下一接续不应继续制造归档循环

r44-A已完成，不再要求重归档、重推送、重新清扫3个原件或重跑既有测试。当前生产状态 **BLOCKED**；下一本地接续仅在所有者决定和指定审核条件恢复后启动，按正式计划补清R1/Factory等待/支持范围，然后执行批准范围内的R1–R9。未经这些前置，不派agent重复返回相同的认证失败，更不假称正在后台处理。

本会话实际完成：归档增量与正文接收、完整计划审阅、三个core与scope/既有fixture源码核对、一个factory聚合等待的隔离对照、新CI作业级状态读取。本次仅写PR评论/元数据，未新建仓库文件或提交、移动ref、运行项目Vitest、调用Codex/OpenCode、访问主机或认证；未修改P0-B状态、生产源码、测试、锁、vendor、workflow或历史证据。