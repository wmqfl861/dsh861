# Agent Note: Codex 提供方边界内的私有原生 stderr

Status: implemented

[English](2026-09-09-codex-private-stderr.md) | 中文

## Problem

原生 CLI 可能加载宿主不知道的凭据。仅匹配已经登记的秘密值，不能证明任意原生诊断都可以安全转发。内部 Codex 一次性运行器接受子进程句柄，并向宿主转发传入的 stderr 管道，因此注册的提供方不能将不可信原生管道直接交给它。

## Decision

[注册的 Codex 提供方](../../../../packages/subagent/subagent-codex/src/index.ts)在内部运行器收到子进程之前，使用 [withPrivateCodexStderr](../../../../packages/subagent/subagent-codex/src/private-stderr.ts) 包装每个新取得的句柄。包装器持续读取原生 stderr，但不解码、保留、转发、计算摘要或分类其内容，并且不暴露 stderr 管道。原始流错误被处理而不复制错误消息。即使释放失败，读取仍持续到流真正关闭，然后只移除自身监听器。

包装器以原始子进程对象为接收者委派 terminate 和 wait 方法，并保留 pid、stdin、stdout、收集读取器和退出结果的实时访问。它不拥有进程终止、不将失败变为成功、不重新解释取消、不修改模型配置，也不增加凭据来源。进程树仍由 subprocess 服务管理。本策略适用于注册的提供方入口；直接调用内部运行器的测试仍是由调用方负责流策略的测试接口。

## Alternatives considered

选择性匹配已配置 API Key 可以保留更多日志，却不能覆盖只有原生 CLI 才发现的凭据。先转发原文再脱敏会留下不可撤回的泄漏。停止读取而不排空管道可能阻塞持续输出 stderr 的子进程。替换共享进程生命周期会增加第二个进程所有者。完整屏蔽诊断牺牲排障细节，换取不具有上述行为的小型、明确的保密边界。

## Consequences

本提供方不提供原生 stderr，屏蔽也不是“没有输出秘密”的证据。既有结果路径仍提供协议和进程诊断事实。完整的安全诊断采集、stdout／最终答案保护、原生文件存储、错误原因链及其他产品提供方，仍需要独立策略和验证。本改动不代表产品 AC 或节点获批。

## Verification

[共享回归用例](../../../../packages/subagent/subagent-codex/tests/private-stderr.cases.ts)覆盖原始数据和错误、身份与方法接收者、并发子进程、释放失败、真实 Node 子进程的大量输出、取消和监听器清理。[提供方接线夹具](../../../../packages/subagent/subagent-codex/tests/private-stderr-provider.fixture.mjs)执行实际提供方源码，显式替换 schema、registry 和 run 服务并使用合成 Node 子进程；它不是 Loader 或原生 Codex 测试。[验证记录](../../../../development/remediation/2026-09-09/codex-stderr-r04/verification.json)区分这些检查与尚未执行的仓库及原生产品验收。
