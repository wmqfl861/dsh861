# Agent Note：为 DeepSeek defaults headless 夹具配置抗抖动的流空闲预算

Status: implemented

[English](2026-09-14-headless-deepseek-defaults-idle-budget.md) | 中文

## 问题

[DeepSeek defaults 场景](../../../../apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts) 断言 one-shot 应用恰好发出两次提供方请求：主请求（`max_tokens` 256000）与会话标题请求（`max_tokens` 64）。该场景间歇性收到第三次请求（CI run 34765078459 job 103744493702；本地 4 次运行中 2 次偏离）。采集到的 session 事件将第三次请求归类为主请求重试：一条 `llm/retry` 事件，`failure: "DeepSeek stream idle timeout after 150ms"`、代码 `TIMEOUT`，记录于标题请求已经发出之后。[夹具](../../../../apps/cli/tests/profiles/headless/tests/fixtures/deepseek-defaults.patch.yml) 将 `streamIdleTimeoutMs` 固定为 150，而 loopback mock 每 60 ms 写入一条 SSE keep-alive 注释——在并发标题流与 tsx 源码模式转换的负载下，相邻两条 keep-alive 的间隔间歇性超出这 2.5 倍余量。

产品行为正确且另有钉死：SSE 注释经 `parseSse` 的 `onComment` 计入传输活动，空闲 watchdog 有专项单元测试（[adapter.spec.ts](../../../../packages/llm/llm-deepseek/tests/adapter.spec.ts)），重试 `TIMEOUT` 失败是已部署策略并有自己的场景测试。唯一的人为约束是夹具自身的空闲预算，因此修复归属夹具。

## 决策

夹具的 `streamIdleTimeoutMs` 从 150 提升到 1000，与 pi-ai defaults 同族夹具一致，对 keep-alive 节奏留出 16.7 倍余量。测试为节奏命名（`KEEP_ALIVE_INTERVAL_MS = 60`，替换 mock 内两处字面量），并断言从夹具文本读出的空闲预算至少为四个 keep-alive 间隔。把预算改回旧值会在该断言处确定性失败（"expected 150 to be greater than or equal to 240"，7 ms），而不再以幻影请求计数 flake 的形式复现。

请求计数契约不变：仍然恰好一次主请求加一次标题请求，不加 sleep、不吞重试、不刷新 golden、不关闭标题功能。

## 备选方案

| 否决 | 一句话理由 |
|---|---|
| 把计数放宽为 3、`>=2` 或过滤后再计数 | 掩盖该场景存在的目的——钉死两次请求契约 |
| 只缩短 keep-alive 间隔 | 任何有限节奏都可能停顿；增加定时器开销却没有真实预算 |
| 修改重试策略或空闲 watchdog | 属正确且被单元测试钉死的产品行为；夹具预算才是唯一人为约束 |

## 后果

修复后该场景连续 6 次运行通过。与修复前文件的整文件 A/B 逐用例结果一致，说明本机剩余 6 个失败是预存的 `{{cwd}}` golden 路径归一化差异（8.3 短名临时路径；这些夹具由 macOS/Linux 通道负责），与本次改动无关。执行证据：[r29 windows-execution](../../../../development/remediation/2026-09-13/ci-gates-r29/windows-execution/verification.json)。
