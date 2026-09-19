# W11F findings — pi-ai expected "2 vs 5" 最小解锁修复

Run: B01-20260919-01 / W11-F. Machine: win32 10.0.26200 x64, Node v26.8.2, pnpm 12.4.1（双目录 PATH 前缀）。全部运行走直连 `node node_modules/vitest/vitest.mjs`（r45 发现 A），自有 TMP 根 `C:\dsh-b01-w11f\tmp\`，`DSH_SNAPSHOT` 未设。Raw logs: `C:\dsh-b01-w11f\logs\`（01–10，已镜像到本目录 `logs/`）；字节预存/恢复与最终 diff: `C:\dsh-b01-w11f\mutations\`。

## F1. 5 请求取证（本地受控复刻，run 41 签名逐字复现）

**方法**：mock 只能复现"标题请求晚于预算到达服务器"这一 CI 条件的微缩等价物 —— 在测试文件内加临时插桩（服务器侧标题注册延迟旋钮 `W11F_DEFER_TITLE_MS` + 每请求到达时间戳 + `inspect` 内转储 `.sessions` 持久日志中的 `llm/retry` 事件），取证后测试文件按字节恢复到起始 blob（`d733bbad…` 复核）再叠加最终修复。诊断插桩不存在于最终字节。

**defer=5000ms、fixture 仍 1000ms（log 03）—— 与 run 41 完全同签名**：`AssertionError: expected [ { …(8) }, { …(8) }, { …(8) }, …(2) ] to have a length of 2 but got 5`，失败行即计数断言（其前的 `stderr === ''` 通过——回合最终成功），EXIT=1，14,239ms。构成（相对首请求到达时间）：

| 到达(ms) | max_tokens | 判定 | 证据 |
|---|---|---|---|
| 0 | 1024 | 主请求 attempt 1 | 3 messages（system+user+runtime-context） |
| 1211 | 1024 | 重试 1 | `llm/retry` retry=1, delayMs=543.05 |
| 3167 | 1024 | 重试 2 | retry=2, delayMs=920.97 |
| 5017 | 64 | **标题请求**（服务器侧延迟注册点） | 2 messages |
| 6042 | 1024 | 重试 3 后 attempt 4，成功 | retry=3, delayMs=1850.19 |

持久会话日志 3 条 `llm/retry` 事件（同一 `retryId`，turn 1 step 1，provider `deepseek`，policyKey `["normal",5,["EMPTY_RESPONSE","RATE_LIMIT","SERVER","TIMEOUT","TRANSPORT"],500,10000,0.1]`），failure 均为 `pi-ai stream idle timeout after 1000ms` / `TIMEOUT`；退避 543→921→1850ms 即 500→1000→2000 阶梯 ±10% 抖动。重试 2/3 的到达间隔与"1000ms 超时 + delayMs"吻合（1956 vs 1921+35、2875 vs 2850+25）；重试 1 的 332ms 提前量 = 首请求连接建立在 dispatch→到达上的约 330ms 传输（后续请求复用连接）。**5 = 1 主 + 3 次 STREAM_IDLE_TIMEOUT 重试 + 1 标题。**

**族谱映射（同机制、不同滞后/预算比）**：healthy（无延迟，log 05）恰 2 请求、标题滞后 1ms、0 重试；defer=2700ms（log 04）→ "2 vs 4"（2 重试）；defer=5000ms → "2 vs 5"。幻影请求数 = 2 + ⌊(标题滞后 − 预算)/(预算 + 退避)⌋ + 1。r29 的 "2 vs 3"（deepseek-defaults，预算 150ms 被更小滞后超越）与本轮 run 41 的 "2 vs 5"（pi-ai，预算 1000ms 被多秒滞后超越）是同一族的两端。

## F2. 根因判定（与 r29 同族，pi-ai 有一个结构性加重因子）

1. **重试族确认**：F1 的持久 `llm/retry` 事件与 r29 立案形态同构（STREAM_IDLE_TIMEOUT → TIMEOUT → 可重试 → 主请求再派发于标题请求之后）。
2. **pi-ai 加重因子（与姊妹场景的结构差异）**：llm-deepseek 的看门狗把 SSE 注释计为传输活动（`parseSse` `onComment`，r29 已定），1000ms 度量的是 60ms keep-alive 间隙（16.7× 裕度）；pi-ai 适配器的看门狗（`packages/llm/llm-pi-ai/src/adapter.ts:354-355,394-396`）只在 `toStreamChunks` 产出内容块时重置，而注释根本不进入 pi-ai SDK 事件流（`stream.ts:152-231`，`start` 不产出、无注释路径；`dsh-timeout` 的 `rearm()` 传输活动钩子在该适配器无调用）。因此 pi-ai 的预算度量的是**首个内容块到达时间 = 标题请求派发滞后 + ~240ms 释放尾**——本场景 mock 按设计挂起主响应直至标题请求到达（`waitForTitleRequest`，前置场景 `:513` 钉住该行为）。
3. **健康路径无本质延迟**：本地标题派发与主请求并发（滞后 1ms；触发链：首条 user message 置 pending → 主请求 `request/header`/agent-loop 标记启动，`session-title/src/index.ts:499-552`）。run 41 上该滞后在 Linux CI 调度饥饿下超过 3 个"1000ms 预算 + 退避"周期（未拉伸下限 ≈ 6.5s；26,374ms 对比姊妹 4–6s 的 ~20s churn 表明计时器同步拉伸），属 r29 已立案的环境敏感家族（W11 §2.5：node 26.8.2→26.9.0 + runner 镜像漂移为窗口内主变量，相关面零源码变更）。
4. **非根因排除**：非标题侧重复调度（标题恰 1 条）；非计数断言过紧（健康路径确定性 2 条）；产品行为（TIMEOUT 重试、看门狗、标题调度）均正确且各自有单测/场景钉住——唯一人工约束是 fixture 自己的预算，fixture 拥有修复（r29 已验证的同类修法）。

## F3. 修复（W11 §4.2 路径，断言与契约语义零变化）

- `apps/cli/tests/profiles/headless/tests/fixtures/pi-ai-defaults.patch.yml`：`streamIdleTimeoutMs: 1000 → 20000`（+4 行注释说明真实约束）。取值依据：≥3× run 41 未拉伸滞后下限（6.5s），且单次超时 + 0.5s 退避仍在子进程 30s 诊断时限内（真死流仍响亮失败）。
- `apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts`：pi-ai 场景头部加同款（r29 款式）fixture 文本守护——新常量 `PI_AI_MIN_STREAM_IDLE_TIMEOUT_MS = 10_000` + `expect(idleBudgetMs).toBeGreaterThanOrEqual(...)`，注释说明 pi-ai 语义（预算跨标题派发滞后而非 keep-alive 节奏）。**2 请求契约与全部既有断言原样未动**（守护为纯增量，语义上只收紧不放宽）。
- 起始→终态 blob：测试 `d733bbad1ba186db4640445124772836cfe5e147` → `653c14f74d870b6be0af48b0bff709d16d4d69b8`；fixture `ec5e74d781abef08909654f9d60d41c846149ce2` → `cf0ac2825c4dfd0316b44663ed3915068d91a8ca`。完整 diff: `C:\dsh-b01-w11f\mutations\w11f-final.diff`（+25/−1，`git diff --check` 干净）。

## F4. 验证（真实数量/退出码）

| 步骤 | 结果 | Log |
|---|---|---|
| baseline 起始字节（fixture 1000）单场景 | 1 passed（12,060ms），EXIT=0 —— 本地 Windows 不复现 CI 抖动（与 r29 本地两轮过一致） | 01 |
| 诊断 defer=5000 | 1 failed，"got 5"，EXIT=1 —— run 41 签名复现 | 02/03 |
| 诊断 defer=2700 | 1 failed，"got 4"，EXIT=1 | 04 |
| 诊断 healthy 转储 | 2 请求（标题@1ms），EXIT=0 | 05 |
| 终态字节单场景 | 1 passed（8,267ms），EXIT=0 | 06 |
| 终态字节整文件 | 7 passed / 6 failed，EXIT=1 | 07 |
| A/B：起始字节整文件 | 逐用例结果与 07 **完全一致**（diff 为空）——6 个失败为该 Windows host 既有 `{{cwd}}` JSON 转义路径 golden 类（macOS/Linux lanes 拥有；r29 记录的同款 6 个），与本修复零关联；pi-ai 场景两轮均过 | 08 |
| 负控：旧 fixture 字节（`ec5e74d7…`）+ 终态测试 | 1 failed：`expected 1000 to be greater than or equal to 10000`（:570，5ms，确定性、无 26s 等待），EXIT=1 | 09 |
| 负控恢复终态 fixture（blob 复核 `cf0ac282…`）后正向 | 1 passed（8,845ms），EXIT=0 | 10 |

## F5. 残留不确定性（如实记录）

- 本地未在无插桩条件下自然复现 run 41（Windows 本机标题滞后 ~1ms；CI 饥饿不可本地再现）。5 请求构成证据来自受控等价复刻（服务器侧标题注册延迟 ≡ 标题请求晚到服务器；对主看门狗 causal 链完全等价：主响应释放只依赖标题请求到达）+ 持久 `llm/retry` 事件，非 run 41 原始请求体（run 41 gate-evidence 不含请求体、临时目录已销毁——W11 §4.1 已注明只能复现取证）。
- 20000ms 是否足以覆盖未来更深的 CI 饥饿无先验保证；若仍被超越，失败形态回到同族计数断言（响亮），守护断言保证不会静默回退到 1000ms。
- **CI Linux `test:expected` 复验为最终判据**（本修复的解锁目标：该 gate 复绿 → fail-fast 解除 → `test:snapshot` gate 实际执行，为 W04 F4.2/F4.3 提供 Linux 证据链）。

## CP1 corrections (C1/O1, controller)

- C1: logs/03-diag-defer5000-dump.json was mislabeled (bytes = healthy dump; defer5000 dump did not survive the fixed-path overwrite). Renamed to 03-MISLABELED-was-actually-healthy-dump.json with a sibling note; F1 defer5000-specific figures are indirectly supported (log 03 verbatim signature + 04-dump defer2700 ladder + policy formula), not by a surviving defer5000 dump.
- O1: 00-start 4 arithmetic typo corrected (lower bound ~6.74s, not ~7.7s; 20000 remains ~3x that lower bound).
