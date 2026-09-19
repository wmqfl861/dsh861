# W11 pi-ai-classification — headless.expected.e2e.ts:572（2 vs 5）定性

失败原文（run 41，job node-24-consumers，`logs/expected-output.log`）：`AssertionError: expected [ { …(8) }, { …(8) }, { …(8) }, …(2) ] to have a length of 2 but got 5`，`❯ apps/cli/tests/profiles/headless/tests/headless.expected.e2e.ts:572:31`，用例 `sends pi-ai DeepSeek compatibility through the one-shot app`，耗时 26,374ms（同文件姊妹场景 4–6s）。断言打印不含 5 个请求体，构成（几次主请求/几次标题请求/重试归属）本轮证据未展开。

## 1. 定性结论

**本分支既有（环境敏感 flake 家族），非 B01 引入。** B01 候选与该失败无文件所有权或行为路径关联；失败机制属于本分支已立案、已发生过姊妹场景同型的"幻影请求 = STREAM_IDLE_TIMEOUT 重试再派发"家族。

## 2. 证据链

1. **B01 diff 零关联面**：`7f63d03538..1863a0dd` 仅 `scripts/prepare-ci-bubblewrap*`、`scripts/doc-budgets.manifest.json` 与文档/运行产物；无任何 `packages/`、`apps/` 改动（`git diff --stat` 全清单核过）。请求路径（pi-ai 适配器、title 调度、重试策略、agent-loop）与测试本体均不在 B01 面。
2. **相关源码在"最后 Linux 通过 → 本次失败"窗口内零变更**：
   - 测试文件最后变更 `1baf323167`（2026-09-14，r29，早于 B01）：其 diff 对 pi-ai 场景零改动（仅 deepseek-defaults 场景新增 idle-budget 断言 + `KEEP_ALIVE_INTERVAL_MS` 常量重命名，值仍 60）。
   - `apps/cli/tests/profiles/headless/tests/fixtures/pi-ai-defaults.patch.yml`（`streamIdleTimeoutMs: 1000`）在该窗口无提交；`packages/llm/llm-pi-ai` 无提交；`pnpm-lock.yaml` 无提交（依赖集字节不变）。
   - 窗口内唯一触 core 的相关提交 `9f27326b07`（r44 teardown ownership，2026-09-17）改 agent-loop/agent/agent-team teardown，不在 title 调度或 llm 重试面。
3. **本分支同文件同型失败已有前科（家族既有）**：r29 立案记录（`.agents/notes/implemented/testing/2026-09-14-headless-deepseek-defaults-idle-budget.md` + `development/remediation/2026-09-13/ci-gates-r29/verification.json`）：run 14（`34765078459`，job `103744493702`，head `ccc5aa51`，2026-09-13）Linux consumers `test:expected` 首失即同文件姊妹场景 `:471` "expected requests to have a length of 2 but got 3"，事件级归因为主请求 `llm/retry`（`DeepSeek stream idle timeout after 150ms`，code TIMEOUT）。该轮 **pi-ai 场景通过**（expectedTests 30 过/1 失败，唯一失败为 :471）。
4. **最早可追溯的 pi-ai 自身失败 = 本轮 run 41**：此前全部留痕均通过 —— run 14 Linux（上述）；r29 Windows 本地全文件两轮 `✓ sends pi-ai … 6068ms/4841ms`（`development/remediation/2026-09-13/ci-gates-r29/windows-execution/logs/10、11-*.log`）。
5. **环境漂移是窗口内主要变量**：run 14 node 26.8.2 → run 41 node 26.9.0；runner 镜像 20260828.x；两者间无相关源/依赖变更（见 2）。26,374ms 耗时（对比姊妹 569ms–6s）与重试退避签名一致，符合调度抖动触发 idle-watchdog 家族特征。

## 3. "本分支无 CI 绿基线"核验

以本地可核证据盘点 PR #13（base `5434305c`）CI：

- run 14（34765078459）：consumers `test:expected` 30/31 —— 红（:471 flake）。
- run 15（34799140559，r30/r31）：consumers 仅留存 `node-compat` 聚合（4 smoke gates 绿）；expected gate 无留存证据。
- run 16–38：本地无 consumers expected gate 任何留痕（r32–r46 证据树 grep 无 `expected-output`/该测试失败记录）。
- run 39/40：Linux 两条作业死于准备步骤（bubblewrap），未到 gates。
- run 41：本轮，expected 红（pi-ai）。

结论：本分支不存在任何可本地核验的"consumers（含 test:expected）或 coverage 全绿"CI run；无法以绿基线做失败差分。pi-ai 场景自身的最后 Linux 通过证据为 run 14（其时至 run 41 相关面零变更，见 §2.2）。

## 4. 最小修复路径建议（仅建议；不在 B01 FILE_OWNERSHIP，B01 内不改文件）

前置：该测试/fixture/pi-ai 包均不在 B01 登记面 → 需总控登记新工作包或经所有者确认后由拥有者执行。r29 已确立的约束继续有效：不改计数契约（不得 `>=2`/过滤后计数）、不加任意 sleep、不吞重试、不刷 golden、不关 title 功能。

1. **证据先行（必须）**：复现并采集 5 个请求的构成 —— mock 侧逐请求记录 `max_tokens/model/stream` 分类（1 主 + 1 标题 + 3 重试，或 4 主 + 1 标题），并采集 session 事件中的 `llm/retry`（failure/码）。run 41 的 gate-evidence 不含请求体，临时目录已销毁，只能复现取证（r29 LOCAL_AGENT_TASK.md §四 即同款流程，可直接沿用其取证清单）。
2. **若重试为 STREAM_IDLE_TIMEOUT（与 r29 同因）**：在 fixture 拥有者处做最小修复 —— 上调 `pi-ai-defaults.patch.yml` 的 `streamIdleTimeoutMs`（现 1000；建议按实测抖动倍数取值并保留对 `4 × KEEP_ALIVE_INTERVAL_MS` 下限断言的同款守护），两请求契约不变。这是 r29 已验证有效的同族修法（deepseek-defaults 150→1000 后六连绿）。
3. **若多余请求来自 title 侧或重复调度**：修真正的拥有者（title 调度或 pi-ai 适配器的请求生命周期），不修计数断言、不修 mock。
4. **修复的解锁价值**：`test:expected` 复绿 → fail-fast 解除 → `test:snapshot` gate 实际执行 → W04 F4.2/F4.3 的 Linux sdk snapshot/sidecar 判定获得真实执行证据（run 41 中该 gate 为 skipped，见 failure-ledger G5 对 W03 A2-7 的更正）。
5. **非修复项**：不得以跳过/降级该用例换取 CI 绿；不得在本分支把 pi-ai 场景从 expected 套件摘除。

## 5. 残留不确定性（如实记录）

- 5 个请求的构成未取证（断言打印为形状摘要）；"3 次重试"是基于 r29 家族机制与时长的推断，不是已证事实 —— 故修复路径把取证列为第一步。
- run 16–38 的 consumers 状态无本地留痕；"无绿基线"结论限定于"本地可核验证据范围内"。
- Node 26.8.2→26.9.0 与 runner 镜像漂移是环境主变量候选，未做隔离实验证实（超本轮只读边界）。
