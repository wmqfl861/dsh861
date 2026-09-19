# W11F start record — 2026-09-19

## Identity

- Task: W11-F pi-ai expected 失败最小解锁修复（B01-20260919-01；总控裁定登记入 B01）。
- Repo: `C:\Albert\project\dsh861`, branch `chore/latest-stable-upgrade-20260912`, HEAD at start `1d412762eb4fe0845cc72dd4b5a1e27fad02b49e`（工作树含其他工作包的未提交改动，属总控面；本包不触碰）。
- Platform: win32 10.0.26200 x64。Node `v26.8.2`（`C:\dsh-r24-upgrade-20260912-01\node-v26.8.2-win-x64`），pnpm `12.4.1`（`C:\dsh-r24-upgrade-20260912-01\pnpm-12.4.1`），双目录 PATH 前缀；vitest 走直连 `node node_modules/vitest/vitest.mjs`（r45 发现 A）；自有 TMP/HOME 根 `C:\dsh-b01-w11f\tmp\`；`DSH_SNAPSHOT` 未设。
- Raw workspace（仓外）: `C:\dsh-b01-w11f\`（`logs\`、`mutations\`、`tmp\`）。

## Owned / frozen inputs

- W（本包写入面）:
  - `apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts` — start blob `d733bbad1ba186db4640445124772836cfe5e147`。
  - 直接 fixture（预授权路径内，先报告后动）: `apps/cli/tests/profiles/headless/tests/fixtures/pi-ai-defaults.patch.yml` — start blob `ec5e74d781abef08909654f9d60d41c846149ce2`。**报告**：W11 §4.2 与任务指令预授权"若确认 idle-timeout 重试族，由 fixture 拥有者上调 `streamIdleTimeoutMs`"；本地取证（见 FINDINGS F1/F2）确认后才会动此文件，且只动该字段与其注释。
  - 本证据目录 `W11F/`。
- F（冻结只读）: `deepseek-defaults.patch.yml`（姊妹场景拥有者，不在本包面）、`packages/llm/llm-pi-ai/**`、`packages/session/session-title*/**`、`packages/llm/llm/src/retry-policy.ts`、mock 服务器语义、其余全部仓面。

## Start-state facts established before any edit（代码取证，非运行取证）

1. 场景 `sends pi-ai DeepSeek compatibility through the one-shot app`（`headless.expected.e2e.ts:550-601`）断言 `server.requests` 恰好 2 条（1 主 `max_tokens` 1024 + 1 标题 `max_tokens` 64），服务器以 `waitForTitleRequest: true` 挂起主响应（仅 `: keep-alive` 注释，60ms 节奏）直至标题请求到达。
2. **pi-ai 空闲看门狗看不到注释**：`packages/llm/llm-pi-ai/src/adapter.ts:354-355,394-396` 的 `idleWatchdog` 只在 `toStreamChunks` 产出内容块时重置（`stream.ts:142-233`：`start` 不产出、注释根本不进入 pi-ai SDK 事件流；`dsh-timeout` 的 `rearm()` 传输活动钩子在 pi-ai 适配器无对应调用）。与 r29 立案的 llm-deepseek（`parseSse` `onComment` 计为传输活动）结构性不同：deepseek 的 1000ms 度量的是 keep-alive 间隙（60ms 节奏，16.7× 裕度），pi-ai 的 1000ms 度量的是**首个内容块到达时间 = 标题请求派发滞后 + ~240ms 释放尾**。
3. 标题请求派发时机：首条 user message 置 pending（`session-title/src/index.ts:499-523`），主请求 `request/header`/agent-loop 请求标记时启动（`:525-552`），与主请求并发。mock 因此设计为挂起主响应等待标题请求（`waitForTitleRequest`）， preceding 场景 `:513` 直接钉住该服务器行为。
4. 重试策略（`packages/llm/llm/src/retry-policy.ts:14-24`）：默认 `maxRetries 5`，`TIMEOUT` 可重试，退避 500ms→10s 指数 + ±10% 抖动。run 41 的 "2 vs 5" = 1 主 + 3 重试 + 1 标题，与 26,374ms（姊妹 4–6s）一致（未拉伸下限 ≈ 3×1000ms + 3.5s 退避 + 240ms ≈6.74s；CI 饥饿拉伸后 ~20s 量级）。
5. 结论（代码层）：本场景对 `streamIdleTimeoutMs` 的真实约束不是 4×keep-alive（注释不可见，该锚定对 pi-ai 语义为空），而是"标题请求派发滞后 + 释放尾"。run 41（Linux CI）上该滞后 >1000ms 持续了 3 个重试周期。

## Planned execution order

baseline 场景直跑（预期本地过，记录请求数/时长）→ 诊断仪表复刻（测试文件内临时插桩：请求到达时间戳 + 服务器侧标题注册延迟旋钮 + `llm/retry` 事件转储；仓外诊断运行，定级 CI 条件的微缩复刻）→ 按 W11 §4.2 路径修复（fixture `streamIdleTimeoutMs` 上调 + 同款文本守护断言，2 请求契约不动）→ 场景过 + 整文件零回归 → 负控（旧值 1000 字节预存恢复 → 必须失败；恢复修复值 → 过）→ FINDINGS/报告。CI Linux 复验为最终判据。
