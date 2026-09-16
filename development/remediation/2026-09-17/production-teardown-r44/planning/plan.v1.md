# r44 production-teardown repair plan v1

## 1. 计划身份、当前状态与交付边界

| 项目 | 内容 |
|---|---|
| 计划 ID | `production-teardown-r44` |
| 版本 | `v1` |
| 定位 | `chore/latest-stable-upgrade-20260912` 升级收尾中的生产 teardown 修复子任务；隶属当前 `P0-B blocked` 背景，不是 `P0-C` |
| 仓库 | `C:\Albert\project\dsh861`，`wmqfl861/dsh861` |
| 基准 HEAD | `9d0db65683b7925e37dc84578e23cba2a83e589c` |
| PR | 草稿 PR #13；保持 draft 与现有 base |
| 指定规划者 | 真实 Codex CLI，`--model gpt-6-astra -c model_reasoning_effort="max"` |
| 后继实施者 | ZCode；按本计划顺序实施、测试、整合和返工 |
| 指定硬审核者 | 真实 OpenCode CLI，`--model zhipuai-coding-plan/glm-5.3 --variant max` |
| 本轮交付 | 本计划正文；生产实现、测试运行、负控、提交、推送、硬审均不在本轮执行 |
| 建议归档位置 | `development/remediation/2026-09-17/production-teardown-r44/planning/plan.v1.md` |

状态必须分别记录：

- **`PLAN_READY`**：本计划正文已交付。归档者保存本次真实 Codex 调用的原始输出和调用证据，不能以可用性探针代替本次调用回执。
- **`IMPLEMENTED`：未执行。**
- **`VALIDATED`：未执行。** 当前已有复现仍为 **38 passed / 2 failed，共 40 个用例，exit 1**。
- **`REVIEW_PASS`：未取得。**
- **后继实施准入：`BLOCKED`。** 指定 OpenCode 在本机不可用；此外，第 5 节明确列出的保护面扩展必须先完成必要性取证并取得相应授权。

[cli-availability-probe.md](C:/Albert/project/dsh861/development/remediation/2026-09-17/production-teardown-r44/planning/cli-availability-probe.md) 已记录指定 OpenCode provider/model 不可用。不得通过登录、读取凭据、新增 Key、修改 provider 或更换模型解除此阻断。本计划不把上述状态写入 `development/nodes/P0-B/state.json`，也不创造节点通过记录。

## 2. 权威输入、基线与需求映射

本计划以 [task-comment-5701865211.md](C:/Albert/project/dsh861/development/remediation/2026-09-17/production-teardown-r44/planning/task-comment-5701865211.md) 为最高任务依据，结合 [receipt-comment-5701849308.md](C:/Albert/project/dsh861/development/remediation/2026-09-17/production-teardown-r44/planning/receipt-comment-5701849308.md)、本轮源码核对及既有失败日志制定。

规则依据为根 `AGENTS.md`、`NODE_DEVELOPMENT_RULES.md`、`packages/AGENTS.md`、`packages/experimental/AGENTS.md`、`docs/architecture.md`、`docs/defensive-patterns.md`、`docs/testing.md`、`snapshots/AGENTS.md`、`docs/AGENTS.md`，以及 `dsh-pre-push-checks`、`dsh-ci-test-reliability`、`dsh-doc`、`dsh-prose-standard` 对应的检查与文档要求。

本次只读核对得到：

```text
branch: chore/latest-stable-upgrade-20260912
HEAD:   9d0db65683b7925e37dc84578e23cba2a83e589c
status: ?? development/remediation/2026-09-17/
```

因此，当前工作树**不能描述为干净**。已有未跟踪 r44 输入与证据必须逐文件归属、保存，不能删除、覆盖或假定为前执行者未完成的垃圾。本轮没有查询远端，不声明远端 HEAD 已核对。

| 任务要求 | 本计划落实位置 |
|---|---|
| A：工作区、工具链、授权、指定执行者、P0-B 边界 | 第 1、2、5、8、13 节 |
| B：固定 blob、最小生产范围、保护面 | 第 3、5、6 节 |
| C：所有权与时序归因校正 | 第 3、4、9 节 |
| D1：Team 投影覆盖整个 drain | 第 7 节；`T01–T08`；Team 负控 |
| D2：共同 owner、memoized 清理、异常安全 | 第 5、6 节；`S01–S12`、`K01–K08`；Subagent 负控 |
| E1：原始 40 用例、两个失败、写锁探针 | 第 9.1、11 节 |
| E2–E3：真实入口、根/子 owner、握手顺序 | 第 9.2–9.4 节 |
| E4：sentinel 故障、继续释放、拒绝与留目录 | 第 6.3、9.5 节 |
| E5：权限、恢复、事件、快照非回归 | 第 9.6、10、11 节 |
| E6：两个独立负控、恢复与哈希 | 第 12 节 |
| F：检查、证据、文档、固定候选、硬审、交付 | 第 8、10–14 节 |
| G：使用既有源码与取证材料 | 复用现有文件；不下载覆盖、不重复完整 CI 取证 |
| H：禁止项、状态分离、未闭合问题 | 第 1、5、13、14 节 |

## 3. 经源码核实的所有权与归因

### 3.1 固定候选输入

| 文件 | 基准 blob | 责任 |
|---|---|---|
| [packages/experimental/agent-team/src/index.ts](C:/Albert/project/dsh861/packages/experimental/agent-team/src/index.ts:116) | `6fa0500eebff1f4eb865d5e290fa251c3beff0ea` | Team runtime、投影持有与释放、关闭时机 |
| [packages/subagent/subagent/src/continuation-activation.ts](C:/Albert/project/dsh861/packages/subagent/subagent/src/continuation-activation.ts:184) | `df2b6da439776918aaf5d6f4cbad07e9c7ef6dab` | Activation 所有权、materialization、关闭事务、child-first、异常聚合 |
| [packages/subagent/subagent/src/index.ts](C:/Albert/project/dsh861/packages/subagent/subagent/src/index.ts:201) | `8a91e06e56c63006d473d421113936ed2d0331ad` | continuation manager 的 binding 生命周期；本计划需要调整此接线 |

必须保留的测试保护面：

| 文件 | 固定 blob | 要求 |
|---|---|---|
| `packages/subagent/tool-subagent-control/tests/owned-contexts.ts` | `7713e57d18adab01b5ed4ceb59c08ebb66e3bfd5` | 不改文件与检测语义 |
| `packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts` | `56a60a2f9c8cc753522ae53ae4bdb9d5dc886291` | 不改文件与 10 个用例语义 |

### 3.2 所有权事实

| 资源 | 当前实际 owner 与路径 | 最后合法使用及修复要求 |
|---|---|---|
| Team 投影 `agentTeam` | `ctx.root.sessionProjections.register(...)` 使真实注册 effect 落在 root fiber；与 Team plugin 的卸载并行 | `disposeRuntime()` 内 `liveChildrenByRoot()` 仍须读取；必须移出独立 root effect |
| Team runtime | Team fiber 的 `agentTeams.runtimeLifecycle()` effect | pending creation、dispatch、selected child drain 全部静止后，才释放其投影 owner |
| continuation manager | `SubagentRuntime` 的 `ctx.inject(['agents'], ...)` child fiber | manager 的关闭仍在进行时不能清空 `this.continuations` |
| `activationOwner` | `ContinuableActivationRegistry` 创建的 child fiber，拥有调用 `agents.create/resume` 的 caller context | manager drain 后才释放；drain reject 也不能跳过结构性释放 |
| `AgentHandle` | consumer owner 与 AgentLoop factory provider 共同拥有；两者进入同一个 memoized `dispose` | 所有参与者必须加入同一实际清理；不能由 projection absence 推断完成 |
| Agent scope 与 inbox | `ReactLoopAgent` 在实际 `loopCtx` 下创建 scope；`ReactLoopInbox` 经该 scope 注册 `inbox` | cancel、尚未完成的 driver 与父子终态处理结束前，不能越过其合法读取 |
| Session 写 handle | AgentLoop 持有；JSONL backend 另有 open-handle teardown sweep | 关闭结果、最终持久事件和原目录锁释放必须独立验证 |

### 3.3 必须加入本计划的两项归因校正

**第一，`activationOwner` 并非仍作为同一 parent fiber 的独立 sibling disposer 存在。**

`vendor/cordis/src/fiber.ts` 的 `runner.collect` 将收集的精确 disposer 加入组合 effect，同时执行：

```ts
this._disposables.delete(dispose)
```

当前 `ContinuableActivationRegistry` 在同一 `ctx` 上创建 `activationOwner`，再 `yield scope.dispose`，因此其精确结构性 disposer 已被移入组合 effect。[source-evidence-ownership-map.md](C:/Albert/project/dsh861/development/remediation/2026-09-17/production-teardown-r44/planning/source-evidence-ownership-map.md) C3 中把它继续视作独立 sibling 的推断需要校正。保留该输入文件，另存本轮补充说明；不修改 r43 历史诊断。

真实缺口是：

1. effect 内逆序 `.then()` 链会因前一个 disposer reject 而跳过后续 disposer。
2. `continuationBinding` 仍是独立 effect。
3. factory provider 仍有独立关闭路径。
4. `AgentLoop.prepare()` 收集 Agent scope 的 `rawDispose` 时，caller owner fiber 与实际 scope parent fiber 可能不同；跨 fiber 收集不能移除另一个 fiber 的注册。

**第二，`SessionProjectionRegistry.register()` 返回的是包装函数。**

其返回值为 `() => void dispose()`，不是内部 effect 的精确 disposer。因此，把 `register(...)` 的返回值直接 `yield` 到一个 generator，不能证明内部注册已从 sibling 列表移走。Team 修复必须用可核实的 child-fiber 所有权转移。

`composeError` 拼入的是注册时捕获的 outer stack。`_reload`、`_execute`、构造函数与 fixture setup 等拼接帧不构成“销毁期间发生实时重加载”的证据。

## 4. 全部实现必须满足的顺序不变量

本轮以可观测的不变量验收，不以代码里出现 `finally`、无错误日志或集合为空验收。

1. **关闭事实先发布。** 每个 Activation 的关闭 Promise、共同 owner 的关闭通知及 manager 的关闭状态，在任何可重入操作前发布。
2. **同一对象、同一 residency epoch。** 关闭身份绑定 exact `Agent`、exact `AgentHandle` 和本次 Activation；同 ID 的后继对象不能继承前一对象的关闭状态。
3. **先停止与完成合法读取，再撤销依赖。** scope/projection 的结构性释放不能越过 driver 静止、child-first 准备与终态 capture。
4. **每项释放义务独立执行。** cancel、child disposal、idle、capture、handle disposal 或终态处理的一个错误，不能阻止其余可执行义务。
5. **完成与失败分开。** 全部可释放资源已经完成清理，仍可以且应当以错误结束；报错不等于允许提前停止清理。
6. **超时不等于静止。** timeout 只证明等待期限已过。未静止任务仍保有其资源，不能据此注销投影、完成 HMR 或删除目录。
7. **终态最多一次。** 一个已发布 residency epoch 只有一个关闭事务和一次 terminal 发布；未发布的 materialization rollback 不伪造 start/end。
8. **权限验证不因 teardown 放宽。** public selected-child/descendant API 保留 exact live parent、ancestry 和隔离检查。内部只能加入此前已经获得的关闭 Promise，不能以 stale parent 发起新的越权关闭。

## 5. 保护面扩展裁决与授权门

### 5.1 首要三个文件能修复什么

三个首要文件足以修复：

- Team 投影的独立 root owner。
- `finishDisposal()` 的异常早退与错误 identity 丢失。
- manager binding 过早清空。
- `activationOwner` 的 drain-rejection 释放缺口。

但仅完成这些修改，**不能直接宣称满足共同 owner 下的全部 E 节验收**。

### 5.2 不能用领域包技巧掩盖的源码时序

现有源码允许以下次序：

```text
factory provider 开始卸载
  ├─ FactoryOwnership.dispose() 进入 memoized handle teardown
  └─ provider 上独立的 Agent scope structural disposer 开始卸载

Agent scope 内各 effect 并行释放
  ├─ inbox 注册撤销
  └─ 领域包后来增加的 scope cleanup effect 尚在等待

continuation drain 随后进入 finishDisposal()
  └─ 再次 cancel → inbox.clear → 读已撤销的投影
```

另一个问题是，即便领域包在 Agent scope 中增加一个异步 cleanup effect，它也只能延长该 fiber 的**整体完成时间**，不能阻止同 scope 的 inbox registration sibling 提前撤销。它因此不能单独保证仍存活父 Activation 接收 child settlement notice 所需的 inbox，也不能作为完整的 child-first 方案。

这些是源码允许的时序反例，**不是本轮已经执行的握手测试记录**。后继实施首先通过 `S03`、`K01–K03` 的真实入口回归生成事件轨迹，确认各分支与实际 object identity。

### 5.3 最小保护面扩展候选

如真实轨迹确认上述路径，完整方案需要一个位于实际 handle owner 内、发生在 scope 释放前的有序关闭参与点。拟申请的最小生产扩展为：

| 文件 | 必要修改 | 不扩大到的内容 |
|---|---|---|
| `packages/core/agent/src/index.ts` | 为 create/resume 声明类型化的关闭参与接口，使 owner 在发布前安装关闭开始通知和释放前准备；明确 exact Agent、共享 completion Promise 与禁止自等 | 不新增 wire 方法、Session event 或模型输入 |
| `packages/core/agent-loop/src/index.ts` | 在 `prepare()` 的同一 memoized teardown 内调用上述参与点；将实际 scope 的精确 structural disposer 在其 parent fiber 上纳入该顺序；逐项执行清理义务 | 不改全局 Cordis 算法，不重构 driver |
| `packages/core/agent-loop/src/agent.ts` | `cancel()` 的 inbox 清理失败后仍执行对应 abort 与禁止后继 wake 的义务，保留原始异常 | 不改 inbox projection、`whenIdle()`、工具调度或模型调用协议 |

授权同时需要覆盖这些文件的 owner-local 测试、README/JSDoc、`docs/architecture.md` 对应生命周期说明以及双 SDK 预期输出。

**本计划列明必要范围，不授予该范围写权限。** 在指定硬审条件恢复、真实时序证据形成、上述范围获明确授权之前，不实施保护面修改，也不提交仅消除表面两失败的生产候选。若不获得扩展授权，后继结果为精确 `BLOCKED`，而非把领域包部分修复宣布完成。

如果真实证据能证明在三个首要文件内满足第 4 节全部不变量，应由指定 Codex 出具缩减范围的计划修订，再按缩减后的范围实施；不能由实施者自行取消验收或替换设计。

`session-projection` 注册框架、core inbox、`scope`、持久化/lease 与 vendor 继续只读。JSONL backend 的事件路由撤销和写 handle sweep 还须通过最终日志比对验证；若发现生产停止后应有的事件确实未持久化，保存精确次序和最小涉事文件，另行形成授权与计划修订，不在本计划下顺手修改持久化实现。

## 6. 共享 Subagent 关闭路径设计

### 6.1 实际 handle owner 的关闭参与点

在第 5 节扩展获准后，使用一个小型、类型化的 `AgentTeardownHooks` 接口，由 create/resume options 在发布前传入。接口职责固定为：

- `begin(agent, completion)`：同步通知 exact Agent 的真实 teardown 已开始，并提供本次 memoized 清理的 completion Promise。
- `beforeRelease(agent)`：在 scope、registry entry 和写 handle 仍可合法使用时执行领域准备；允许等待已拥有的 children 和 driver 静止，禁止等待自身 handle 的 completion。

具体要求：

1. `prepare()` 在调用 abort、cancel、hook 或其他可重入代码之前，先建立并发布共享 completion Promise。
2. consumer、factory、owner fiber 均进入这一个 teardown。`begin` 提供实际 owner 证据，领域包无需猜测私有 `disposing` 状态或检查投影是否存在。
3. scope 的精确 disposer 在**实际创建它的 parent fiber** 上被组合 effect 收集，撤除原 sibling 注册。另一 caller owner 只进入同一个 handle teardown，不再保留会提前撤销 scope 的独立路径。
4. stop/cancel、`beforeRelease`、`whenIdle()`、scope 释放、写 handle `close()`、Agent/Session detach 和 owner bookkeeping 分别收集错误、继续执行。
5. 卸载 wrapper 的解除必须区分“正在执行该 wrapper”和“资源释放后解除尚未执行的 wrapper”，避免 teardown 等待自己的 effect。
6. `beforeRelease` 抛错不跳过 scope、写 handle 或两个 registry 的释放。原始错误仍进入最终拒绝结果。
7. create/resume 在返回前已进入关闭的 handle 不能再发布为新 resident Activation。未发布 rollback 不调用 resident observer 的 start/capture/settle。

生产 `AgentFactory` 实现与相关测试替身按接口使用情况逐一核对。现有未提供 hooks 的调用者维持原有行为；提供 hooks 的工厂不得静默忽略它们。

### 6.2 `continuation-activation.ts` 的职责调整

围绕 `materializeTracked()`、`dispose()`、`finishDisposal()`、`disposeRoots()`、`drain()` 和构造器实施：

1. **预先创建关闭记录。** materialization 在调用 create/resume 前建立私有记录，绑定 exact child/handle epoch，接收真实 `begin` 和 `beforeRelease`。记录不进入 Session 数据，不成为新的公共 registry。
2. **保留 `SubagentInbox.close()` 作为 Activation 唯一关闭入口。** 所有 normal、natural、selected、descendant、manager 和共同 owner 关闭都加入其同一个 Promise。
3. **区分两个分支。**
   - 尚未由其他 owner 开始关闭：按现有 parent-cause 规则发出 cancel，处理 pending inbox，再进入实际 handle 清理。
   - 已收到该 exact handle 的 `begin`：加入其已有 memoized 清理，不再次读取可能已进入撤销阶段的 inbox，也不重新覆盖取消原因。
4. **把 child-first 准备做成共享的一次性阶段。** 对稳定的 owned-child 集合逐个启动关闭，等待全部结果，再等待真实 `whenIdle()`、执行必要 flush 与一次 capture。该阶段可由 normal disposal 或实际 handle 的 `beforeRelease` 进入，不能重复运行。
5. **保留最后合法 capture。** capture 在已发布 child 仍注册、scope 尚未释放时完成。handle 关闭后只使用已捕获的 terminal facts；不能重新读取其投影或调用 capture。
6. **避免自等。** `beforeRelease` 可以启动/加入 child 的关闭；不能 await 当前 Activation 的完整 `inbox.closing`，因为后者需要等待当前 handle 完成。
7. **drain 共享完成。** manager 全局 drain 关闭 admission 后共享一次完成过程，等待已接纳 materialization 发布或 rollback，再排空稳定图。关闭开始前已捕获的 Promise 必须等待到底。
8. **构造器异常安全。** 保留 `yield scope.dispose` 的精确 disposer 转移，但由一个显式清理事务负责 drain、scope release 和最终错误聚合，不能依赖会短路的 `.then()` 链保证异常路径。
9. **逐项移除 bookkeeping。** 只在对应 Activation 的清理义务已执行后删除该 resident、释放其 owned-child 边；不得 `resident.clear()` 或修改集合来制造“已排空”证据。

自然 settlement 中已有 `runMaintenance()`、最终 seq 检查和 flush 语义需要保留。新增准备阶段不得等待其自身 maintenance 回调，且 `finalStateFlushed` 只在原有事实仍成立时用于避免重复工作。

### 6.3 异常安全与错误传播

关闭事务按阶段保留原始 rejection 值；使用有标记的 settled outcome，不能把 `undefined` 同时当作“没有失败”和“抛出了 undefined”。

| 阶段失败 | 后续仍须执行 |
|---|---|
| cancel / inbox 清理失败 | 停止 driver 的其余义务、所有 children、capture 的合法尝试、实际 handle disposal、bookkeeping、终态处理 |
| 一个 child 失败 | 其他 children 与当前 parent handle 的释放 |
| idle/flush/capture 失败 | 当前 handle 的 scope、写 handle、registries 与 owner 释放 |
| handle disposal 失败 | 该 Activation 的其他 bookkeeping、终态错误报告、其他独立分支 |
| terminal 计算或发布失败 | 剩余 bookkeeping 与错误传播；不得重发一个可能已发出的终态 |

`ACTIVATION_TEARDOWN_FAILED` 保留。`disposeRoots()` 和 child-failure 聚合必须通过 `cause: new AggregateError(originalReasons)` 或等价的可遍历因果树保留对象 identity，不能只保存 `errorChain()` 拼出的文本。

`notifySettlement()` 的既有 best-effort listener/notice 规则与真正 teardown 失败分开处理；不把 mandatory drain failure 转入 `watchSettlement()` 的 warning 路径。共同 owner 触发而没有直接调用者等待的关闭结果也必须由真实生命周期 owner 观察并报告，不能成为 detached rejection 或被空 catch 吞掉。

### 6.4 `subagent/src/index.ts` 的 binding 接线

把 continuation manager 放入专用 lifetime child fiber，由外层 effect 收集该 child 的精确 disposer，并在该 lifetime 的 drain、结构性释放和错误观察完成之后，才按 exact manager identity 清空 `this.continuations`。

不得只给当前 `continuationBinding` sibling effect 增加一个 `await`。必须证明清 slot 已进入覆盖 manager 全部关闭的生命周期。依赖撤销、单插件 HMR 和重新注入时，旧 manager 不能清除新 manager 的 binding。

`drainContinuableChildren()`、`drainContinuableDescendants()` 的 manager-less no-op 只适用于确实没有该生命周期待清理工作的情形，不能因 slot 提前清空跳过真实 drain。

## 7. Team 整合设计

### 7.1 投影的真实所有权

在 `agent-team/src/index.ts` 创建专用 projection owner child fiber，通过该 child context 注册 `teamProjectionDefinition`，并让 Team 的组合 lifecycle effect 收集此 child 的**精确** `fiber.dispose`。

要求：

- 投影注册不再落在 `ctx.root`。
- child 的 structural disposer 从其 parent 的 sibling 列表实际转移到 Team lifecycle。
- 不把 `register()` 返回的包装函数当作所有权转移凭据。
- 注册在 Team 可被使用及 recovery 开始前完成；启动失败有对应 rollback。
- 正常 HMR 排空旧 runtime、释放旧注册后，重新注册并从 durable Session 重放；无遗留 root registrant 或多余 ref-count。

Team teardown 事务自己等待投影 owner 的真实完成并聚合错误。即使 runtime drain reject，也要在实际工作已静止后释放投影；不能让 generator 的短路跳过释放，也不能让 `finally` 在任务尚未静止时过早释放。

### 7.2 关闭与授权采样

`disposeRuntime()` 改为一次性、可加入的关闭事务：

1. 同步关闭 `TeamRuntimeLifecycle` admission 与 `TeamActivity` waiter。
2. 在 exact live Lead 仍可用于授权时调用 `liveChildrenByRoot()`，立即启动对应 selected-child drain，并保存其真实 Promise。
3. 等待已接纳 creation 和 dispatch 的实际结果；对可能在关闭边界完成的 provisioning 再调用 `liveChildrenByRoot()`，覆盖仍合法存在的新成员。
4. 加入此前已启动的 drain；对新的合法目标继续关闭，直到已接纳工作和相应 member 清理均已静止。
5. 聚合所有异常，随后释放投影 owner。

为了避免根卸载中 Lead 已被其他 owner 移除后才开始授权采样，在 Team 自身及其实际祖先进入卸载时，用既有真实 fiber 生命周期事件**同步启动同一个关闭事务**；最终 completion 仍由 Team effect 等待。监听器由同一个 retained lifecycle 持有，过滤 exact fiber/epoch，不能把任意其他插件卸载当作 Team teardown。

如果 root 已进入共同关闭，则只加入此前取得的真实关闭 Promise；不通过放宽 `drainContinuableChildren()` 的 stale-parent 校验补救。

### 7.3 timeout 与静止

现有 `TeamRuntimeLifecycle.withTimeout()` 结束等待时，不会结束真实操作。`roster.stopTeammates()` 又隐藏了它包裹的原始 drain Promise。因此本轮 `index.ts` 的 teardown 要直接保存 selected-child drain 的实际 Promise，再使用既有 lifecycle timeout 观察等待期限；其他 roster API 保持不变。

- 保留当前配置字段、默认值及 `TEAM_DISPOSAL_TIMEOUT`，不扩大 timeout。
- 超时必须报告为真实错误。
- cleanup 的最终完成与投影释放继续等待实际操作静止。
- 一个永不静止的操作不能被声明为成功卸载；其目录保留，执行记录为失败或阻断。

这是对两个既有 owner-local timeout 用例的明确行为修订：`team.spec.ts` 中“never settles 但 fiber disposal 已完成”的期待不再可作为成功标准。用可在 `finally` 释放的 deferred 替换永久悬空 Promise，验证超过期限时错误已成立、关闭仍未完成且投影仍在；释放 gate 后才允许完成资源回收。两个原始 main-spec 的 `.resolves.toBeUndefined()` 不变。

`journal.ts`、`roster.ts`、`lifecycle.ts`、`projection.ts`、`mailbox.ts` 保持只读。运行期真正缺少 `agentTeam` 时，`TeamJournal.state()` 必须继续 fail loud。

## 8. 后继实施顺序与文件责任

所有步骤均为后继授权轮次的执行计划。

| 步骤 | 输入、动作与文件责任 | 预期结果；失败处理 |
|---|---|---|
| R0：准入 | 核对实际工作区、branch、HEAD、status、指定 CLI 条件、工具链、有效授权；归属已有 r44 文件 | 条件不符即保留现场并 `BLOCKED`；不开始生产编辑 |
| R1：真实首失与扩展取证 | 先新增 owner-local lifecycle spec 和真实 fixture；记录旧实现下的 owner、scope、capture、handle 次序 | 新回归必须由目标缺陷拒绝；若反例不成立，交指定 Codex 修订保护面判断 |
| R2：共享关闭基础 | 在扩展获准后实施 AgentHandle 参与点、provider scope 所有权和 cancel 异常安全 | `K01–K08` 通过；不先整合 Team 掩盖共享层问题 |
| R3：Subagent | 修改 `continuation-activation.ts`、`subagent/src/index.ts` | `S01–S12` 与 control 原始失败通过；全部原始错误仍可追溯 |
| R4：Team | 修改 `agent-team/src/index.ts`；修订两个 timeout owner-local 用例 | `T01–T08` 与 Team 原始失败通过；投影注销确实位于完整 drain 之后 |
| R5：非回归与快照 | 运行相关既有测试；新增 keyless Session 与双 SDK 预期；built smoke | 持久事件、终态、权限与恢复通过；缺失支持在同候选补齐 |
| R6：独立负控 | 固定候选；分别执行第 12 节两个 mutation | 各负控 nonzero；可靠恢复；对应恢复后正向通过 |
| R7：文档与门禁 | README/JSDoc、双语 Note、配对、类型、lint、duplication、doc-sync、必要 hygiene | 只报告实际运行结果；失败不降级为建议 |
| R8：冻结与硬审 | 固定完整候选，包括新增文件，交真实 OpenCode | 明确 `PASS` 后才进入正常提交/推送；任何返工产生新候选 |
| R9：交付 | 正常 hooks 提交；确认远端纯快进条件后一次非强制 push；记录回执 | 不改 PR draft/base，不合并，不解除 P0-B blocked |

R0 至少记录以下实际命令结果：

```powershell
git rev-parse --show-toplevel
git branch --show-current
git rev-parse HEAD
git status --short
git ls-remote --exit-code origin refs/heads/chore/latest-stable-upgrade-20260912
node --version
pnpm --version
```

复用 Node `26.8.2`、pnpm `12.4.1` 与现有依赖。不得重装、升级、修全局 shim、修改系统认证或工具配置。工作区和远端满足任务 A 的条件时才允许指定分支的安全 fetch/ff-only；不得 reset、rebase、amend、stash、clean 或覆盖已有工作。

## 9. 验收用例与观察方法

### 9.1 原始三套 40 用例

完整保留原有 40 个用例的业务语义：

- `owned-contexts.spec.ts`：10 个。
- `tool-subagent-control.spec.ts`：18 个。
- `tool-team.spec.ts`：12 个。

两个原始失败必须保持：

```ts
await expect(owned.cleanup()).resolves.toBeUndefined()
```

不得改成 expected-fail、允许 `AggregateError` 或先手动完成模型 gate 再调用 cleanup。

两个写锁探针测试实际覆盖 **三个 `afterDispose` callback**：control 一个，Team 的 settled/active setup 各一个。两个 main spec 可以增加独立执行计数及可靠 `finally`，要求三个 callback 均实际执行：

```text
真实写 owner 存在时，另一 writer 被拒绝
→ 真实 teardown 完成
→ afterDispose 在原目录取得写所有权
→ takeover handle.close() 完成
→ 才删除原目录
```

### 9.2 新增 Subagent 用例：计划 12 个

文件：`packages/subagent/subagent/tests/continuation-teardown.spec.ts`。

| ID | 真实输入与入口 | 必须观察到的结果 |
|---|---|---|
| S01 | 单 Subagent plugin HMR；本地 fake 模型挂起 | admission 关闭、模型收到取消、handle/registry/锁全部释放；重装可再次建立 child |
| S02 | root 整体卸载；parent、child、grandchild 已存在 | child-first 准备与关闭；根卸载等待全部真实工作 |
| S03 | factory provider 卸载与 continuation drain 竞争 | exact handle 的 owner-start/completion 被共享；无第二次死 scope inbox 访问 |
| S04 | selected drain、descendant drain、manager drain 并发 | 每个 residency epoch 一个关闭事务、一次 capture、一次 end |
| S05 | materialization 在 setup deferred 挂起后开始 drain | 拒绝新 admission；等待已接纳 create/resume 完成或 rollback，无 unpublished 假终态 |
| S06 | driver/maintenance 的真实完成被 deferred 暂停 | `status === 'idle'` 不被当作静止；scope 和 handle 不越过真实 `whenIdle()` |
| S07 | cancel 路径注入有 identity 的 sentinel | 其他 child、当前 handle、ownership 仍释放；原 sentinel 可沿 cause 找回 |
| S08 | 一个 child close 失败，另一个 child 正常 | 两条分支均执行到底，parent handle 仍关闭，错误只影响结果而不跳过义务 |
| S09 | capture sentinel 与 handle-close sentinel 同时发生 | 两个原始对象均保留；只一次 terminal，故障 cleanup 拒绝 |
| S10 | selected child 与未选 child、另一 parent 树共存 | 未选树仍可接纳和执行工作；stale/self/sibling/foreign 权限拒绝不变 |
| S11 | fresh、fork、冷恢复后关闭 | ancestry、durable inbox、取消原因及 epoch 终态正确，无重复 end |
| S12 | 有真实 teardown 故障的 owned fixture | r43 observer 拒绝、跳过 afterDispose、保留目录；保存证据后才做受控最终清理 |

### 9.3 新增 Team 用例：计划 8 个

文件：`packages/experimental/agent-team/tests/teardown.spec.ts`。

| ID | 真实输入与入口 | 必须观察到的结果 |
|---|---|---|
| T01 | 单 Team plugin HMR，存在活跃成员 | runtime 停止后注销；重装与 replay 恢复 roster；权限保持 |
| T02 | root 卸载，在最后一次 roster/projection 使用前暂停 | 投影一直存在；独立 root 注销不能越过 drain；对应 Team 负控必须失败 |
| T03 | Team owner 与 Subagent/factory owner 同时关闭 | 共享 child 清理；Lead 的授权采样合法，binding 不提前消失 |
| T04 | admitted creation 与 mailbox dispatch 分别暂停 | 关闭等待原操作与后继清理，不遗漏稍后完成 provisioning 的成员 |
| T05 | 已有子/孙 Activation，多次/并发关闭 | runtime Promise 幂等，child-first、handle close 与终态唯一 |
| T06 | 一个成员 drain sentinel | 其他成员、waiter、投影 owner 仍清理；原错误上报，目录保留 |
| T07 | 超过现有 timeout，实际任务尚未静止 | timeout 为错误；投影与所有权保留；释放 gate 后才完成最终清理 |
| T08 | 运行期确实缺少必需投影 | 操作仍 fail loud；不返回空 Team，不跳过 live roster，不输出假成功 |

T01 同时检查 unregister/re-register/ref-count 与日志 replay；T04、T05 同时核对 roster/CAS/wait 既有语义。

### 9.4 保护面扩展的新增用例：计划 8 个

授权后新增：`packages/core/agent-loop/tests/teardown-ownership.spec.ts`。

| ID | 验证内容 |
|---|---|
| K01 | provider structural scope disposer 不能越过 held `beforeRelease` |
| K02 | consumer owner、factory owner、direct handle close 共享真实完成，无自等 |
| K03 | `begin` 在可重入 cancel/hook 前发布同一 completion，scope 仍有效 |
| K04 | `beforeRelease` 中 child-first 与最终 capture 完成后才撤销 inbox |
| K05 | inbox 清理 sentinel 后仍 abort，`whenIdle()` 等待真实退出，原错误保留 |
| K06 | hook、scope、storage close、detach 多处失败时仍执行其他释放 |
| K07 | setup/commit 期间 owner 关闭，未发布 Agent 完整 rollback |
| K08 | HMR 后同 ID 新对象不加入旧 handle 的 completion，旧 detach 不移除新 registry entry |

规划数量为：**20 个领域 owner-local 新用例 + 8 个扩展 owner-local 新用例，共 28 个**。原始 40 加这些用例合计目标为 68；实际报告必须以测试注册与运行数量为准。邻接测试、SDK 场景与负控单独计数，不能计入原始 40。

### 9.5 顺序与故障观察

所有生命周期 fixture 使用真实 Cordis、真实 AgentLoop、真实 Subagent/Team、真实 JSONL 写 handle，加本地 fake model。通过 `Promise.withResolvers()` 或现有 deferred 工具建立：

```text
entered → assertion checkpoint → release → completed
```

记录至少包含：

- exact fiber/Agent/handle/Activation 的测试内身份。
- `internal/status`、`internal/plugin` 事件。
- disposer、`begin`、准备阶段、capture、scope release、handle close 的入口与完成。
- Agent/Session registry 退出。
- Session 最终 seq、持久化事件与写所有权移交。
- 每个 afterDispose 的实际进入与完成。

不能以堆栈帧、sleep、放宽 timeout 或日志缺席推断顺序。测试只包装本 fixture 自有的实例，包装必须调用真实路径，正常用例不得以 resolved stub 替换 handle disposal。

故障用例使用 `const sentinel = new Error(...)`，按对象 identity 检查原因树。expected fault 只在专门故障测试中明确断言；两原始正常 teardown 用例仍要求成功。

所有 deferred、spy、临时 listener、timer 与自有模型任务在 `finally` 中恢复或排空。失败现场先保存证据；不能完成静止证明时保留目录并报告。

### 9.6 既有非回归集合

至少覆盖以下 owner-local 文件的相关用例，按完整受影响职责选取，不只选新用例：

- `packages/subagent/subagent/tests/continuation.spec.ts`
- `packages/subagent/subagent/tests/continuation-inheritance.spec.ts`
- `packages/subagent/subagent/tests/control.spec.ts`
- `packages/subagent/subagent/tests/service.spec.ts`
- `packages/subagent/subagent/tests/invariant.spec.ts`
- `packages/experimental/agent-team/tests/team.spec.ts`
- `packages/experimental/agent-team/tests/persistence.spec.ts`
- `packages/experimental/agent-team/tests/projection-events.spec.ts`
- `packages/experimental/agent-team/tests/invariant.spec.ts`

扩展获准后，还需 Agent factory、scope lifecycle 与 cancel 的既有测试。核对所有受影响工厂和调用者，包括 `packages/core/agent/tests/agent.spec.ts` 的工厂替身及相关 session-controller 测试；仅在接口使用确受影响时修改。

## 10. 快照、built smoke 与文档

### 10.1 keyless Session 快照

本轮改变真实 shutdown、durable inbox/terminal 顺序和 HMR，属于非平凡的产品与 Session 生命周期行为，必须增加 keyless recorded-session 场景。

规划：

- `snapshots/sdk/subagent-teardown/`
- `snapshots/sdk/agent-team-teardown/`
- `snapshots/sdk/teardown.snapshot.ts`

两个场景以选定 Session JSONL 同时作为 replay 输入与预期持久输出，带 `snapshot.yml`、当前 writer generation 的父/子日志、必要 header sidecar、SDK notification/result 预期。使用 shipped `dsh --profile sdk` 与测试 patch，通过真实协议或真实 plugin disposer 触发关闭；场景启动仍是 `dsh`，不得新增应用入口或公开任意 argv escape。

场景必须覆盖：

- held model request 被真实关闭取消。
- pending inbox 的处理及 turn/step 收尾。
- 子/孙 start/end 与取消原因。
- durable parent/child 事件完整性、终态唯一性。
- 关闭后原目录可以重新取得写所有权。

使用 authored fake/replay 输入；可以对**本轮新建场景**执行 scoped `test:snapshot:refresh`，随后 replay。不得调用 `test:snapshot:record`，不得刷新旧 golden 吸收 teardown 错误，不改已提交的历史 Session generation。

### 10.2 双 SDK 投影

第 5 节方案涉及 AgentLoop/Session 生命周期，因此 TypeScript 与 Python SDK 预期都必须更新或新增，不能以 unit test 或 TypeScript 一侧代替。

Python 规划新增一个聚焦 `sdk-teardown` 场景，使用现有公开 `dsh_bin` 能力启动本候选的 `apps/cli/lib/bin.js`，设置独立 `dsh_home`，使用本地 fake 模型，记录结果、通知和父/子 Session 日志。预期归属：

```text
scripts/snapshots/python-sdk-single-exe/production-teardown/
```

必要测试支持限定在 `scripts/smoke-python-runtime.py`：为该场景增加显式 built-CLI 输入，和 `--exe`/installed-wheel 路径互斥，不增加公开 SDK argv escape，不修改打包补丁或工作流。该 source-SDK/built-CLI 证据不得标成已验证安装 wheel 或平台 exe 矩阵。

如新增快照需要扩展现有 adapter/manifest 支持，先列出准确支持文件与接受/拒绝用例，纳入同候选和审核；不得以手写输出文本代替真实 assembled Session。

### 10.3 built smoke

`pnpm run build` 后，用 `DSH_EXAMPLE_MODE=lib` 重放上述 TypeScript teardown 场景，并运行 Python built-CLI 场景。它们共同验证真实 `dsh` profile、发布运行时代码、关闭与持久输出。

不得直接使用根 `vitest.e2e.config.ts`：该配置会读取 `.env`。本轮不运行 `pnpm run test:e2e`、真实模型 API 或 E2B。缺 built artifact 导致 skip 不是通过。

### 10.4 文档与 Agent Note

实现后新增：

```text
.agents/notes/implemented/architecture/2026-09-17-production-teardown-ownership.md
.agents/notes/implemented/architecture/2026-09-17-production-teardown-ownership.zh.md
.agents/notes/implemented/architecture/2026-09-17-production-teardown-ownership.i18n.yaml
```

Note 记录最终实现的 owner、共享关闭、最后合法读取、错误传播、timeout 与静止的区别；引用本轮纠正证据，不改写 r43 历史。提交前做当前 active Note 的重叠/取代核对，但不编辑冻结 archived Note 或 r29–r43 记录。

更新两领域包 README 的中英文及配对文件、相关 JSDoc；扩展获准后同步 core Agent/AgentLoop README 和 `docs/architecture.md` 对应说明。描述已实现、已执行的事实，不在实现前写成“已经修复”。

执行普通双语配对流程，不调用 `dsh-translate-docs`。配对写入按文件执行：

```powershell
pnpm run verify-translation-pairing --write <本轮实际修改的配对文档>
```

## 11. 检查命令与必要性

以下均为计划命令，尚未执行。每次物理运行独立留存日志、exit 与实际命中数量；禁止 `--passWithNoTests`。

### 11.1 基础组合

在新增领域 spec 后运行：

```powershell
pnpm exec vitest run --project thread-safe packages/subagent/tool-subagent-control/tests/owned-contexts.spec.ts packages/subagent/tool-subagent-control/tests/tool-subagent-control.spec.ts packages/experimental/tool-agent-team/tests/tool-team.spec.ts packages/subagent/subagent/tests/continuation-teardown.spec.ts packages/experimental/agent-team/tests/teardown.spec.ts
```

目标：原始 40 全过，新领域用例按计划 20 个全过，三个 afterDispose callback 均有执行证据。

扩展 owner-local 检查：

```powershell
pnpm exec vitest run --project thread-safe packages/core/agent-loop/tests/teardown-ownership.spec.ts packages/core/agent-loop/tests/scope-lifecycle.spec.ts packages/core/agent/tests/agent.spec.ts
```

必要性：第 5 节直接改变实际 handle/factory/scope 生命周期，领域包测试不能独自证明提供者所有权正确。

### 11.2 邻接非回归

```powershell
pnpm exec vitest run --project thread-safe packages/subagent/subagent/tests/continuation.spec.ts packages/subagent/subagent/tests/continuation-inheritance.spec.ts packages/subagent/subagent/tests/control.spec.ts packages/subagent/subagent/tests/service.spec.ts packages/subagent/subagent/tests/invariant.spec.ts packages/experimental/agent-team/tests/team.spec.ts packages/experimental/agent-team/tests/persistence.spec.ts packages/experimental/agent-team/tests/projection-events.spec.ts packages/experimental/agent-team/tests/invariant.spec.ts
```

必要性：这些文件拥有权限、selected/descendant 隔离、fork/恢复、inbox/终态、Team roster/CAS/wait/HMR 行为。

不把 `thread-safe` 名称理解为没有进程或文件并发；按当前 Vitest 配置设计 fixture。所有目录随机且 owner-local，不全局串行化测试。

### 11.3 快照与 built 验证

```powershell
pnpm run test:snapshot -- -t "subagent-teardown|agent-team-teardown"
pnpm run build
```

在单次子进程环境中设置 `DSH_EXAMPLE_MODE=lib`，重跑相同两个场景；环境设置与恢复也入证据，不能污染后续命令。

新增 Python 测试支持后，使用现有本地 Python/uv 环境执行：

```powershell
uv run --offline --project python/sdk python scripts/smoke-python-runtime.py --scenario sdk-teardown --dsh-bin C:/Albert/project/dsh861/apps/cli/lib/bin.js
```

Python 环境缺失、离线依赖不齐或 built runtime 不匹配时如实阻断，不安装新环境来绕过本轮限制，不用 skip 代替证据。

### 11.4 静态与文档门禁

```powershell
pnpm run typecheck
pnpm run lint
pnpm run duplication
pnpm run test:docs
pnpm run doc-sync
pnpm run hygiene
git diff --check
```

必要性分别为：

- `typecheck`：新的类型化生命周期参与点与跨包消费者。
- `lint`、`duplication`：新增异步清理、错误聚合及测试代码。
- `test:docs`、`doc-sync`：双语 Note、README、JSDoc、架构说明和新 Session 场景。
- `hygiene`：扩展涉及公共 Agent 类型、构建声明与实际 `lib` 消费路径。
- `git diff --check`：最终格式与行尾。

若范围经正式修订缩减为仅领域私有实现，重新按 `dsh-pre-push-checks` 缩减不再必要的检查，并记录依据。

不默认运行全仓 `test:coverage`、Web、Gateway212、Loader122、exe-wheel、旧六个 Windows golden 或平台全矩阵。新增分支必须由 owner-local 用例覆盖；CI 的全覆盖与跨平台结果仍由其实际运行提供。已通过检查不为 commit/push 重复执行，除非候选变化、失败或新证据使原结果失效。

## 12. 两个独立负控与恢复

负控只能在完整正向候选通过相关检查后执行，期间无其他写入、无审核、无并发负控。

### 12.1 固定与备份

先记录：

- 基准 HEAD。
- 全部生产、测试、文档及新文件的候选清单。
- 每文件原始 bytes、Git blob hash、SHA-256。
- 完整 candidate manifest 的 SHA-256。
- 负控允许修改的准确文件和局部代码锚点。

以二进制读取保存原始字节，恢复时按字节写回。不得用文本读取/重写改变 BOM、CRLF 或最后换行，不使用 checkout/reset/stash。

### 12.2 Team 负控

只修改：

```text
packages/experimental/agent-team/src/index.ts
```

精确 mutation：在新投影 owner 注册点，把注册调用恢复为旧的 `ctx.root.sessionProjections.register(teamProjectionDefinition)` 所有权，使真实 registration 再次成为独立 root effect。保留 Subagent 与其他修复、observer 和测试期待。

运行：

```powershell
pnpm exec vitest run --project thread-safe packages/experimental/agent-team/tests/teardown.spec.ts -t "R44-T02"
```

要求真实 root 卸载握手使旧 registration 在最后合法使用前消失；对应正常期待失败，进程 exit 非零。记录命中的测试名、projection 注销及 drain 次序，不能只以 mutation 的静态文本断言失败。

在 `finally` 恢复候选原字节、校验 bytes/blob/SHA-256，再运行同一正向用例，要求 exit 0。

### 12.3 Subagent 负控

只修改：

```text
packages/subagent/subagent/src/continuation-activation.ts
```

精确 mutation：把 `finishDisposal()` 的非自然关闭分支恢复为旧式前置：

```ts
activation.handle.agent.cancel({ kind: 'parent' })
```

使其位于失败收集与必达释放事务之外，能够同步 reject 并跳过后续 child/handle/bookkeeping。保留 Team 修复及其他共同 owner 接线。

运行：

```powershell
pnpm exec vitest run --project thread-safe packages/subagent/subagent/tests/continuation-teardown.spec.ts -t "R44-S07"
```

S07 使用仍活动的真实 selected-child 关闭入口；cancel sentinel 发生后，必须在 fixture 的最终 root 救援清理之前检查 child/handle/ownership 已释放。旧早退应因这些义务没有完成而失败，不能让后续 root cleanup 补做工作后掩盖缺陷。

在 `finally` 恢复并校验原字节，再运行同一正向用例，要求 exit 0。

### 12.4 负控证据与中断处理

每个负控分别保存 mutation diff、实际进程 exit、raw/normalized 日志、双 SHA-256、变更前后与恢复后的文件 identity。不得关闭 r43 observer，不得复制同一次运行充当另一负控或恢复验证。

若中断导致 `finally` 未完成，下一执行者首先核对保存的候选字节与当前状态；只有身份匹配且无其他写入时，才能恢复该任务拥有的准确文件。无法证明时保留现场并阻断后续运行。

## 13. 证据、硬审与提交

证据根保持：

```text
development/remediation/2026-09-17/production-teardown-r44/
  planning/
  windows-execution/
  review/
```

建议新增产物：

| 位置 | 内容 |
|---|---|
| `planning/plan.v1.md` | 本次完整正式计划 |
| `planning/planner-invocation.*` | 本次真实调用路径、版本、参数、时间、exit、输入哈希与原始输出引用 |
| `planning/ownership-correction.md` | 精确 disposer 转移、注册栈拼接及本计划新增归因 |
| `planning/scope-authorization.md` | 后继实际授权依据、批准文件与未批准范围 |
| `windows-execution/<run-id>.*` | 每次物理运行的 raw/normalized 日志、exit、计数、环境与双哈希 |
| `windows-execution/lifecycle-traces/` | deferred 时序、exact object 身份、关闭与 registry/锁探针记录 |
| `windows-execution/candidates/` | 完整候选 manifest、各文件 bytes/blob/SHA-256 |
| `windows-execution/negative-controls/` | 两个 mutation、独立运行与恢复证据 |
| `windows-execution/FINDINGS.md` | 原始失败、新回归、持久化、负控、检查、未解决项 |
| `review/<candidate-id>/` | 指定 OpenCode 的输入、调用回执、原始输出、结构化审查结果 |

每次运行记录 cwd、argv、工具版本、开始结束时间、完整 candidate identity、真实 exit、命中/通过/失败/skip 数量，以及 raw 和 normalized 文件各自的 bytes、SHA-256 与取值时间。Normalization 不能删除错误、改变失败数量或把不同运行合并成一次。

在真实现有节点位置 `development/nodes/P0-B/` 仅增加本修复计划的版本化附录/指针（如归档流程要求），不改 `state.json`、旧计划、旧 review 或通过状态。

硬审输入包括计划、授权、完整候选、新增未跟踪文件、全部必需检查、两负控及恢复、物理资源和持久事件证据。OpenCode 必须对该 candidate 明确给出 `PASS|FAIL|BLOCKED`；exit 0 或模型自述不代替 `PASS`。

任何代码、测试、文档或生成文件的返工都形成新 candidate；旧审核与旧日志不覆盖。正常 hooks 若修改候选，也必须核对影响并重新固定、补验或复审，不能把修改前的 PASS 直接套用到修改后文件。

只有必需检查通过、两个负控恢复后的正向通过、指定硬审对固定候选 PASS 后，才正常提交并核对远端是否允许纯快进推送。保持同分支非强制 push；不绕 hooks、不 amend、不手动重跑/取消 CI、不为 push 回执制造额外提交。远端移动或存在活动 push 时保留现场，不发起竞争写入。

## 14. 并行划分、失败恢复与完成标准

### 14.1 后继并行划分

本轮规划不调用任何代理或其他模型产品。后继由 ZCode 在已批准范围内安排：

| 工作 | 可并行条件 | 写入责任 |
|---|---|---|
| owner/consumer 只读核对、既有测试覆盖映射 | 可与其他只读分析并行 | 各自独立证据文件 |
| Subagent 回归 fixture、Team 回归 fixture | 共享观察接口先固定；文件互斥 | 各包新增测试文件 |
| 公共生命周期接口与 provider 实现 | 单一实施者负责 | core 三文件及其直接测试 |
| Subagent 实现 | 公共关闭参与点固定后 | 两个 subagent 首要文件 |
| Team 实现 | Subagent 关闭路径已通过对应验收后 | Team `index.ts` |
| 中英文文档和快照输入准备 | 最终行为明确后；避免同文件写入 | 明确归属的文档/场景 |
| 整合、负控、候选冻结、硬审 | 必须串行 | ZCode 主执行者统筹 |

不得并行写公共接口，不得并行执行依赖尚未固定的生产实现，不得在硬审期间修改候选。

### 14.2 失败与回滚

- 普通检查失败：保留真实日志和候选，不推送未完成生产补丁。
- 实现超出首要或已批准扩展范围：停止该依赖步骤，提交具体时序、最小文件集合与计划修订需求。
- 未完成的 cleanup：保留目录；不能以日志无错、registry 为空或 resident 被删除证明资源已经停止。
- 测试最终清理：只处理本轮明确拥有的随机目录；先保存失败证据，确认所有相关任务、handles 和 takeover close 完成，再删除准确目录。
- 不扫描历史前缀批量删除，不删后重建以伪证锁释放。
- 本地回滚只恢复本任务拥有且身份已核对的候选文件；不覆盖其他工作。
- 已提交或推送后的撤回需保留历史并按实际授权处理，不使用强推、reset 或 amend。
- 若持久事件比对揭示 protected persistence 的独立问题，不能调整 normalizer、golden、错误检查或 coverage 门槛接受它。

### 14.3 生产修复完成标准

后继只有同时满足以下条件才可报告修复完成：

1. 生产范围、真实规划调用与指定硬审调用均有有效授权和实际证据。
2. Team 投影的真实注册已离开独立 root effect，结构性注销覆盖完整 drain 的所有正常与失败路径。
3. 同一 AgentHandle 的共同 owner 加入真实 memoized cleanup；最后合法 capture 位于 scope/registry/写路径释放之前。
4. cancel、child、capture、handle 等任一步失败不会跳过其他释放，全部原始失败可追溯。
5. 原始 **40/40** 通过，两个原始正常 teardown 期待未改，三个 afterDispose callback 真正执行。
6. 新增 owner-local 用例按实际数量全部通过；单插件 HMR、root 卸载、held model、子/孙 Activation、并发/重复关闭都有真实入口证据。
7. 权限、隔离、fork/冷恢复、inbox、终态唯一性、Team roster/CAS/wait 保持；应持久化的事件没有丢失。
8. 两个独立负控均被对应真实回归拒绝，恢复后的文件 identity 和正向结果匹配固定候选。
9. 必需 keyless Session、双 SDK、built、类型、lint、duplication、文档与适用 hygiene 检查实际通过，无零命中或 skip 冒充成功。
10. 中英文 Note、README/JSDoc、配对和证据清单与最终候选一致。
11. 真实 OpenCode 对该固定候选明确 `PASS`。
12. 提交/推送按正常 hooks 和纯快进要求完成，并如实记录完整 commit SHA、本地/远端 HEAD、push exit 与工作树状态。

本轮只完成正式计划交付。Linux Python、Windows checkpoint/cache/catalog 扫描、Web React #185、Linux62/Windows63 文件阈值及其他历史间歇问题不在本修复范围；r29–r43 历史证据、模型配置、凭据、锁、pkg 补丁、vendor、工作流与 `P0-B state` 保持保护，`P0-B` 继续 `blocked`，不进入 `P0-C`。
