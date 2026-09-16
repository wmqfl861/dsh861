# Agent Note: subagent-control 与 tool-team 测试套件中的被拥有 fixture Context

Status: implemented

[English](2026-09-16-owned-test-contexts-r42.md) | 中文

## 问题

`tool-subagent-control` 与 `tool-agent-team` 两套测试把每个 fixture 建成完整的 Cordis 运行时——`new Context()`、挂载 `JsonlSessionPersistence`、带 parent 或 lead agent 的 `AgentLoop` 持有会话真实的内核写锁——但 `afterEach` 只删除临时目录。从未有代码销毁 Context：agent 写 handle 保持打开，其 lease 保持占用（按 `SessionWriteLease`，Windows 是命名信号量、POSIX 是 `session.lock` 的 FileHandle），control 套件的 `GatedAdapter` 还可能把 child 的模型调用永久挂住，因为它的 gate `await` 不理会请求 signal。在 Windows 上目录能被删掉或小套件保持绿色都不能证明资源已释放——信号量从不阻塞删除，而 Node 26 的 DEP0137 已把 FileHandle 依赖 GC 回收定性为错误而非清理策略。这两套测试还持有无人负责销毁的 fixture：control 的 HMR 用例另建一个 `new Context()`，team 的一项测试在一个用例内创建两套完整 setup。

## 决策

测试专用的所有权台账（`packages/subagent/tool-subagent-control/tests/owned-contexts.ts`，`OwnedTestContexts`）在 `new Context()` 返回的那一刻——先于任何可能失败的 setup await——登记每个 fixture Context，并在 `mkdtemp` 目录产生的那一刻登记该目录并关联到 fixture。`afterEach` await `cleanup()`：逐 fixture 先 await `ctx.fiber.dispose()` 到静止（真实的 AgentLoop 与持久化 teardown：取消并等待 agent、关闭会话写 handle、释放 lease），再运行可选的 `afterDispose` 观察，最后才删除该 fixture 的目录。销毁或观察失败时保留该 fixture 的目录与错误，其余 fixture 仍然清理；收集到的错误以一个 `AggregateError` 一并重抛。`mountWriteOwnershipProbe` 为测试在同一 root 上挂独立的 backend，用 `open(id, 'write')` 观察真实的内核写所有权：fixture 存活时以 `SessionAlreadyOwnedError` 拒绝，静止后可在同一目录（绝不删除重建）上接管。control 套件 `GatedAdapter` 的 gate 现在会在请求 signal 中止时结束（gate 先到则移除监听器），因此断言先于手动 release 失败的用例也能完成 teardown；正常的 held/parked/interrupt 时序不变，因为 gate 只向在存活断言期间不会触发的 abort 让步。team 套件的子 agent 走 `MockAdapter`，其 `hang` 本就响应 abort，无需改动 double。

## 考虑过的替代方案

**从 `afterEach` 的簿记释放测试 gate，而不是让 gate 可中止。** 未解析 gate resolver 的注册表要从外部替 double 履行其自身契约，且未来某个 double 忘记注册仍会挂住；取消才是每个真实 adapter 都已遵守的模型调用契约。

**销毁失败时仍删目录、只记日志。** 这会销毁失败 teardown 留下的证据，还可能在锁身份仍被持有时 unlink 目录；保留目录并重抛同时保住诊断与锁路径稳定。

**用重建路径后重开证明释放。** 删除会话目录再重建会让新 inode 满足探测、而原锁仍被持有；探测必须接管原目录的写所有权，这正是把观察放在销毁与删除之间所强制的。

**只 dispose 工具 fiber，或等 child 离开 registry。** 两者都不关闭持久化服务的 open handle，也不关闭 parent/lead agent 的写 handle；只有拥有它的根 fiber 的销毁才能到达完整 teardown 链（`FactoryOwnership.dispose` 直到 `HandleTracker` 的关闭全部 handle effect）。

## 后果

两套测试的未改基线通过 28/28——如实记录为未失败，小套件不会强制 GC——确定性的信号由新增回归补上：跳过 Context 销毁（旧清理语义）时，全部七个资源测试在任何删除之前基于真实观察失败，要么来自存活内核锁的 `SessionAlreadyOwnedError`（`afterDispose` 内的探针否决），要么来自 happens-before 竞争（`cleanup-settled` 先于 `disposer-reached`），而 28 项业务测试照常通过。修复后的候选 35/35 全过（control 17+1、team 11+1、回归 5），对最终字节的两个负控保持判别力：跳过销毁使七个资源测试失败；只去掉 `await` 使 deferred-disposer 完成断言与 held-gate 探针否决失败。两次突变都按字节恢复（SHA-256 重核验，helper 的 git blob `da23db7d7ba9351c0b6006b2e3a4b1c120f5cc6c`），恢复后套件回到 35/35。生产 AgentLoop 销毁、JSONL lease、持久化与 Windows 锁实现、公共 `MockAdapter`、共享读 handle helper 均未改动。向前携带的注意点：cordis 对 disposer 失败只记日志不重抛，因此 `fiber.dispose()` 内的 handle 关闭失败会经 logger 浮现，并在有探针观察同一 fixture 时成为否决；无观察者的套件仍可能删除一个 handle 关闭已大声失败的目录。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/owned-test-contexts-r42/windows-execution/FINDINGS.md)。
