# P0-B 源码索引与职责矩阵

前置：P0-A 已由真实 OpenCode r03 明确 PASS；详细前置和哈希见 [preconditions](evidence/governance/preconditions.json)。本索引只记录实际源码入口，不将服务声明、mock 或开发审核工具当产品 harness。

## 共享 seam

`packages/subagent/subagent/src/types.ts`、`index.ts`、`descriptor.ts` 和 `continuation.ts` 定义 SubagentProvider、SubagentRun、能力声明和步骤交接接口。任何新 provider 都必须分别提供 Service Definition、Service Provider 和 Consumer，并通过 effect 注册。

## Codex

`packages/subagent/subagent-codex/` 是 package-local `@openai/codex` app-server 的 one-shot provider。package.json 固定运行依赖 0.149.1；源码和 real-product 测试负责启动、权限、取消和结果收敛。父 Session 当前只收最终文本，原生 tool、usage、stderr、workspace diff 和原生 session 不会自动成为父日志。真实产品验证尚未执行。

## Claude Code

`packages/subagent/subagent-claude-code/` 使用官方 Agent SDK 0.3.241，执行一次性 query；其 real-product 测试覆盖 SDK/CLI 版本、权限和取消断言。`persistSession=false`，settingSources 省略，不能凭包存在认定 hermetic 或 continuation。真实产品验证尚未执行。

## ACP

`packages/subagent/subagent-acp/` 是通用 ACP subprocess backend，不能代表 OpenCode 或 Grok 身份、版本、usage 或原生工具轨迹。

## MCP 与 Skill

`packages/mcp/mcp-client/src/index.ts` 负责外部 MCP 连接及工具注册；`packages/skill/skill/src/index.ts` 负责 provider registry 与作用域选择。两者尚未构成四种 harness 的集中能力控制面。

## OpenCode 与 Grok

当前限定源码索引未发现产品级 OpenCode 或 Grok provider；OpenCode 仅有开发硬审核进程核验，Grok 需要独立 discovery 和受控安装。B1 的真实程序发现决定是否实施最小适配，缺少协议、版本、隔离或凭据时记录 BLOCKED。

## 尚缺验证

每种 harness 的真实程序、版本、配置/认证发现、专用目录、允许/拒绝工具操作、取消后的进程归零、Session/交接和 usage/native trace 均需 B2-B9 的外部证据；P0-A 与本索引均不替代这些结果。
