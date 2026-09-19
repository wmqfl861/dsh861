# r44 production-teardown repair plan v1 — r44-B supplement (S1)

| 项目 | 内容 |
|---|---|
| 补充版本 | `S1`，2026-09-17；仅增补冻结 `plan.v1` |
| 适用计划 | `development/remediation/2026-09-17/production-teardown-r44/planning/plan.v1.md`，51955 bytes |
| v1 SHA-256 | `4b666af39f993ac1253c079786d1bc87391caf8d91abcff35b4f25f3fa41141c` |
| v1 Git blob | `e28695c08b43cec50c196f3fa252543a014ce847` |
| 本轮起点 | `chore/latest-stable-upgrade-20260912`，HEAD `e8d1858ca6a65710c346007e48809580f6064beb` |
| 生产／测试源码基线 | `9d0db65683b7925e37dc84578e23cba2a83e589c`；上述 HEAD 相对该基线仅新增 r44-A 归档证据 |
| 指定规划设置 | 真实 Codex CLI，`gpt-6-astra`，`model_reasoning_effort=max` |
| 本次交付 | 补充正文；未实施、未运行 R1 动态取证或后继验收、未取得生产硬审结果 |

本补充依据 `input-review-comment-5706427680.md`、`input-task-comment-5706434230.md`、`input-authorization-comment-5706912474.md` 及本次任务中的所有者最新指示。有限范围批准和指定 OpenCode 就绪条件已经满足，不因历史评论或冻结计划仍记载待批准／认证阻断而重新核验或要求重复批准。R1 技术取证、必需验证及固定候选硬审仍须执行。

原 `planning/planner-invocation.md` 所记完整 argv 与退出码继续为 **MISSING**。本补充调用的完整 argv、退出码及原始输出由执行者独立捕获并关联 `S1`，不得用本次调用补造或替换原调用证据。

## 逐条修订／增补表

| v1 节号 | 本补充条目 | 性质 |
|---|---|---|
| §1、§2、§5.3、§8 R0 | 适用基准及 S3：承接已满足的启用条件，确认有限可写上限 | 范围确认 |
| §5.2 第 160 行、§5.3 第 176 行、§8 R1、§9.2 S03、§9.4 K01–K03 | S1：旧接口取证与新 hooks 验收分列；定义有效首失及缩减范围处理 | 澄清 |
| §6.1、§6.3、§8 R2、§9.4 | S2：真实 factory 的多 handle、启动工作及错误等待验收 | 新增验收 |
| §5.3、§8 文件责任、§10、§13、§14.2 | S3：生产、测试支持、文档、快照及证据的有限范围 | 范围确认 |
| §4、§6.1–§6.4、§7.2、§9.2–§9.5 | S4：共享准备、handle、Activation、maintenance 与 owner wrapper 的等待关系 | 澄清／新增验收 |
| §9.4 数量汇总、§10.1–§10.3、§11.1、§11.3、§12、§14.3 | S4：新增用例计数、真实关闭快照、Python 输入检查及验证增量 | 澄清／新增验收 |

## S1 — R1 仅使用旧接口形成真实轨迹

**修订 v1 §5.2 第 160 行及 §8 R1。** R1 通过现有 `agents.create()`、`agents.resume()`、`setup`／`commit`、scope、registry 和真实 fiber 卸载入口覆盖内部 `prepare()` 路径。R1 不增加 `AgentTeardownHooks`，不使用 `begin`／`beforeRelease`，不先修改 core 以制造扩围依据。

R1 与 R2 的顺序细化如下：

1. **R1-a：固定旧实现和观察设施。** 记录六个生产目标的基准身份及测试候选。复用 `packages/core/agent-loop/tests/scope-lifecycle.spec.ts` 的真实 Cordis／AgentLoop 组合、scope 生命周期事件和 deferred 设施；需要新增的观察代码放入已批准的测试文件，不复制生产关闭算法。
2. **R1-b：执行旧接口用例。** 运行下述 `R44-K11`、S2 的 `R44-K09`／`R44-K10`，并取得 `S03` 所需的旧接口 factory／continuation 竞争轨迹。记录 exact consumer fiber、factory fiber、Agent、scope 和 handle 身份，以及取消、真实 driver 完成、scope 撤销、写 handle 关闭、registry 退出、factory 事务及 provider fiber 的各自完成点。
3. **R1-c：形成技术裁决。** 按具体路径记录“缺口成立”“已有结构性等待覆盖”或“证据不足”，再决定是否进入 R2。范围批准不替代这一步。
4. **R2：实施后验收新接口。** 只有 R1 支持相应修改时，才实施 hooks 与 core 接线并加入、运行 `K01–K08`。其中 `K01–K03` 属于新接口验收，不能充作旧实现首失。

R1 期间的测试文件必须能在旧接口上完整加载和运行；仅用 `-t` 跳过测试名称，不能消除同文件中不存在的 import、字段或接口造成的失败。旧接口取证与实施后验收分别保存候选身份、实际命令、退出码和轨迹，不将两次运行合并记账。

| 新增编号 | 文件归属 | 行为与判据 |
|---|---|---|
| `R44-K11` | `packages/core/agent-loop/tests/teardown-ownership.spec.ts` | 使用不同 consumer／factory fiber 创建真实 Agent，在取消已发生、真实 driver 清理仍被 gate 阻挡时卸载 provider；观察 scope 注册及合法 inbox 使用是否被提前撤销。候选必须保持依赖直到真实使用完成，再释放 scope、handle 和 registry。 |

**有效首失**只指新增回归在旧实现上已经到达目标行为，并因目标缺陷本身违反断言而失败。类型错误、接口不存在、fixture 启动失败、静态字符串断言和无因果轨迹的超时均不计入。单纯观察轨迹也不自动算失败用例；旧实现已通过的分支如实登记为非回归，不人为制造红灯。

实例级包装只用于本 fixture 拥有的真实对象，必须调用原路径并保持原始结果、错误及被收集 disposer 的身份；不得用 resolved stub 替换真实清理。握手采用 `entered → checkpoint → release → completed`，所有 gate 在 `finally` 放行并等待已启动工作结束。

若旧接口真实轨迹否定 §5.3 的扩围依据，停止相应 core 实施。若证据证明三个领域文件即可满足 v1 §4 全部不变量，按 v1 第 176 行由本指定 Codex 另行出具版本化缩减补充，明确撤下哪些 core 修改及其专属支持工作，并保留全部行为验收；实施者不得自行取消验收、改写设计或继续按源码猜测扩围。本次尚无该动态证据，不预先宣布缩减结论。

## S2 — factory 层必须等待全部已启动清理

**增补 v1 §6.1、§6.3、§8 R2 和 §9.4。** 本次源码核对确认：

- `packages/core/agent-loop/src/index.ts` 的 `FactoryOwnership.dispose()` 对 `liveAgents` 返回的 Promise 与 `startupTasks` 使用 `Promise.all`；`agentLoop.transactions()` 是其真实生命周期入口。
- `vendor/cordis/src/fiber.ts` 的 `_unload()` 另外等待被收集的 disposer，并通过结构化 logger 报告 disposer 错误；`runDisposable()` 还会加入已经开始的 effect 清理。因此，factory 聚合方法提前拒绝不能直接推出整个 provider fiber 已提前结束。
- `trackWrapper()` 将公开 create／resume 的结果转换为等待 settlement 的 Promise；原公开调用仍承担其调用失败。配置启动另有 `reportConfiguredStartupFailure()`。取证必须区分这些错误归属，不能把已经转换的 Promise 当作尚未观察的原始 rejection。

审阅评论中的 Node22.16.0 隔离对照只证明局部控制流，不作为本轮真实 provider 验收。R1 必须分别观察 factory 事务和 provider fiber；即使外层结构性 disposer 延长了 provider 等待，也必须记录 factory 自身是否过早结束及是否漏报其他错误。

新增 **2 个**用例，均位于 `packages/core/agent-loop/tests/teardown-ownership.spec.ts`：

| 编号 | 真实输入与握手 | 必须观察到的结果 |
|---|---|---|
| `R44-K09` | 同一 factory 拥有互不为父子的 handle A／B；A 的真实释放路径先产生 sentinel A；B 的真实写 handle 关闭或其他必达清理仍被 gate 阻挡。B 放行后执行真实清理，并注入第二个独立 sentinel B | gate 放行前，factory 事务不能 settle，provider 也不能宣布完成；B 放行且全部已启动工作 settle 后才报告失败，原因树保留 A／B 原对象。分别记录 handle、factory 事务、provider fiber 的完成点及 B 的物理资源状态 |
| `R44-K10` | 通过真实 create／resume 或配置启动路径，使已接纳启动工作处于未发布或 rollback 阶段；在其真实资源回收处设置 gate，同时触发另一个 handle 的同步取消故障 | 一个失败不能跳过其他清理的启动或等待；factory 等待自己收录的启动工作完成；未发布对象不产生 resident 假终态；公开调用错误与 factory 清理错误分别保留原值并由各自 owner 观察 |

`K10` 须在轨迹中区分原始外部操作、`raceAbort` 等待层、`trackStartup()`／`trackWrapper()` 收录的任务以及实际资源回收。只挂住已被取消竞争脱离的 setup Promise，不能证明 factory 漏等；只看到 wrapper 已 settle，也不能证明其资源已释放。

同步异常按真实可达性评估：现有 handle teardown 在 async 函数体内调用 `cancel()`，其同步抛错会成为 handle Promise 的 rejection；不得把这一分支误记为 `liveAgents.map()` 的直接同步中断。若候选在调用某个关闭入口时存在可达的直接同步抛错，必须在该调用点收集错误并继续启动其他义务，以真实入口证明；不向私有集合塞入不代表生产路径的假 disposer。

R2 对 factory 的完成要求是：先关闭 admission 并发布可加入的关闭状态；覆盖截止前已接纳的 handle／启动任务；逐项启动和收集结果；全部应等待工作 settle 后再报告所有原始清理错误。截止后不再接纳新的生产工作。允许使用适合的 settled-result 收集方式，但不得机械替换 `Promise.all`、忽略 rejected 项或新增静默 `allSettled`。保留 `undefined` 等任意原始 rejection 值，不能用它兼任“没有失败”的标记。

Cordis 的 logger 报错与 Promise 拒绝分别观察。故障用例不能仅断言 `fiber.dispose()` 是否 resolve；r43 observer 仍负责让已记录的清理失败拒绝 `owned.cleanup()`、跳过 `afterDispose` 并保留目录。

## S3 — 有限范围确认

**确认 v1 §5.3、§8、§10、§13 和 §14.2 的本轮可写上限。** 所有者 2026-09-17 的批准已登记于 `C:\dsh-r24-upgrade-20260912-01\r44b-scope-approval\scope-approval-registration.md`。本补充承接该批准，不将旧评论中的待批准状态重新施加于本轮。

| 类别 | 已批准路径及限制 |
|---|---|
| 领域生产目标 | `packages/experimental/agent-team/src/index.ts`；`packages/subagent/subagent/src/continuation-activation.ts`；`packages/subagent/subagent/src/index.ts` |
| core 扩展 | `packages/core/agent/src/index.ts`；`packages/core/agent-loop/src/index.ts`；`packages/core/agent-loop/src/agent.ts`；仅实施 R1 证据支持的 teardown 职责 |
| 已有测试支持脚本 | `scripts/smoke-python-runtime.py`；仅本轮 keyless／built-CLI 支持及其输入检查 |
| 新增 owner-local 测试 | `packages/subagent/subagent/tests/continuation-teardown.spec.ts`；`packages/experimental/agent-team/tests/teardown.spec.ts`；`packages/core/agent-loop/tests/teardown-ownership.spec.ts` |
| 既有直接测试 | 仅 v1 §9.1、§9.6、§11.1 及 r44-B 清单明确涉及、且接口或行为确受影响的文件；不由此获得整个测试目录写权限 |
| 文档 | v1 §10.4 明列的领域／core README 中英文及配对文件、获批源码内 JSDoc、`docs/architecture.md` 对应生命周期说明及双语配对、该节列出的 `2026-09-17-production-teardown-ownership` Agent Note 三件 |
| 新 Session／SDK 快照 | `snapshots/sdk/subagent-teardown/`；`snapshots/sdk/agent-team-teardown/`；`snapshots/sdk/teardown.snapshot.ts`；`scripts/snapshots/python-sdk-single-exe/production-teardown/` |
| 本轮证据 | r44 证据根内本轮版本化补充、真实轨迹、运行记录、候选和审核材料；冻结原件保持原字节 |

`packages/subagent/tool-subagent-control/tests/owned-contexts.ts` 与 `packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts` 仍冻结，blob 分别为 `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5`、`56a60a2f9c8cc753522ae53ae4bdb9d5dc886291`。原 40 个用例、两个正常 teardown 成功期待及三个 `afterDispose` callback 的要求不变。

vendor、scope、core inbox、session-projection 框架、持久化／lease、锁、workflow、模型配置、`P0-B state`、冻结历史证据均不在可写范围。v1 §7.3 明列的其他 Team 生产文件继续只读。

批准清单是上限，不是必须修改的文件集合。若实现、生成文档、快照 adapter／manifest 支持或输入测试确需清单外文件，先报告最小可复现证据、准确文件清单、必要职责及清单内方案为何不足；相关步骤等待范围决定和必要计划修订，**不先写**。门禁报错、生成器输出或“只是测试支持”均不自动扩大权限。

## S4 — 等待关系、真实关闭快照与验证增量

### S4.1 关闭事务的等待关系

**细化 v1 §4、§6.1–§6.4 和 §7.2。** 对 exact Agent／handle／residency epoch `x`，以下符号仅表示等待关系，不要求新增同名公共 API：

| 符号 | 含义 | 可以等待 |
|---|---|---|
| `P(x)` | 共享、一次性的释放前准备 Promise | 已拥有 children 的完整 `C(child)`、相关已接纳 child materialization、自己的真实 activity 完成、合法 flush／capture |
| `H(x)` | `begin(agent, completion)` 提供的真实 handle 清理 completion | `P(x)`，以及 driver、scope、写 handle、registry 等自己的释放义务 |
| `C(x)` | `SubagentInbox.close()` 发布的完整 Activation 关闭 Promise | `P(x)`、`H(x)`，随后完成终态及 bookkeeping |
| `W(x)` | consumer／structural owner 的 handle wrapper | 同一个 `H(x)`；不自行重建另一条 scope 释放路径 |
| `M(x)` | 当前 `runMaintenance()` 的实际工作完成 | 自身 maintenance 回调的有限工作，不等待 `P(x)`、`H(x)` 或 `C(x)` |
| factory／manager／Team owner | 各自拥有的上层关闭事务 | factory 等待 handle 与启动任务；manager 等待已接纳 materialization 和 `C(root)`；Team 等待已接纳工作及先前取得的真实 drain Promise |

必要的依赖方向为：

```text
factory ──→ H(x) ──→ P(x) ──→ C(child) ──→ H(child) ──→ P(child) …
   └─────→ 已接纳启动任务 ──→ 其发布或 rollback

manager ──→ 已接纳 materialization／C(root)
C(x) ──→ P(x)，再加入 H(x)，最后完成终态和 bookkeeping
W(x) ──→ H(x)
P(x) ──→ 真实 activity 完成；maintenance 回调必须能够先返回
```

实施须满足以下具体顺序：

1. **可重入发布。** 在 abort、cancel、hook、事件或真实 release 回调之前，先发布该层共享 Promise 和关闭 admission。`H(x)` 先发布，再同步调用 `begin`；`begin` 绑定 exact 对象并使相应 Activation 进入已有或新建的 `C(x)`，本身不等待它。`P(x)` 同样先缓存 Promise 再开始准备，禁止同步重入启动第二份准备。
2. **完整关闭与准备分开。** normal／selected／manager 关闭先经 `SubagentInbox.close()` 发布 `C(x)`，取得 `P(x)`，准备结束后调用或加入 `H(x)`。共同 owner 已先启动 `H(x)` 时，`beforeRelease` 只加入同一个 `P(x)`。**`P(x)` 不等待本对象的 `H(x)`、`C(x)`、owner wrapper 或上层 drain；`H(x)` 不等待本对象的 `C(x)`。** 这样既没有 `H → P → H`，也没有 `H → P → C → H`。
3. **child-first。** 关闭 admission 后，保留已接纳 child 工作及 exact 所有权记录；对稳定的 owned-child 集合逐项启动关闭，等待每个 child 的完整 `C(child)`，再完成 parent 的 idle、flush、capture，最后释放 parent 的 scope／handle。child 的终态投递不得等待 parent 的关闭、idle 或上层 manager drain。关闭状态发布用的 child lock 不得跨越这些完整等待。
4. **自然 settlement。** 保留最终 seq 复核和 `finalStateFlushed` 的事实条件。`runMaintenance()` 回调可以同步发布 `C(x)`，但必须返回自己的有限工作结果，不能返回或 await `C(x)`、`P(x)`、`H(x)`；完整关闭由回调外等待。`P(x)` 才能安全等待包含该 maintenance 的真实 `whenIdle()`。不得用 `status === 'idle'` 绕过这一等待。
5. **未发布 materialization。** create／resume 前建立关闭记录；若 owner 在返回前关闭，hook 不得等待本对象尚未返回的 create／resume 或 materialization Promise，否则形成“创建等待 rollback、rollback 等待创建”的环。该对象完成真实 rollback，不调用 resident `start`／`capture`／`settle`；上层 manager 独立等待 materialization 的最终结果。
6. **owner wrapper 的加入与撤销分开。** 普通 owner 卸载进入 `W(x)` 时，即使 `H(x)` 已存在也必须加入它，不能因 `disposing !== undefined` 提前返回。`H(x)` 不得反过来 await 正在等待自己的 wrapper。资源释放完成后撤销尚未执行的 wrapper，须先同步标记“仅撤销注册”，使该回调不再加入 `H(x)`；已经执行的 wrapper 则由它在 `H(x)` settle 后自行结束。不能只依赖首次调用的 `ownerTriggered` 参数，因为另一 owner 可以稍后进入。
7. **异常继续释放。** child、cancel、idle、flush／capture、handle 或终态的一项失败均被记录，其余可执行义务继续。准备失败须等已启动准备工作 settle 后才报告，`H(x)` 收到准备失败仍执行后续释放，`C(x)` 收到 handle 失败仍处理终态和 bookkeeping。所有原始错误可沿因果树找回；terminal 至多一次，handle 关闭后不重新 capture。

上层 manager lifetime 必须等完整 drain、`activationOwner` 结构性释放及错误观察后，才按 exact manager identity 清 slot；不能在 `P(x)`／`H(x)` 内卸载这个上层 lifetime。共同 owner 触发的 `C(x)` 也必须由实际 lifecycle owner 持续观察，不能转成无人负责的后台 rejection。

权限规则保持 v1：只有仍具 exact live authority 的入口可以新启动 selected／descendant 关闭；authority 消失后，内部仅加入此前合法取得、绑定 exact epoch 的 Promise。Team 须在合法采样时保存这些 Promise，不以 stale parent 发起新 drain，也不重新 materialize 已关闭目标。

### S4.2 新增验收及数量

| 编号 | 文件归属 | 新增验收 |
|---|---|---|
| `R44-S13` | `packages/subagent/subagent/tests/continuation-teardown.spec.ts` | 自然 settlement 已进入真实 maintenance，`C(x)` 已发布而 maintenance 完成仍被 gate 阻挡；此时并发触发共同 owner／manager 关闭。gate 前 scope 保留，gate 后所有等待者完成；一次准备、一次合法 capture、一次 terminal，原错误仍上报，无 `M → C → H → P → M` 等待环 |

`K02` 增加 owner-first、handle-first 后 owner 加入、资源完成后撤销 wrapper 三种握手；`K03` 检查同步重入只取得已发布 completion；`K04` 检查 child completion 的完整等待；`K07`／`S05` 检查未发布 materialization 不自等。它们是既有编号的验收细化，不重复计数。`T03`／`T05` 同时检查 Team 只加入合法保存的关闭 Promise。

本补充新增 **4 个 owner-local 用例编号**：`K09`、`K10`、`K11`、`S13`。计划合计为 Subagent 13、Team 8、core 11，共 **32 个新增 owner-local 用例**；加原始 40 个，目标 **72 个**。参数化展开、邻接非回归、SDK 场景、输入检查和负控按实际注册／执行次数另报，不能混入原始 40。

### S4.3 Session／双 SDK 快照必须产生真实关闭后缀

**细化 v1 §10.1–§10.3。** 两个 TypeScript 场景及 Python `sdk-teardown` 场景必须保留以下完整证据链：

1. 在独立测试目录启动候选的真实 `dsh --profile sdk`，挂载真实生产插件，只替换模型等外部不确定输入；建立父／子及必要孙 Activation，确认真实 held request 与待处理 inbox 已存在。
2. 在关闭前记录各 Session 的 seq、持久前缀及 epoch。通过真实协议或场景内测试 plugin 调用真实 disposer 触发关闭，记录触发身份和取消握手；测试 plugin 不得手写 terminal 事件、替换生产清理或把预期日志复制成运行结果。
3. gate 尚未放行时，检查关闭未完成及所需 scope／projection 仍存在；放行后观察真实新追加事件、终态唯一性、取消原因和 pending inbox／turn／step 收尾。
4. 等待写 handle 的真实关闭后，从原目录重新读取持久日志，逐 Session 比对关闭前缀之后的新增事件及最终 seq，并完成原目录写所有权接管与 takeover close。

完整 golden 可以保存最终日志，但关闭后的事件必须由本次真实运行重新产生，不能作为预制完成历史载入后直接比对。恢复场景允许加载必要历史前缀，必须单独标明本次关闭新产生的后缀。

SDK 通知与 Session 持久事件分列验证。需要观察 `subagent.started`／`subagent.finished` 等实时终态时，在连接和订阅仍存活时触发实际领域 plugin 关闭；随后再执行 runtime shutdown 并核对磁盘结果。不能假定 `shutdown` 期间已撤销的订阅仍会发送通知，也不能用通知存在代替持久化追加。shutdown 响应、SDK `close()` 返回及进程 exit 0 各自不足以证明资源静止；必须记录真实退出且无 timeout／terminate 代替正常完成。

已有 `snapshots/sdk/sdk.snapshot.ts` 自动发现 SDK 场景。新场景必须与现有发现及 corpus 检查一致，避免一个 adapter 等待正常完成而另一个才负责触发关闭；不得删除必要 manifest 字段来逃避检查。优先在获批的新场景目录及 `snapshots/sdk/teardown.snapshot.ts` 内完成支持，确需既有 adapter／gate 修改时执行 S3 的先报告规则。

### S4.4 Python built-CLI 支持及接受／拒绝检查

**补充 v1 §10.2 和 §11.3。** `scripts/smoke-python-runtime.py` 当前没有 `sdk-teardown`／`--dsh-bin`，这些是待实施的测试支持。另据 `python/sdk/src/deepseek_harness/client.py`，公开 `dsh_bin` 当前作为单一可执行文件路径使用；不能把 Windows 上的 `apps/cli/lib/bin.js` 直接当成可执行程序。

启动适配限定在获批 smoke 脚本内：校验本候选 built CLI 后，使用 SDK 已有测试私有 `_launch_args` 构造固定的 `node <built CLI> --profile sdk` 及场景 patch 参数，并显式设置独立 `dsh_home` 所需环境。该私有路径不会自动执行 `_default_launch_args()` 的环境和 profile 组装，脚本必须完整承担这些设置并验收。不得修改 Python SDK、增加公开任意 argv 参数或新增产品入口。

同一候选包含以下 **7 组**实际脚本入口检查；参数化物理运行次数单独记录：

| 编号 | 输入 | 接受／拒绝要求 |
|---|---|---|
| `PY-B01` | `--scenario sdk-teardown --dsh-bin <本候选 apps/cli/lib/bin.js 绝对路径>` | 接受；真实 keyless 场景完成并比对 Python 结果、通知及父／子日志 |
| `PY-B02` | `PY-B01` 加 `--update-snapshots` | 仅更新本轮 `production-teardown/` 预期；随后独立执行无更新参数的比对 |
| `PY-B03` | `--scenario sdk-teardown` 缺少 `--dsh-bin` | 在创建模型服务或启动 runtime 前拒绝 |
| `PY-B04` | `--dsh-bin` 与 `--exe` 同时提供 | 拒绝 |
| `PY-B05` | `--dsh-bin` 与 `--installed-wheel` 同时提供 | 拒绝 |
| `PY-B06` | `--dsh-bin` 配合非 `sdk-teardown` 场景，包括默认 `all` | 拒绝，不把本轮模式隐式加入其他运行路径 |
| `PY-B07` | 路径不存在、为目录、指向源码或非本候选入口，或把整段命令作为路径 | 拒绝；路径按单个路径解析，不执行字符串命令 |

拒绝用例须核对非零 exit、明确诊断及未启动 runtime；仅得到 Python 异常或子进程启动失败不算参数校验通过。正常路径包括含空格路径的参数传递验证。缺少本地 Python 依赖或 built artifact 仍按 v1 如实阻断，不安装补齐、不以 skip 通过，不把该证据标成 installed-wheel 或平台 exe 矩阵验收。

### S4.5 执行与门禁增量

R1 完成 S1 的旧接口取证后，R2 先验证共享关闭及 `K01–K11`，再按原顺序进入 R3 Subagent、R4 Team；`S13` 随 R3 验收。R5 完成两个 TypeScript 场景、Python `sdk-teardown`、上述输入检查，以及候选 build 后的真实 built 重放。源码运行成功不能替代 built 证据。

v1 §11 的相关组合继续适用，数量按本补充调整；所有命令仍由后继执行者实际运行并留存独立结果。本补充不宣称任何新增验收已通过。

v1 §12 的 Team／Subagent 两个独立生产负控及逐字节恢复要求不变，不以 factory 首失或 Python 拒绝输入替代它们。新增等待关系由真实行为断言验收，不新增静态代码字符串门禁；快照只允许刷新本轮新场景，不能修改 normalizer、旧 golden 或已提交 Session generation 吸收错误。完整候选包含本补充、输入检查、快照和全部证据，经必需检查及指定真实 OpenCode 对固定候选明确 `PASS` 后，才按 v1 进行正常 hooks 提交和非强制推送。

## 适用声明

本补充没有新增批准清单外的可写目标。`plan.v1.md`、原调用证据及冻结历史保持原字节；本补充不改变 v1 其余内容。PR 继续保持 draft、原 base 和未合并状态，`P0-B` 继续 `blocked`，不进入 `P0-C`。
