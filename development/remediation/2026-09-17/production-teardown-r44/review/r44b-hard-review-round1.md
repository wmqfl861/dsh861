我将开始 r44-B 轮次的硬审核。首先读取冻结计划、补充计划与执行证据，然后逐文件核对候选实现。
继续读取计划剩余部分与执行证据。
读取基线复现、R1 首失、R1 裁决与负控摘要、候选清单。
先验证固定候选的完整性（SHA-256 与 manifest 对照）。
候选完整性验证通过：11 个文件 SHA-256 与 manifest 完全一致。现在开始逐文件核对。先看 `dsh-agent` 的 AgentTeardownHooks。
`dsh-agent` 接口与 plan §6.1 一致。现在核对核心实现 `agent-loop/src/index.ts`。
核心 diff 已读。现在读 `agent.ts` 的 cancel 修改与 `agent-loop/src/index.ts` 中 handle 发布/trackWrapper 的完整上下文。
`agent.ts` 符合 §5.3。现在读 agent-loop 完整现状（ownership/handle 发布路径）。
核对 scope 的创建位置与 `rawDispose` 语义（验证跨 fiber 收集是否真实转移）。
核心机制已核实。现在审查 K 系列测试文件。
K 系列测试符合计划。检查 `dsh-agent` 工厂如何把 `teardown` 传给 AgentLoop。
核心层通过。现在审查 Subagent 侧 `continuation-activation.ts`。
查看 `continuation-activation.ts` 关键区域的当前完整实现（构造器、materialize、dispose、drain、disposeRoots）。
查看 `dispose`/`drain`/`SubagentInbox.close` 的当前实现。
Subagent 激活层结构符合计划。现在审查 `subagent/src/index.ts` 的 binding 接线。
需要核实 Cordis 卸载时 disposables 的实际执行顺序。
核对 inject 子 fiber 的创建与绑定 effect 的卸载顺序语义。
这里出现一个关键疑点：绑定 effect 内 yield 顺序（childFiber.dispose 先、slotClear 后）在 Cordis 反序卸载下意味着 slot 清空发生在 manager drain 之前。我需要读 S 系列测试与相关证据来核实。
S 系列测试本身完备，但绑定 effect 的 yield 顺序与 Cordis 反序卸载语义的关系需要实证。用 vendored Cordis 做一个最小实证：
**关键发现（实证）**：`subagent/src/index.ts` 绑定 effect 的 yield 顺序在 Cordis 反序卸载下实际执行为「先清 slot、后开始 manager 卸载」——与代码注释及 plan §6.4「drain/结构释放/错误观察完成之后才清空」相反。继续审查 Team 侧后再综合裁决。
Team 实现符合 §7。核对 roster.liveChildrenByRoot 的存活过滤与 team.spec.ts 修订。
查看 continuation.spec.ts 的 fixture 调整与 Team teardown 测试。
Team 测试完备。现在核对验证证据与 FINDINGS、进度文件（含 built smoke 实际情况）。
发现一个疑似从未被读取的字段。核实 `TeardownRecord.completion` 的使用：
核对 40/0 终态的具体运行记录（08 显示 39/1，需要找到 40/40 的那次）。
# r44-B 硬审核报告（指定 OpenCode，zhipuai-coding-plan/glm-5.3，variant max）

候选完整性：11 个文件 SHA-256 与 `candidate-r44b.md` 逐一相符，工作树改动范围与申报一致，HEAD `e8d1858` 未移动。R1 证据链（04/05/06）真实支持 §5.3 扩围结论。以下为逐项核对结果。

## 一、逐文件核对（对照 plan §4/§5.3/§6/§7 + S1–S4）

**1. `core/agent/src/index.ts` — 符合。** `AgentTeardownHooks`（begin/beforeRelease）与 §6.1 逐点对应：绑定 exact Agent、共享 completion、禁止自等均写入 JSDoc；`teardown` 为 Create/Resume 可选字段，未新增 wire 方法、Session 事件或模型输入（§5.3 上限）。`AgentLoop.createAgent/resume → setupAndPublish → prepare` 全链转发 hooks，注册表代理透传。

**2. `core/agent-loop/src/index.ts` — 符合。**
- `FactoryOwnership.dispose`：先关 admission（accepting=false、teardown.abort(notActiveError)、inactive.resolve），同步启动全部 liveAgents disposer + startupTasks（`.map(d=>d())` 并行启动），逐项 await 收集失败，单失败抛原对象、多失败 `AggregateError` —— 满足 S2"逐项启动和收集、全部 settle 后报告、不用静默 allSettled、保留任意原始 rejection 值"。
- `prepare()`：completion 先于任何可重入步骤发布（`disposing = completion.promise` 在 abort/侦听器摘除之前）；begin 在 cancel 之前同步调用（K03 断言 inbox 投影仍存活 + completion 同一性）；义务顺序 cancel→whenIdle→beforeRelease→scope.dispose→handle.close→detach→untrack，各项独立 try/catch 收集（K06 双 sentinel 全序验证）；scope 的 `rawDispose` 经**同 fiber**（loopCtx）的 `agentLoop.providerOwnership(id)` 复合 effect 收集，`vendor/cordis/src/fiber.ts:449-451` 的 `collect` 删除 sibling 注册——K11 缺口的精确修复；wrapper 退役标记 + `initiatedBy` 跳过避免自等（K02 三方加入同一 completion，identity 断言通过）；工厂原因前置融合（`notActiveError` 共享实例）。未发布 rollback（K07）与同 ID 后继隔离（K08）均有真实入口测试。

**3. `core/agent-loop/src/agent.ts` — 符合。** clear 失败捕获后仍执行 `wakeRequested=false` 与 `abort.abort(cause)`，最后重抛原始错误（§5.3；K05 验证 abort 后驱动真实退出、原 sentinel 保留）。

**4. `subagent/continuation-activation.ts` — 符合（一处小瑕疵）。** TeardownRecord 先于 create/resume 建立；`begin` 记录事实并对 resident epoch 触发 `void this.dispose(live)`（不等待）；`beforeRelease → prepareRelease('owner')` 进入 memoized `P(x)`；三入口（parent/owner/natural）共享一次准备，natural 不重复 flush；`finishDisposal = P(x) → handle.dispose()（加入 H）→ 一次终态 → 逐项 bookkeeping`；child-first 在 P(x) 内等待每个 child 的完整 `C(child)`（S02 断言孙→子终态次序）；`drainThenReleaseScope` 显式事务修复 effect 链短路（§3.3 缺口 1）；`disposeRoots`/聚合均以 `cause` 保留对象 identity（S09 双 sentinel）；权限检查（exact live parent/ancestry）未放宽（S10）。自然 settlement 的 maintenance 回调返回自身有限工作、C(x) 在回调外等待——无 `M→C→H→P→M` 环（S13 验证）。小瑕疵：`TeardownRecord.completion` 只写不读（finishDisposal 经 `handle.dispose()` 加入 H，未消费该字段），属死状态，违反 packages/AGENTS.md"每个状态需当前 owner"。

**5. `subagent/src/index.ts — 不符合（关键发现 F1）。** 绑定复合 effect：
```ts
yield childCtx.fiber.dispose          // 先收集
yield () => { if (this.continuations === manager) … = undefined }  // 后收集
```
Cordis 复合 effect 卸载按**收集反序**执行（`fiber.ts` effect `dispose()` 的 `disposables.splice(0).reverse()`；本人以 vendored Cordis 最小脚本实测：卸载顺序为 `slot-clear` → `child-fiber-dispose-start`）。即 **slot 清空发生在 manager 子 fiber 卸载（drain+结构释放+错误观察）开始之前，并贯穿整个进行中的 drain**。这违反：
- §3.2 所有权事实："manager 的关闭仍在进行时不能清空 `this.continuations`"；
- §6.4："在该 lifetime 的 drain、结构性释放和错误观察**完成之后**，才按 exact manager identity 清空"；"manager-less no-op……不能因 slot 提前清空跳过真实 drain"；
- S4.1 末段同一要求。
后果：SubagentRuntime 卸载窗口内，并发的 Team `disposeRuntime`（root 卸载）或 ACP `drainContinuableDescendants` 命中 no-op，未加入真实 child drain即继续。代码注释与 FINDINGS.md 实现摘要第 5 条均声称相反行为；同候选另外三处复合 effect（providerOwnership、continuations()、runtimeLifecycle()）顺序皆正确，唯独此处反了——且 FINDINGS"Mechanism findings"第 1 条表明执行者已知反序语义，属实施滑误而非另一种设计。无任何测试钉住该窗口（S01–S13、T03 均未覆盖）。

**6. `experimental/agent-team/src/index.ts — 符合。** 投影移入 `inject:['sessionProjections']` 专用子 fiber，复合 effect 收集其精确 disposer，卸载先 `closeThenReleaseScope`（closeRuntime→owner.dispose，显式事务防短路）后幂等 raw disposer——与注释一致且实测语义吻合；`closeRuntime` 一次性可加入（`runtimeClosure ??=`；T05 三次调用同一 Promise identity）；`disposeRuntime` 对已接纳 creation/dispatch 及每个 selected-child drain 保存真实 Promise，`withTimeout` 仅观察期限、超时记为错误但 `await settled`/`heldDrains` 等真实静止（T04/T07 与 team.spec §7.3 修订用例：deferred 可释放、超时后关闭未完成且投影仍在、gate 放行才回收）；重采样循环覆盖边界期完成 provisioning 的成员（`liveChildrenByRoot` 仅遍历存活 agent，无 stale-parent 越权）；`internal/status` 祖先卸载同步启动同一事务；权限与 fail-loud 语义未动（T08）。

**7. 测试文件。** K01–K11/S01–S13/T01–T08 均为真实入口（真实 Cordis/AgentLoop/JSONL/领域插件 + 本地 fake 模型），sentinel 按 identity 沿因果树断言，gate 在 finally 放行——符合 §9.5。team.spec 两处 timeout 用例修订与 §7.3 逐句对应，`TeamServiceInternals.closeRuntime` 为白盒签名最小增量；continuation.spec 单处 fixture 调整（`.catch(() => undefined)` 后仍注入独立故障）确因共享关闭接口改变了真实路径 rejection 行为，属 §9.6 允许的最小修改。

**8. 负控与运行证据。** 07 号摘要：Team 旧所有权 mutation（exit 1 → 字节恢复 SHA `2efd7a0d…` 一致 → positive 0）、Subagent 旧早退 mutation（exit 1 → `612fa4e8…` 一致 → positive 0），对最终冻结字节执行，满足 §12。基线 38/2（04）、R1 三用例在目标断言失败（05/06）、run 09 内基础 40 全绿、run 31 三套 32/32、run 25 团队 75/75——与申报一致（run 19 的 T05 不稳定已如实记录并修复后复验）。

## 二、未完成项对 §14.3 的影响（均已在工作树核实为真）

| 未完成项 | 计划条款 | 对完成标准的影响 |
|---|---|---|
| TS keyless 快照三件（`snapshots/sdk/subagent-teardown`、`agent-team-teardown`、`teardown.snapshot.ts`） | §10.1/S4.3（"必须增加"/"必须保留完整证据链"） | **直接击穿 §14.3 第 9 条**（"必需 keyless Session……实际通过"）。本轮改动属"非平凡产品与 Session 生命周期行为"，该要求不可豁免 |
| Python `sdk-teardown` + PY-B01..B07 + `smoke-python-runtime.py` 支持 | §10.2/S4.4 | 同上，"双 SDK"仅 TS 一侧存在；第 9 条不满足 |
| built smoke（`DSH_EXAMPLE_MODE=lib` 重放） | §10.3/S4.5（"源码运行成功不能替代 built 证据"） | 第 9 条不满足；本轮扩展公共 Agent 类型并涉发布运行时路径 |
| 双语 Agent Note 三件、两领域包/core README、`docs/architecture.md` | §10.4/S3 | **击穿 §14.3 第 10 条**；同时违反仓库级 AGENTS.md"非平凡改动必须在同一 PR 附 Agent Note""文档随代码变更" |
| hygiene 14/16（node-next types 无诊断失败；vendored links 既有条件） | §11.4 | 第 9 条"适用 hygiene 检查实际通过"未全额成立；node-next 失败原因未定位，而该门禁恰保护本轮扩展的公共 `dsh-agent` 类型面，不能在未诊断下视为已豁免 |

结论：即使不计 F1，候选也仅在 §14.3 第 1–8 条上成立，第 9、10 条明确未满足且执行者已如实申报"block completion"。

## 三、综合裁决

- 核心共享关闭设计（H/P/C/W 分层、异常继续释放、child-first、timeout≠静止、权限不变、无自等）在六个生产文件中的五个已正确落地并有强测试与双负控佐证；
- 但 `subagent/src/index.ts` 绑定 effect 的 yield 顺序与 §6.4/S4.1 的显式等待关系相反（实测证实，注释与证据摘要均与实际行为不符），构成必须返工的生产缺陷，任何修复即形成新候选；
- 且快照/双 SDK/built/文档/hygiene 五类必需验收未完成，§14.3 第 9、10 条不满足。

`FAIL`

（返工路径提示，非裁决一部分：交换绑定 effect 两个 yield 的顺序使 slot 清空位于子 fiber 卸载 settle 之后，并补一个钉住"manager 卸载进行中 drainContinuableChildren 仍加入真实 drain"的用例；随后补齐 S4.3/S4.4 快照与输入检查、built 重放、§10.4 文档，再作为新候选重审。）
