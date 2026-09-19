# W03 — CP-A3 收尾轮：run 35450138445 + CP1 C1–C3/G5 修正落实

轮次：CP-A3（`1d412762eb4fe0845cc72dd4b5a1e27fad02b49e`，"test(ci): make prepare stub tests portable to real Linux runners"）。承接 [CP-A 轮](linux-evidence.md)、[CP-A2 轮](linux-evidence-cp-a2.md)。观察窗口：2026-09-19T14:52Z – 15:12Z。

## 1. Run / checkout 身份（API 实测）

| 项 | 值 |
|---|---|
| CI run | `35450138445`，run_number **42**，attempt 1，event `pull_request`，14:54:5x → 15:10:41Z，conclusion **failure**（无 re-run） |
| PR head / base / merge | head `1d412762eb…`（=CP-A3）；base `5434305c…` 不变；CI checkout merge `1ae5a5577f15cba0dbac9f60a81714cf83f375fb` |
| merge tree blob | script `cf6f7a13`（与 CP-A2 相同，本轮未改）；spec `7c5dfc42`、test-support `4558bf48`（CP-A3 更新）；`ci.yml` `c6b939a7` 不变 —— 全部与本地 HEAD 一致 |

## 2. 两条 Linux 作业（准备管线保持通过）

- `node 24 / coverage`（105915744012）：准备步骤 **success**（14:54:27→14:54:44，17s）；"Run exhaustive coverage" 13m25s 后 failure；evidence 上传 success。
- `node 24 / snapshots and artifacts`（105915744016）：准备步骤 **success**（14:55:05→14:55:22，17s）；gates 步骤 failure（14:55:44→14:59:05）；evidence 上传 success。
- 即下载→hash→契约→审计→Meson→编译→[7/7] 链接→ELF/NEEDED/ldd→版本→probe→PATH 发布在两路**再次全通过**（A3 构建面结论保持，判定口径不变：构建面已证、安全分项 NOT_RUN 精确阻塞、sandbox.yml NOT_CLOSED）。

## 3. 期前预期 vs 实测（逐项）

| 预期（收尾轮指令） | 实测 |
|---|---|
| coverage 作业中 prepare-spec 4 处失败应转绿（双键 e2e×2、缺件场景、主序列） | **转绿确证**：本轮 coverage annotations（4 条）中 `prepare-ci-bubblewrap.spec.ts` 失败**零出现**（CP-A2 轮为 stub-source×2、:907、:787 共 4 处）。佐证等级=注释消失（CP-A2 同渠道曾精确浮现该 4 处）；逐文件权威表在 artifact `10587360084`（168,072 bytes）。CP-A2 的 terminal-bash `dsh> ` 失败本轮亦未浮现（未证修复，属 flaky 或旁及，不宣称） |
| test:expected 的 pi-ai 失败预计仍在（归 W11） | **未按预期出现**：本轮 consumers annotations 无 pi-ai 失败；浮现的是两个**新**失败——见 §4。test:expected 是否真绿以 gate 表为准（fail-fast 下 snapshot 能执行并失败，说明 expected 未先失败；artifact `10585733512` 权威） |
| Windows coverage 仍预期失败（W11） | 确认 failure；浮现 `scripts/gen-client-catalog.spec.ts:200` 30s timeout（CP-A2 轮为 typert tools-catalog timeout，同类超时族）。不展开 |

## 4. consumers 作业 gates 失败面变化（W04 关键信息）

本轮 surfaced 断言（annotations 实录，raw 已存）：

1. `AssertionError: subagent-teardown: session 1 header 1: expected { config: {…(2)}, …(1) } to deeply equal …` — diff 显示 received 侧 config 多出大量字段（`"model": "deepseek-v4-flash"` 附近 +55 vs +10 行）。
2. `AssertionError: agent-team-teardown: session 0 header 1: …` — diff 落在工具 schema 区（`"type": "object"` 附近，21 行对 21 行差异）。

判定：**sdk snapshot 通道（W04 的两个共享 teardown 场景比较）本轮真实执行并在 Linux 上比较失败**——F4.2/F4.3 的 Linux 证据现在**存在且为不匹配**：subagent-teardown 子 session 的 request header config、agent-team-teardown 父 session 的 header/tool-schema 与现有预期不一致。**W04 Linux 侧仍未解锁**；下一步归 W04（预期文件/平台选择）处置，非准备脚本问题。gate 表（含 test:expected 结论与完整 diff）在 artifact `10585733512`（30,910 bytes，较 CP-A2 的 9,145 显著增大，即 snapshot 通道真实产出的证据）。

## 5. coverage 作业残留失败（归 W11，非准备面）

- `packages/experimental/inspector/tests/cordis-tree.host.spec.ts:62`：`CDP call timed out: Runtime.evaluate`（新浮现）。
- `packages/experimental/code-runtime-python/tests/runtime.spec.ts`：60s wall-clock timeout（与 CP-A2 相同，复现）。
- 覆盖率阈值/逐文件短缺：artifact `10587360084`。

## 6. CP1 期中修正落实清单（C1–C3 + G5，本轮完成）

- **C1**（`linux-evidence-cp-a2.md` §6、`FINDINGS.md` A2-7）：已改记 gate-results 实测——CP-A2 轮 `snapshot` gate 为 skipped（`aborted by fail-fast: test:expected failed`，failFast=true，6 passed/1 failed/4 skipped），撤销"通道已真实运行/很可能通过"；artifact 状态更新为"已在 `C:\dsh-b01-w03\gate-evidence-snapshots\`、哈希经 CP1 验证"。
- **C2**（`FINDINGS.md` F4、A2-2）：F4 补"已被授权通道日志取代"指针（[7/7] 编译链接完成、失败点=链接证据 grep）；A2-2 措辞降准（轮一仅推算窗口，未定位精确点）。
- **C3**（两份 query-digest）：补 `evidence_hygiene_gaps` 标注——占位时间戳、无 raw 对应的注释条目、误导性 `.zip` 文件名（实为 401 JSON body）；只标注不补造。【CR-1 修正后状态：cp-a2 gaps 三条齐全；cp-a3 原仅 notes.hygiene 一句，经 CP1 增量 CR-1 由总控补 evidence_hygiene_gaps 两条（14xxZ 占位时间戳、误导 .zip 注记）】
- **G5**（`linux-evidence-cp-a2.md` §2.1）：括注修正——sysctl 为告警式（`|| echo …` 不退出），功能 probe 才致命。
- 注：本轮（CP-A3）annotations 三次抓取已直接落盘 raw（`annot-a3-*.json`），不再有无 raw 对应的条目。

## 7. 收尾判定汇总（沿既有口径）

- **A3 构建面**：已证（CP-A2 首证、CP-A3 两路复现 exit 0）。
- **A3 安全分项**：NOT_RUN（`-Dtests=false`、无上游安全测试执行通道——精确阻塞，非降级）。
- **sandbox.yml**：NOT_CLOSED。
- **W02 返工验收（CP-A3 目标）**：prepare-spec Linux 4 处失败**实测转绿**。
- **W04 F4.2/F4.3**：通道已运行、比较失败（subagent-teardown session 1 header config；agent-team-teardown session 0 header/tool-schema）——交 W04 处置。
- **W11 输入**：pi-ai expected 状态待 gate 表确认；inspector CDP timeout、python-runtime timeout（复现）、Windows coverage timeout 族、coverage 短缺明细（artifacts `10587360084` / `10586684279` / `10585733512`）。
