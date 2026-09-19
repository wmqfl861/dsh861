# Agent Note: 在被拥有测试 Context 中观察仅写日志的销毁失败

Status: implemented

[English](2026-09-16-cleanup-error-observation-r43.md) | 中文

## 问题

Cordis 在 fiber 卸载中捕获 disposer 失败，经 `ctx.logger.error` 上报后仍让 `fiber.dispose()` 正常 settle。r42 的 `OwnedTestContexts.cleanup` 把已 settle 的销毁当作已证明干净的 teardown，因此一个只经 logger 报告失败的 fixture——r42 Note 向前携带的注意点——会 resolve 清理并删除 root，尽管静止从未被证明。多数 fixture 没有 `afterDispose` 探针，在记录下来的失败与 `rmSync` 之间没有任何阻拦。r42 的 held-disposer 回归作为测试自身有同样的弱点：gate 放行与 cleanup 等待位于断言之后，断言提前失败会把 held disposer 与已启动的 cleanup 一起悬空。

## 决策

`OwnedTestContexts.cleanup` 现在在每个 fixture 开始销毁前，在其结构化 logger 出口安装一个 `DisposeFailureObserver`，并只在销毁 settle 之后移除。观察器直接登记到 fixture 应用的 exporter map，而不是走 `ctx.logger.exporter()`，因为该公开注册由 fiber 持有、会被正被观察的同一次销毁移除——先于较晚的子 fiber 错误被记录；每个 fixture 自动获得观察器，无需任何逐测试探针。跨越整个观察窗口捕获的 error 级记录——原始错误对象，各自标注上报 fiber——否决该 fixture 的删除，并以逐 fixture 的 AggregateError（指名保留的目录）reject 清理；其余 fixture 照常清理，dispose rejection 与 `afterDispose` 否决保持 r42 语义。held-disposer 回归把 gate 放行与 cleanup 等待移入 finally，从 cleanup 启动之前就无条件生效，并把 cleanup 的 settle 结果捕获在断言错误之侧而非替代它；新增的提前失败回归在原观察位置抛出独有 sentinel，证明 finally 放行了 gate、等待真实 cleanup 完成、且 sentinel 保持可见。

## 考虑过的替代方案

**通过 `ctx.logger.exporter()` 登记观察器。** 返回的 disposer 由根 fiber 持有，与所有其他 disposer 在同一次销毁中并发运行；在其移除之后才记录的异步子 fiber 失败会被漏掉——这恰是观察器要关闭的盲区。

**销毁后读取 logger 内建 buffer。** buffer exporter 自身由 fiber 持有并在卸载中被移除，buffer 又有 1000 条上限，其生命周期与末尾都不能证明没有失败。

**按上报 fiber 的生命周期状态过滤错误。** teardown 中卸载与重载的 fiber 都会产生错误；压制后者会吞掉真实的 teardown 失败——包括下述 continuable-activation drain 失败——只为让两套测试保持绿色。

**Spy logger 原型或 console。** 不受控的全局修改，且有同样的子 logger 覆盖缺口；结构化 exporter 出口本就携带上报 fiber 地送达每条消息。

## 后果

四项新增回归（根同步抛出、子插件异步 reject、子 disposer 在延迟放行后才失败、健康 fixture 旁两个故障 fixture）在旧 helper 上确定性失败——cleanup resolve 并删除了故障 root——在修复后通过；延迟回归同时证明观察覆盖整个异步销毁。对最终 helper 字节的两个负控保持判别力：只移除已捕获错误的否决判断、或在 `dispose()` 调用后立即停止观察，各自恰好使四项回归失败；两次突变均按字节恢复（SHA-256 与 git blob 重核验），套件回到修复后状态。该保护随即暴露了两个 r42 35/35 看不到的真实且既有的仅写日志 teardown 失败：agent-team 的 `agentTeams.runtimeLifecycle()` disposer 中 `disposeRuntime()` 在根持有的 projection 注销已运行后读取 team projection；subagent 的 `ContinuableActivationRegistry.drain()` 在 projection 注册失效后无法读取 held activation 的 inbox 状态。两者都在单测试隔离中复现，都在新 helper 下持续失败，修复它们需要本轮范围禁止的生产改动，因此两个 r42 teardown 测试现在诚实地失败，并作为它们一直存在的缺口被报告。新 helper 在捕获到错误时跳过这些测试的 `afterDispose` 接管探针，固定候选运行中探针并未执行；内核锁已释放的证据来自同一测试在旧 helper 下（r43 首失运行、相同 fixture）及 r42 CI 双平台通过的完整探针路径——这是 teardown 完整性缺陷，不是锁泄漏。生产 Cordis、AgentLoop、持久化、锁、vendor 与两套 main suite 的断言均未改动。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/cleanup-error-observation-r43/windows-execution/FINDINGS.md)。
