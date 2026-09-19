# W03 — CP-A4 终验轮：run 35460812553（W03/W04/W11-F 三线终验合一）

轮次：CP-A4（`89dce53b805241d9ec38f8c8ea7bde1109dac4b4`，"feat(b01): platform sidecars, pi-ai guard, fs-ext migration cleanup, and preview artifact evidence"，非强制快进 `1d412762eb..89dce53b80`）。承接 [CP-A3 轮](linux-evidence-cp-a3.md)。观察窗口：2026-09-19T18:22Z – 18:45Z；轮询纪律遵守（6 次 REST 状态查询，每次 max-time 55s，间隔 105–120s；一次 schannel TLS 瞬断 15s 后重试成功；run 全程 18:19:16Z→18:36:30Z = 17m14s）。

## 1. Run / checkout 身份链（API 实测，闭合）

| 项 | 值 |
|---|---|
| CI run | `35460812553`，run_number **43**，attempt 1，event `pull_request`，18:19:16 → 18:36:30Z，conclusion **failure**（无 re-run） |
| PR head / base / merge | head `89dce53b80…`（=CP-A4=本地 HEAD）；base `5434305c…` 不变（1370 commits / 7684 files 规模不变面）；CI checkout merge `9ddc0cfe6fe44b287779550b274d3c2b9f53d060`（cat-file 实测 parents = base+head） |
| merge tree 一致性 | **`git diff --stat FETCH_HEAD HEAD` 为空**——匿名 smart-HTTP `git fetch` merge sha 后全树比对，CI 执行树与本地候选**逐字节一致**（强于 CP-A3 轮的四文件 blob 核） |
| 关键文件 blob（= 本地 HEAD = W04 round-2 §2 清单） | `ci.yml` `c6b939a7`（与 A3 轮相同，workflow 保护面零改动）；pi-ai fixture `cf0ac282`、`headless.expected.e2e.ts` `653c14f7`、`subagent-diagnostic.expected.e2e.ts` `0e1e6ffa`；`sdk.snapshot.ts` `1463e72a`、`teardown.snapshot.ts` `911fc5fc`；agent-team `tool-schemas.default` `d62814db` / `system-prompt.default` `a5bdc9ab` / `tool-schemas.1.default` `d62814db` / `system-prompt.1.default` `d2eefffd`；subagent `tool-schemas.1.default` `81ceebfa` / `system-prompt.1.default` `b3c8e3db`——六份新 `.default` 侧车逐一相符 |

## 2. 三线终验判定

### 2a. Linux consumers `test:expected` / pi-ai 20000ms 预算（W11-F 终验）——**无失败签名；权威确认待 gate 表**

- consumers 作业（105944222541）gates 步骤 "Run compatibility, snapshot, and artifact gates" **failure**（18:20:15→18:24:21，4m06s），但 **annotations 仅 2 条**：Node20 弃用警告 + 通用 `Process completed with exit code 1.`（line 125）——**零测试级失败注释**。
- **pi-ai 失败零出现**：run 40/41 经同一 annotations 渠道精确浮现 "2 vs 5" 计数断言（A2-4/W11F F1），渠道保真已证；本轮无任何 AssertionError / Test-timed-out 注释。W11-F 守护断言（fixture ≥10000ms，`headless.expected.e2e.ts:570`）若回退将确定性失败并注释（负控 log 09：`expected 1000 to be greater than or equal to 10000`，5ms 内响亮）——未出现。
- gates 步骤时长 4m06s > A3 轮 3m21s（+45s）：与 pi-ai 场景在 20000ms 预算内完整跑毕（本地终态单场景 8.3–8.8s 量级）+ 后续 gate 首次真实执行一致；若 pi-ai 仍先失败，fail-fast 将截短而非拉长步骤。
- **判定**：全部可观察证据与 "expected 套件绿、pi-ai 过" 一致，但 aggregate 存在一个无注释失败点（见 2b 尾注），**权威结论以 artifact `10589694221` gate 表为准**（5,851 bytes）。

### 2b. `test:snapshot` 门五项清单（W04 round-2 §5）——**run 42 两失败签名零复现；三项首达无失败签名；权威确认同上**

- **run 42 的两个失败签名零复现**：`subagent-teardown: session 1 header 1` 与 `agent-team-teardown: session 0 header 1` 的 AssertionError 在 run 42 经本渠道逐字浮现（A3 §4），本轮 annotations 完全没有 teardown 相关条目。
- **五项清单逐项**（预期侧车已在 merge tree 验证到位）：① agent-team s0 header vs `tool-schemas.default.expected.json`（31 工具 bash+team 集）——run 42 失败位，无失败签名；② agent-team s0 prompt vs `system-prompt.default.expected.md`——首达，无失败签名；③ subagent s1 header vs `tool-schemas.1.default.expected.json`（25 工具 bash 集）——run 42 失败位，无失败签名；④ subagent s1 prompt vs `system-prompt.1.default.expected.md`——首达，无失败签名；⑤ agent-team s1 header+prompt vs 派生子件（`d62814db`/`d2eefffd`）——首达，无失败签名。fail-loud 性质不变（比较逻辑零改动，选错/错配将以具名字段 diff 浮现，run 42 已证）——**未浮现任何 diff**。
- **载荷尺寸佐证**：consumers gate-evidence artifact `10589694221` 仅 **5,851 bytes**，对比 run 42 快照失败轮 30,910（两份 deep-equal diff）与 run 40 expected 失败轮 9,145（pi-ai/terminal-bash/python 载荷）——无断言 diff 载荷。
- **aggregate 仍 failure 的归因（重要，如实记录）**：失败点在 expected/snapshot 的失败签名面之外。`ci-consumers` gate 名单（`scripts/run-gates.ts` `ciConsumerGates()`，merge tree 内实证）：build、node-compat、publint、built-package-invariants、lint-and-duplication、snapshot、expected-output、web-snapshot（after 全部七个 reader）、doc-typecheck、node-next-types、built-bin-smoke（concurrency 4，fail-fast 1）。run 40–42 三轮 fail-fast 从未放行到 web-snapshot，故其从未在本系列真实执行。候选（按嫌疑排序）：**web-snapshot 首次真实执行**（浏览器面）、built-bin-smoke（15 文件 vitest e2e，本系列未证绿）、doc-typecheck（A4 改动 `docs/event-producer-consumer.i18n.yaml`/`.zh.md` 对）、node-next-types；或既有 gate 回归（低概率）。A4 桌面/preview 面（`b01-preview-*.mjs`、`runtime-payload-smoke.mjs`）**不在 ci-consumers 任何 gate 文件面**（git grep 实证：仅桌面本地与证据树引用）。**精确归因须总控下载 gate 表 + 步骤日志**。

### 2c. 两条 Linux 准备管线（第四连证）——**确证通过（步骤级 API 权威）**

- `node 24 / coverage`（105944222738）："Install dependencies and prepare bubblewrap" **success**（18:19:40→18:19:55，15s）。
- `node 24 / snapshots and artifacts`（105944222541）：同步骤 **success**（18:19:37→18:19:53，16s）。
- 即下载→hash→逐字段契约→审计→Meson→编译→[7/7] 链接→ELF/NEEDED/ldd→版本→probe→PATH 发布在两路第四次连续通过（run 40 CP-A2 首证 → run 41 W11 轮 → run 42 CP-A3 → run 43 CP-A4）。A3 判定口径不变：构建面已证、安全分项 NOT_RUN 精确阻塞、sandbox.yml NOT_CLOSED。

## 3. 其余作业状态表（17 jobs 全表，attempt 1）

| 作业 | id | 结论 | 备注 |
|---|---|---|---|
| node 24 / snapshots and artifacts | 105944222541 | **failure** | gates 步骤 4m06s；无注释级失败签名（§2a/2b）；evidence 上传 success |
| node 24 / coverage | 105944222738 | **failure** | 准备 15s 过；残留在 §4；evidence 上传 success |
| node 24 / static | 105944222710 | success | static 维持绿（A4 docs pair 改动过 static 门） |
| windows node 24 / observational | 105944222744 | success | 维持绿 |
| windows node 24 / coverage | 105944222769 | **failure** | `scripts/gen-client-catalog.spec.ts:200` 30s timeout（与 A3 同签名，G6 timeout 族；本轮非 typert 变体）；不强求 |
| windows node 24 / build | 105944222735 | success | |
| windows node 24 / native tests | 105944222759 | success | |
| node 22.19 / node 24.9 / node 26 | 105944222731/741/800 | success | 兼容矩阵 |
| node 24 / benchmarks | 105944222666 | success | |
| python 3.10 / keyless SDK | 105944222661 | success | |
| python runtime matrix ×4 | 105944222724 等 | success | |
| all checks passed | 105946190990 | failure | 随作业失败，汇总位 |

其他 workflow：E2E skipped（无 key，符合预期）；Release (dsh)/(vendor)、Node Addon System success；Issue policy/lifecycle #79 failure、Build PR preview #43 failure——非 W03 范围，沿 F11 归类不展开。

## 4. coverage 残留失败面（维持 W11 归类；prepare-spec 维持绿）

- **prepare-spec 零失败第三轮延续**（A3 转绿后保持）：annotations 中 `prepare-ci-bubblewrap.spec.ts` 零出现。
- `packages/experimental/inspector/tests/cordis-tree.host.spec.ts:62` CDP timeout（A3 复现）**+** `integration.host.spec.ts:45` CDP timeout（**新增一例**，同 G3 环境敏感族）。
- `packages/experimental/code-runtime-python/tests/runtime.spec.ts` wall-clock 60s（复现，同 A2/A3）。
- 逐文件权威表在 artifact `10590080207`（176,884 bytes）。

## 5. 总控下载清单（授权通道）

1. **必需**：artifact `10589694221`（`gate-evidence-node-24-consumers-run35460812553-attempt1`，5,851 bytes）——gate 表：哪个 gate 失败、snapshot/expected 结论、fail-fast 跳过名单；三线终验 (a)/(b) 的权威收口依据。
2. **必需**：job `105944222541` 步骤 "Run compatibility, snapshot, and artifact gates" 完整日志（失败 gate 的错误文本；pi-ai 场景时长佐证）。
3. 可选：artifact `10590080207`（Linux coverage 短缺明细，W11 输入）、`10588904564`（Windows coverage，G6 族）。

## 6. 终验判定汇总

- **(a) W11-F pi-ai/expected**：无失败签名（注释渠道保真已证）+ 时长一致 —— **推断绿，待 gate 表权威确认**。
- **(b) W04 snapshot 五项**：run 42 两失败签名零复现 + 无 diff 载荷 + 侧车 blob 就位 —— **推断五项全过，待 gate 表权威确认**。
- **(c) 准备管线第四连证**：**确证通过**。
- 整体：三线中 (c) 收口；(a)/(b) 所有可观察证据与预期一致，唯 consumers aggregate 存在 expected/snapshot 之外的失败点——**不构成对 (a)/(b) 的反证**（失败签名面为空），但收口须 artifact 定位该失败 gate 并归因后再判定。
