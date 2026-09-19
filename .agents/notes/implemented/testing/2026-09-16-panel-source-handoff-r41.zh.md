# Agent Note: Hand the panel-info root source over inside one synchronous plugin apply

Status: implemented

[English](2026-09-16-panel-source-handoff-r41.md) | 中文

## Problem

client 测试运行时的 panel-hook 用例先释放默认 `panelInfo` root source，再 `await runtime.mount` 挂载替换提供者。`provideRoot` 的 disposer 会同步重建 root 标准 source binding 并通知 root 订阅者，因此释放动作在已挂载的探针 entry 仍存活时就调度了一次 React 重渲染；`mount` 内部的异步稳定化在新插件 `apply` 运行之前刷掉了这次渲染。entry 看到的 binding 没有 `panelInfo` hook，`materializeStandardBinding` 不再产出 `usePanelInfo`，探针组件的调用抛出 `TypeError: usePanelInfo is not a function`，entry 边界捕获并使该 entry 退位，用例最终在空 outlet 上失败（`expected '' to be 'next:conversation'`；CI run 35066915772 中两平台唯一的共同断言失败）。React 官方 `act` 文档也不承诺异步边界内已调度的中间状态永不渲染。

## Decision

该用例现在把默认 source 的释放与替换 source 的 `provideRoot` 放进同一个同步插件 `apply` 回调，经由既有的 `runtime.mount` 执行，两操作之间没有 `await`、flush 或任何额外 tick；稳定化沿用 `mount` 自身的 act 包装。registry 仍然逐次发布两份 binding——这修复的是测试的交接时序，并不新增原子 source 替换 API。用例同时以真实观测验证交接，而不是信任恢复后的最终文本：公开的 `runtime.slots.onEntryError` 观察器记录本 slot 的 entry 错误（只记录——不吞 console、不替换错误处理），并在交接后与销毁后断言为空；不渲染任何 `[data-slot-error]` 元素；交接前捕获的 span 元素在交接后断言仍是同一个已连接实例（无 remount、无重新注册 entry、无 key 变更、无报错后的额外渲染）；替换 source 以一个值驱动 UI，而已释放旧 source 的更新不影响它；重复调用 `releasePanelInfoSource` 不撤回替换；清理沿用 `runtime.dispose` 的既有顺序（先卸载视图，再销毁 fiber 与 source），观察器在 `finally` 中退订。

## Alternatives considered

**让 registry 延迟通知或原子地合并两操作。** 那会为修复一个测试的顺序而改变所有订阅者共享的 renderer 语义；空档属于测试的交接编排，不属于 registry 契约。

**可选调用（`usePanelInfo?.`）、探针内 try/catch 或硬编码回退字符串。** 每一种都会掩盖缺源崩溃，而该用例存在的意义就是观察它；真实 entry 错误必须保持可观测，负控才有意义。

**仅凭恢复后的最终文本推断交接干净。** remount 的 entry 或被 key 变更重置的边界同样能恢复最终文本；身份断言与 entry 错误断言才是"同一渲染实例无崩溃穿越交接"的证明。

## Consequences

未修复基线恰好失败在唯一目标用例（1 failed / 9 passed，探针处 `usePanelInfo` TypeError，随后 `next:conversation` 断言处空 outlet），与 CI 一致。修复后 10/10 通过，聚焦过滤仍恰好命中目标用例。两个独立负控证明修复是承重的：恢复旧的"先释放、显式 `await runtime.flush()`、再挂载"顺序（以显式 flush 作为确定性刺激）复现了真实的 `usePanelInfo` entry 崩溃与空输出断言失败；在同步 apply 中仅省略旧 source 释放则失败于真实生产拒绝 `duplicate root standard hook 'panelInfo' at prop 'usePanelInfo'`（来自 `copyUnique`）。两次变异都按字节恢复（长度、SHA-256、git blob 复核一致），恢复后文件均回到 10/10。运行实现（测试运行时、registry、bindings、scoped-slots renderer）、vendor、锁文件、工作流与 r29-r40 证据字节不变；typecheck、lint、duplication、doc-sync 门禁通过。范围外且未变：Linux Python wide-completion 失败、FileHandle 异常、覆盖率阈值与历史间歇问题。证据：[windows-execution/FINDINGS.md](../../../../development/remediation/2026-09-16/panel-source-handoff-r41/windows-execution/FINDINGS.md)。
