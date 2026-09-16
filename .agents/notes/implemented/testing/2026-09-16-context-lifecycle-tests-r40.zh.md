# Agent Note: Observe Cordis lifecycle through declared dependencies and direct listener probes

Status: implemented

[English](2026-09-16-context-lifecycle-tests-r40.md) | 中文

## Problem

latest-stable 升级后的 Cordis 生命周期（vendor `ReflectService`）改变了四个上下文/生命周期 spec 仍依赖的两条观察路径。作用域上下文中未声明的服务属性读取现在抛出 `cannot get property "…" without inject`；已声明但被撤销的依赖以 `cannot get required service "…" in inactive context` 拒绝。具体地说：session-fork spec 直接读取 `child.ctx.systemPrompt`；gateway spec 的恢复路径读取 `fixtureScope` —— 这是测试从未建立的调用上下文元数据 —— 因此 fixture 的 `?? 'root'` 没有执行机会；goal spec 期待旧服务实例的 projection 错误，但其被撤销的 `agents` 依赖先一步拒绝；session-reference spec 把旧 resolver 的 `prepare` 成功当作 assemble 监听器已移除的唯一证据，而 pre-step 监听器的移除完全没有观测（[r39 接收](2026-09-16-sdk-manifest-contracts-r39.zh.md)；CI [run 35057856906](https://github.com/wmqfl861/dsh861/actions/runs/35057856906)）。

## Decision

每个 spec 现在都经由升级后生命周期所允许的路径观测同一已交付行为，且每个移除主张都有自己的正控。fork spec 在 `child.ctx` 下创建显式注入的测试插件 fiber（`child.ctx.inject(['systemPrompt'], …)`），在 child 自己的 assembly 作用域内调用真实 `systemPrompt.assemble(assembleContextFor(child))`，断言观察器恰好执行一次并产出 assembly，同时保持继承 provider/model/reasoningEffort 断言与真实 `agent/request` waterfall 不变。gateway spec 的恢复调用经由 `ctx.extend({ fixtureScope: undefined })`：fallback 场景作为调用上下文元数据被显式建立（值为 undefined），结果断言 `scope: 'root'`，生产 gateway 依赖零改动。goal spec 把旧实例的拒绝精确固定为 Cordis 的分层消息 `cannot get required service "agents" in inactive context`，并保留活根上下文的服务与投影移除、重装实例身份检查及 disarmed 恢复。session-reference spec 直接证明两个监听器：一个注册在 resolver prepend 监听器内侧的计数探针观测真实 assemble 回调对 assembly 路由变量的读取 —— 销毁前每次执行恰好读两次、销毁后为零；真实 pre-step 分发在销毁后以对象同一性原样透传 seed 决策且不读引用源；旧 `prepare` 的拒绝（`SESSION_REFERENCE_READ_FAILED`，cause 为 inactive `sessionQuery`）是独立断言；重装 resolver 后每个回调恰好恢复一份（路由读取两次、追加一条 context 消息）。该测试在 `finally` 中释放探针、spy 与重装的 fiber。

## Alternatives considered

**从根上下文读取 `systemPrompt` 或改用 `ctx.get(name, false)`。** 两者都绕过失败所暴露的 child 作用域注入契约；`get(false)` 对任何调用者无条件应答，观察不再经过 child 的 assembly 作用域。

**把 `fixtureScope` 注册为服务或给 gateway 增加 `inject`。** `fixtureScope` 是由 `ctx.extend` 携带、测试自有的调用上下文元数据，不是生产依赖；为满足 fixture 而改 gateway 会改变其他 scope 断言所依赖的交付组合。

**对旧的 goal 与 resolver 实例接受任意抛错。** 裸 `toThrow` 在任何一层拒绝时都通过，包括无关层；两个拒绝现在都精确匹配依赖层消息，未来的绕过会以不同失败形式暴露。

**保留旧 `prepare` 调用作为监听器移除证明。** 它观测的是被撤销的 `sessionQuery` 依赖，不是监听器注册状态；在注册泄漏的场景下该观测不再有判别力。移除证据（assemble 探针、pre-step 透传）与失效证据（依赖拒绝）现在是分开的断言。

## Consequences

未修复的四文件基线在 135 个测试中恰好失败 4 个，与 CI 首失一致。修复后 135/135 通过，且每个移除主张都由同一测试内的活正控锚定（观察器执行一次、真实 mention 被处理、context 被追加）。两个独立的泄漏负控 —— 每次只在 `packages/context/session-reference/src/index.ts` 中把 resolver 两个监听器之一临时注册到根上下文 —— 各自只让目标断言失败（销毁后的 assemble 回调仍读取路由变量，2 对 0；销毁后的 pre-step 回调仍执行并经被撤销的 resolver 拒绝而非透传 seed），其余 46 个测试通过；每次突变都按字节恢复，并以长度、SHA-256 与 git blob 核验后才做 135/135 的恢复后正向运行。运行实现、vendor 源码、锁文件与 r29–r39 证据保持原字节。本轮只关闭这四个上下文测试：run 35057856906 的 client hook、pwsh、FileHandle、coverage 阈值与历史 worker/Web 失败仍在范围之外。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/context-lifecycle-tests-r40/windows-execution/FINDINGS.md)。
